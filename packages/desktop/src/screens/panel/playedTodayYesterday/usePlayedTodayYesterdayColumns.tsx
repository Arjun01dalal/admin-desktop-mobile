/**
 * Table columns for Played Today / Yesterday report.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import type { CommonTableColumn } from '@/components/CommonTable';
import { display, maskMobile } from '@/screens/panel/shared';
import { gtelIconBtnSx } from '@/screens/panel/gtel/styles';
import {
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  appCodeForName,
  rowDisplayName,
  rowMobile,
  rowUserId,
  sanitizeGtelPhone,
} from '@astro/shared';

import { formatPlayedCell } from './formatPlayedCell';

type Row = Record<string, unknown>;

type Args = {
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  canShowC2c: boolean;
  isCalling: (phoneRaw: string) => boolean;
  startC2c: (phoneRaw: string, userId?: string) => void | Promise<unknown>;
};

export function usePlayedTodayYesterdayColumns({
  page,
  pageSize,
  canShowMobile,
  canShowC2c,
  isCalling,
  startC2c,
}: Args): CommonTableColumn<Row>[] {
  const navigate = useNavigate();

  return useMemo(
    () => [
      {
        id: 'sr',
        label: 'Sr No',
        width: 70,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: 110,
        cellSx: { maxWidth: 110, whiteSpace: 'normal', verticalAlign: 'middle' },
        render: (row) => {
          const id = rowUserId(row);
          const name = rowDisplayName(row) || '—';
          const nameSx = {
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            wordBreak: 'break-word' as const,
            maxWidth: 100,
          };
          if (!id) {
            return (
              <Typography title={display(name)} sx={{ ...nameSx, color: 'text.primary' }}>
                {display(name)}
              </Typography>
            );
          }
          return (
            <Typography
              component="span"
              title={name}
              sx={{ ...nameSx, color: 'primary.main', cursor: 'pointer' }}
              onClick={() =>
                navigate(
                  `/users/report/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
                )
              }
            >
              {name}
            </Typography>
          );
        },
      },
      {
        id: 'mobile',
        label: 'Mobile',
        width: 130,
        cellSx: { whiteSpace: 'normal' },
        render: (row) => {
          const mobile = rowMobile(row);
          const id = rowUserId(row);
          const phone = sanitizeGtelPhone(mobile);
          const calling = isCalling(mobile);
          return (
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ py: 0.25 }}>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
                noWrap
              >
                {maskMobile(mobile, canShowMobile)}
              </Typography>
              {canShowC2c && phone ? (
                <Tooltip title="C2C Call">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="C2C Call"
                      disabled={calling}
                      onClick={(e) => {
                        e.stopPropagation();
                        void startC2c(mobile, id);
                      }}
                      sx={gtelIconBtnSx}
                    >
                      {calling ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <PhoneInTalkOutlinedIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'state',
        label: 'State',
        width: 120,
        render: (row) => formatPlayedCell(row.state),
      },
      {
        id: 'city',
        label: 'City',
        width: 110,
        render: (row) => formatPlayedCell(row.city),
      },
      {
        id: 'clientName',
        label: 'App Name',
        width: 110,
        render: (row) =>
          appCodeForName(String(row.clientName ?? '')) || formatPlayedCell(row.clientName),
      },
      {
        id: 'empCode',
        label: 'Employee Code',
        width: 120,
        render: (row) => formatPlayedCell(row.empCode),
      },
      {
        id: 'createdOn',
        label: 'Created On',
        width: 150,
        render: (row) => formatPlayedCell(row.createdOn),
      },
      {
        id: 'activeUser',
        label: 'Last Activity',
        width: 150,
        render: (row) => formatPlayedCell(row.activeUser),
      },
      {
        id: 'secondLastActiveDate',
        label: 'Second Last Active',
        width: 150,
        render: (row) => formatPlayedCell(row.secondLastActiveDate),
      },
    ],
    [canShowC2c, canShowMobile, isCalling, navigate, page, pageSize, startC2c],
  );
}
