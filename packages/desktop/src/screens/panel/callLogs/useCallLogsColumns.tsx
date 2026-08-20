import { useMemo } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { hasPermission } from '@/auth/permissions';
import { CopyText, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { maskMobile } from '@/screens/panel/shared';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { getStoredUser } from '@/utils/dates';
import {
  BotIdFilter,
  CommentFilter,
  DpIdFilter,
  MobNoFilter,
  SidFilter,
  StateFilter,
  StatusFilter,
} from './ColumnFilters';
import { SelectAllCheckbox, SelectRowCheckbox } from './SelectColumn';
import type { CallLogRow } from './types';
import {
  formatStatusLabel,
  getAssignedBotIds,
  isCallLogsCaller,
  statusBadgeTone,
  toMinSec,
} from './utils';

const STATUS_CHIP_SX = {
  completed: { bgcolor: '#16a34a', color: '#fff' },
  'no-answer': { bgcolor: '#dc2626', color: '#fff' },
  busy: { bgcolor: '#facc15', color: '#111' },
  deleted: { bgcolor: '#111', color: '#fff' },
  default: { bgcolor: '#9ca3af', color: '#fff' },
} as const;

const actionBtnSx = {
  fontSize: 11,
  py: 0.35,
  px: 1.1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  fontWeight: 700,
  lineHeight: 1.25,
  borderRadius: '999px',
  boxShadow: 'none',
  flexShrink: 0,
  '&:hover': { boxShadow: 'none' },
} as const;

export type UseCallLogsColumnsParams = {
  page: number;
  itemsPerPage: number;
  onEndCall: (row: CallLogRow) => void;
  onViewSummary: (row: CallLogRow) => void;
  onConnectDialer: (row: CallLogRow) => void;
  onOpenComment: (row: CallLogRow) => void;
  onPlayRecording?: (url: string) => void;
};

export function useCallLogsColumns({
  page,
  itemsPerPage,
  onEndCall,
  onViewSummary,
  onConnectDialer,
  onOpenComment,
  onPlayRecording,
}: UseCallLogsColumnsParams): CommonTableColumn<CallLogRow>[] {
  const rowOffset = (page - 1) * itemsPerPage;
  const user = getStoredUser<{
    Role_ID?: string;
    botIds?: Array<string | number> | string;
    botNo?: Array<string | number> | string;
    Responsibilities?: string[];
  }>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);
  const hideBotIdFilter = getAssignedBotIds(user).length > 0;
  const isCaller = isCallLogsCaller(user);

  return useMemo<CommonTableColumn<CallLogRow>[]>(() => {
    const cols: CommonTableColumn<CallLogRow>[] = [
      {
        id: 'select',
        label: <SelectAllCheckbox />,
        width: 48,
        filter: null,
        render: (row) => <SelectRowCheckbox row={row} />,
      },
      {
        id: 'index',
        label: 'Sr.No',
        width: 56,
        filter: null,
        render: (_row, index) => rowOffset + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: 120,
        cellSx: { maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' },
        filter: null,
        render: (row) => String(row.client_name || '-'),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        width: 210,
        cellSx: {
          maxWidth: 230,
          px: 0.75,
        },
        filter: <DpIdFilter />,
        render: (row) => <CopyText value={String(row.caller_user_id || '')} />,
      },
    ];

    if (!isCaller) {
      cols.push({
        id: 'mobile',
        label: 'Mobile No',
        width: 110,
        cellSx: { maxWidth: 120 },
        filter: canShowMobile ? <MobNoFilter /> : null,
        render: (row) => maskMobile(row.phone_number, canShowMobile),
      });
    }

    cols.push(
      {
        id: 'app',
        label: 'App Code',
        width: 64,
        cellSx: { maxWidth: 70, px: 0.5 },
        filter: null,
        render: (row) => appCodeForName(row.app_name),
      },
      {
        id: 'state',
        label: 'State',
        width: 100,
        cellSx: {
          maxWidth: 110,
          px: 0.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        filter: <StateFilter />,
        render: (row) => String(row.state || '-'),
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        filter: <StatusFilter />,
        cellSx: { whiteSpace: 'normal', maxWidth: 120, px: 0.5 },
        render: (row) => {
          const label = formatStatusLabel(row);
          const tone = statusBadgeTone(row);
          const duration = toMinSec(row.call_duration);
          return (
            <Stack spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={label}
                sx={{
                  fontWeight: 700,
                  fontSize: 11,
                  height: 22,
                  ...STATUS_CHIP_SX[tone],
                }}
              />
              {duration ? (
                <Typography variant="caption" color="text.secondary">
                  {duration}
                </Typography>
              ) : null}
              {row.recording_url ? (
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  sx={{ ...actionBtnSx, bgcolor: '#facc15', color: '#111' }}
                  onClick={() => {
                    const url = String(row.recording_url);
                    if (onPlayRecording) onPlayRecording(url);
                    else window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Recording
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
    );

    if (!isCaller) {
      cols.push({
        id: 'callId',
        label: 'Call ID',
        width: 140,
        cellSx: { maxWidth: 150, overflow: 'hidden' },
        filter: <SidFilter />,
        render: (row) => {
          const status = String(row.status || '');
          if (status === 'queued' || status === 'deleted') return '-';
          return <CopyText value={String(row.call_sid || '')} />;
        },
      });
    }

    cols.push(
      {
        id: 'botId',
        label: 'Bot ID',
        width: 64,
        cellSx: { maxWidth: 72, px: 0.5 },
        filter: hideBotIdFilter ? null : <BotIdFilter />,
        render: (row) => String(row.bot_id ?? '-'),
      },
      {
        id: 'completedAt',
        label: 'Completed At',
        width: 140,
        cellSx: { maxWidth: 150, px: 0.5, whiteSpace: 'nowrap' },
        filter: null,
        render: (row) =>
          row.completed_at
            ? new Date(String(row.completed_at)).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
            : '-',
      },
    );

    cols.push({
      id: 'comment',
      label: 'Comment',
      width: 120,
      filter: <CommentFilter />,
      cellSx: { whiteSpace: 'normal', maxWidth: 140 },
      render: (row) => String(row.comments || '-'),
    });

    cols.push({
      id: 'action',
      label: 'Action',
      width: 340,
      filter: null,
      cellSx: {
        whiteSpace: 'normal',
        overflow: 'visible',
        textOverflow: 'clip',
        px: 1,
        py: 1,
        verticalAlign: 'middle',
      },
      render: (row) => {
        const status = String(row.status || '');
        if (status === 'queued') return null;
        if (status === 'in-progress') {
          return (
            <Button
              size="small"
              color="warning"
              variant="contained"
              sx={actionBtnSx}
              onClick={() => void onEndCall(row)}
            >
              Call End
            </Button>
          );
        }

        const showViewSummary = status === 'completed' && Boolean(row.recording_url);

        return (
          <Stack
            direction="row"
            useFlexGap
            spacing={0.75}
            alignItems="center"
            justifyContent="center"
            flexWrap="wrap"
            sx={{ gap: 0.75, maxWidth: 320, mx: 'auto' }}
          >
            {showViewSummary ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                sx={actionBtnSx}
                onClick={() => void onViewSummary(row)}
              >
                View Summary
              </Button>
            ) : null}
            <Button
              size="small"
              variant="contained"
              color="warning"
              sx={actionBtnSx}
              onClick={() => void onConnectDialer(row)}
            >
              Connect Dialer
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              sx={actionBtnSx}
              onClick={() => onOpenComment(row)}
            >
              Comment
            </Button>
          </Stack>
        );
      },
    });

    // Non-callers always get these trailing columns (same order as laxminarayan)
    if (!isCaller) {
      cols.push(
        {
          id: 'commentedBy',
          label: 'Comment By',
          width: 110,
          filter: null,
          cellSx: { maxWidth: 120 },
          render: (row) =>
            String(
              row.commented_by ||
                (row as { commentedBy?: unknown }).commentedBy ||
                '-',
            ),
        },
        {
          id: 'deletedBy',
          label: 'Deleted By',
          width: 120,
          filter: null,
          cellSx: { whiteSpace: 'normal', maxWidth: 130 },
          render: (row) => {
            const by = String(
              row.deleted_by ||
                (row as { deletedBy?: unknown }).deletedBy ||
                '-',
            );
            const at =
              row.deleted_at || (row as { deletedAt?: unknown }).deletedAt;
            return (
              <Box>
                <Typography variant="body2" component="span">
                  {by}
                </Typography>
                {at ? (
                  <Typography
                    variant="caption"
                    display="block"
                    color="text.secondary"
                  >
                    {new Date(String(at)).toLocaleString()}
                  </Typography>
                ) : null}
              </Box>
            );
          },
        },
      );
    }

    return cols;
  }, [
    rowOffset,
    canShowMobile,
    hideBotIdFilter,
    isCaller,
    onEndCall,
    onViewSummary,
    onConnectDialer,
    onOpenComment,
    onPlayRecording,
  ]);
}
