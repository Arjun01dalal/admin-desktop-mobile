import { useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { CopyText, type CommonTableColumn } from '@/components/CommonTable';
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
import { formatStatusLabel, toMinSec } from './utils';

export type UseCallLogsColumnsParams = {
  page: number;
  itemsPerPage: number;
  onEndCall: (row: CallLogRow) => void;
  onBotCall: (rows: CallLogRow[]) => void;
  onViewSummary: (row: CallLogRow) => void;
  onConnectDialer: (row: CallLogRow) => void;
  onOpenComment: (row: CallLogRow) => void;
};

export function useCallLogsColumns({
  page,
  itemsPerPage,
  onEndCall,
  onBotCall,
  onViewSummary,
  onConnectDialer,
  onOpenComment,
}: UseCallLogsColumnsParams): CommonTableColumn<CallLogRow>[] {
  const rowOffset = (page - 1) * itemsPerPage;

  return useMemo<CommonTableColumn<CallLogRow>[]>(
    () => [
      {
        id: 'select',
        label: <SelectAllCheckbox />,
        filter: null,
        render: (row) => <SelectRowCheckbox row={row} />,
      },
      {
        id: 'index',
        label: 'Sr.no',
        filter: null,
        render: (_row, index) => rowOffset + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: null,
        render: (row) => String(row.client_name || '-'),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        filter: <DpIdFilter />,
        render: (row) => <CopyText value={String(row.caller_user_id || '')} />,
      },
      {
        id: 'mobile',
        label: 'Mobile no',
        filter: <MobNoFilter />,
        render: (row) => {
          const mobile = String(row.phone_number || '');
          return mobile ? <CopyText value={mobile} /> : '—';
        },
      },
      {
        id: 'app',
        label: 'App Name',
        filter: null,
        render: (row) => String(row.app_name || '-'),
      },
      {
        id: 'state',
        label: 'State',
        filter: <StateFilter />,
        render: (row) => String(row.state || '-'),
      },
      {
        id: 'status',
        label: 'Status',
        filter: <StatusFilter />,
        cellSx: { whiteSpace: 'normal' },
        render: (row) => {
          const label = formatStatusLabel(row);
          const duration = toMinSec(row.call_duration);
          return (
            <Box>
              <Typography variant="body2">{label}</Typography>
              {duration && (
                <Typography variant="caption" color="text.secondary">
                  {duration}
                </Typography>
              )}
              {row.recording_url ? (
                <Typography variant="caption" display="block" color="primary.main">
                  Recording
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'callId',
        label: 'Call ID',
        filter: <SidFilter />,
        render: (row) => {
          const status = String(row.status || '');
          if (status === 'queued' || status === 'deleted') return '-';
          return <CopyText value={String(row.call_sid || '')} />;
        },
      },
      {
        id: 'botId',
        label: 'Bot ID',
        filter: <BotIdFilter />,
        render: (row) => String(row.bot_id ?? '-'),
      },
      {
        id: 'completedAt',
        label: 'Completed At',
        filter: null,
        render: (row) =>
          row.completed_at
            ? new Date(String(row.completed_at)).toLocaleString()
            : '-',
      },
      {
        id: 'comment',
        label: 'Comment',
        filter: <CommentFilter />,
        cellSx: { whiteSpace: 'normal', minWidth: 140 },
        render: (row) => String(row.comments || '-'),
      },
      {
        id: 'action',
        label: 'Action',
        filter: null,
        cellSx: { whiteSpace: 'normal', minWidth: 220 },
        render: (row) => {
          const status = String(row.status || '');
          if (status === 'queued') return null;
          if (status === 'in-progress') {
            return (
              <Button size="small" color="warning" onClick={() => void onEndCall(row)}>
                Call End
              </Button>
            );
          }
          return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="center">
              <Button size="small" onClick={() => void onBotCall([row])}>
                Call
              </Button>
              {status === 'completed' && row.recording_url ? (
                <Button size="small" onClick={() => void onViewSummary(row)}>
                  Summary
                </Button>
              ) : null}
              <Button size="small" onClick={() => void onConnectDialer(row)}>
                Dialer
              </Button>
              <Button size="small" onClick={() => onOpenComment(row)}>
                Comment
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'commentedBy',
        label: 'Comment By',
        filter: null,
        render: (row) => String(row.commented_by || '-'),
      },
      {
        id: 'deletedBy',
        label: 'Deleted By',
        filter: null,
        cellSx: { whiteSpace: 'normal' },
        render: (row) => (
          <>
            {String(row.deleted_by || '-')}
            {row.deleted_at ? (
              <Typography variant="caption" display="block" color="text.secondary">
                {new Date(String(row.deleted_at)).toLocaleString()}
              </Typography>
            ) : null}
          </>
        ),
      },
    ],
    [
      rowOffset,
      onEndCall,
      onBotCall,
      onViewSummary,
      onConnectDialer,
      onOpenComment,
    ],
  );
}
