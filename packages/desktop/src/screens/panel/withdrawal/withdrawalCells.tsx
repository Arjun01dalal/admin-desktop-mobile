import type { MouseEvent } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { copyToClipboard } from '@/utils/clipboard';
import {
  displayUserName,
  resolveWithdrawalReportUserId,
  showWithdrawalMidReport,
} from '@/screens/panel/withdrawal/logic';
import type { WithdrawalRow } from '@/screens/panel/withdrawal/types';

export function personCell(text: string, date?: string) {
  return (
    <Typography variant="body2" sx={{ fontSize: 12 }}>
      {text}
      <br />
      {formatDisplayDate(date)} {formatDisplayTime(date)}
    </Typography>
  );
}

export function Copyable({ value, masked }: { value?: string; masked: string }) {
  if (!value) return <>—</>;
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
      <Typography variant="body2" sx={{ fontSize: 12 }}>
        {masked}
      </Typography>
      <IconButton
        size="small"
        aria-label="copy"
        onClick={() => void copyToClipboard(value)}
        sx={{ color: '#ff9f0a', p: 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Stack>
  );
}

export function UserNameMidReportCell({
  row,
  canOpenUserReport,
  onOpenMidReport,
  onOpenUserReport,
}: {
  row: WithdrawalRow;
  canOpenUserReport: boolean;
  onOpenMidReport: (row: WithdrawalRow) => void;
  onOpenUserReport: (row: WithdrawalRow, label: string, userId: string) => void;
}) {
  const label = displayUserName(row);
  const reportUserId = resolveWithdrawalReportUserId(row);
  const midReportVisible = Boolean(reportUserId) && showWithdrawalMidReport(row.status);
  const canLink = canOpenUserReport && Boolean(reportUserId) && label !== '—';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <Typography
        component={canLink ? 'button' : 'span'}
        type={canLink ? 'button' : undefined}
        title={label}
        onClick={
          canLink
            ? (e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onOpenUserReport(row, label, reportUserId);
              }
            : undefined
        }
        sx={{
          ...(canLink
            ? {
                all: 'unset',
                cursor: 'pointer',
                color: '#4fc3f7 !important',
                '&:hover': {
                  color: '#81d4fa !important',
                  textDecoration: 'underline',
                },
              }
            : null),
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.25,
          minWidth: 0,
          maxWidth: midReportVisible ? 'calc(100% - 26px)' : '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {label}
      </Typography>
      {midReportVisible ? (
        <Tooltip title="Choose MID for Withdrawal" arrow placement="top">
          <IconButton
            size="small"
            aria-label="Choose MID for Withdrawal"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMidReport(row);
            }}
            sx={{
              flexShrink: 0,
              color: '#ff9f0a',
              width: 22,
              height: 22,
              p: 0,
              borderRadius: 1,
              border: '1px solid rgba(255,159,10,0.35)',
              bgcolor: 'rgba(255,159,10,0.1)',
              '&:hover': {
                bgcolor: 'rgba(255,159,10,0.22)',
                borderColor: 'rgba(255,159,10,0.55)',
              },
            }}
          >
            <AssessmentOutlinedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  );
}
