import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { Box, Chip, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';
import CallIcon from '@mui/icons-material/Call';
import { display } from '@/screens/panel/shared';
import { alpha } from '@mui/material/styles';
import {
  formatC2cAssignedLabel,
  maskGtelPhone,
  sanitizeGtelPhone,
  type C2cCampaignCustomer,
} from '@astro/shared';

import { formatCreatedStamp, statusChipSx } from './format';

type Args = {
  canShowMobile: boolean;
  canShowC2c: boolean;
  callingId: string;
  callCustomer: (row: C2cCampaignCustomer) => void;
};

export function useC2cCustomerColumns({
  canShowMobile,
  canShowC2c,
  callingId,
  callCustomer,
}: Args): CommonTableColumn<C2cCampaignCustomer>[] {
  return useMemo(
    () => [
      {
        id: 'user',
        label: 'User',
        align: 'left',
        width: 220,
        render: (r) => {
          const dpId = String(r.dp_id || r.userId || '').trim();
          const name = String(r.name || '').trim() || '—';
          return (
            <Box sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13, lineHeight: 1.3 }}>
                {name}
              </Typography>
              {dpId ? (
                <Link
                  component={RouterLink}
                  to={`/users/report/${encodeURIComponent(dpId)}/${encodeURIComponent(name === '—' ? dpId : name)}`}
                  underline="hover"
                  sx={{
                    display: 'block',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 11,
                    fontWeight: 500,
                    wordBreak: 'break-all',
                    color: 'primary.main',
                  }}
                >
                  {dpId}
                </Link>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              )}
              {r.appName ? (
                <Chip
                  size="small"
                  label={String(r.appName)}
                  sx={{
                    mt: 0.5,
                    height: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 1,
                    bgcolor: alpha('#94a3b8', 0.12),
                  }}
                />
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => (
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
            }}
          >
            {maskGtelPhone(String(r.mobile || r.phone || ''), canShowMobile)}
          </Typography>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        render: (r) => (
          <Chip
            size="small"
            label={display(r.status) === '—' ? '—' : String(r.status)}
            sx={{
              height: 24,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'capitalize',
              borderRadius: 999,
              ...statusChipSx(r.status),
            }}
          />
        ),
      },
      {
        id: 'assigned',
        label: 'Assigned',
        width: 150,
        align: 'left',
        render: (r) => {
          const assignee = formatC2cAssignedLabel(r.assignedTo);
          const assignedAt = formatCreatedStamp(r.assignedAt);
          const completedAt = formatCreatedStamp(r.completedAt);
          if (!assignee && assignedAt === '—' && completedAt === '—') {
            return (
              <Typography variant="body2" color="text.secondary">
                Unassigned
              </Typography>
            );
          }
          return (
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 12 }}>
                {assignee || 'Unassigned'}
              </Typography>
              {assignedAt !== '—' ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {assignedAt}
                </Typography>
              ) : null}
              {completedAt !== '—' ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  Done: {completedAt}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'callId',
        label: 'Call ID',
        width: 160,
        render: (r) => (
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 11,
              wordBreak: 'break-all',
            }}
          >
            {display(r.callId)}
          </Typography>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        width: 110,
        render: (r) => {
          if (!canShowC2c) {
            return (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            );
          }
          const phone = sanitizeGtelPhone(r.mobile || r.phone);
          const busy = callingId === String(r._id || '');
          return (
            <Tooltip title={busy ? 'Calling…' : 'Call'}>
              <span>
                <IconButton
                  size="small"
                  aria-label="Call"
                  disabled={!phone || !r._id || busy}
                  onClick={() => void callCustomer(r)}
                  sx={{
                    color: '#1a1200',
                    bgcolor: '#ff9f0a',
                    borderRadius: 1.25,
                    width: 32,
                    height: 32,
                    '&:hover': { bgcolor: '#e08c00' },
                    '&.Mui-disabled': {
                      bgcolor: alpha('#ff9f0a', 0.35),
                      color: alpha('#1a1200', 0.45),
                    },
                  }}
                >
                  <CallIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      },
    ],
    [callCustomer, callingId, canShowC2c, canShowMobile],
  );
}
