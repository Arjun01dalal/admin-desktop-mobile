import { useMemo } from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { formatC2cCreatorLabel, isC2cLeadCampaign, type C2cCampaign } from '@astro/shared';
import { type CommonTableColumn } from '@/components/CommonTable';
import { display } from '@/screens/panel/shared';
import { formatCreatedStamp } from './format';

type Args = {
  duplicating: boolean;
  openCampaign: (id: string) => void;
  openDuplicate: (campaign: C2cCampaign) => void;
  onViewCallers: (campaign: C2cCampaign) => void;
};

export function useC2cCampaignColumns({
  duplicating,
  openCampaign,
  openDuplicate,
  onViewCallers,
}: Args): CommonTableColumn<C2cCampaign>[] {
  return useMemo(
    () => [
      {
        id: 'name',
        label: 'Campaign',
        align: 'left',
        width: 200,
        render: (r) => (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              fontSize: 12,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              lineHeight: 1.3,
              maxWidth: 200,
            }}
          >
            {display(r.campaignName)}
          </Typography>
        ),
      },
      {
        id: 'active',
        label: 'Status',
        width: 130,
        render: (r) => (
          <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={r.isActive ? 'Active' : 'Inactive'}
              sx={{
                height: 26,
                fontWeight: 800,
                fontSize: 12,
                borderRadius: 999,
                ...(r.isActive
                  ? {
                      bgcolor: alpha('#22c55e', 0.16),
                      color: '#4ade80',
                      border: `1px solid ${alpha('#22c55e', 0.35)}`,
                    }
                  : {
                      bgcolor: alpha('#94a3b8', 0.12),
                      color: '#94a3b8',
                      border: `1px solid ${alpha('#94a3b8', 0.28)}`,
                    }),
              }}
            />
            {isC2cLeadCampaign(r) ? (
              <Chip
                size="small"
                label="Lead"
                sx={{
                  height: 26,
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 999,
                  bgcolor: alpha('#ff9f0a', 0.16),
                  color: '#ff9f0a',
                  border: `1px solid ${alpha('#ff9f0a', 0.4)}`,
                }}
              />
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'stats',
        label: 'Stats',
        width: 360,
        render: (r) => (
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary', fontWeight: 600 }}
            noWrap
          >
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
              {r.data.total}
            </Box>
            {' · '}Pending {r.data.pending}
            {' · '}Assigned {r.data.assigned}
            {' · '}Done {r.data.completed}
          </Typography>
        ),
      },
      {
        id: 'callers',
        label: 'Callers',
        width: 120,
        render: (r) => {
          const count = r.callers?.length || 0;
          if (!count) {
            return (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            );
          }
          return (
            <Tooltip title={`View ${count} caller${count === 1 ? '' : 's'}`}>
              <IconButton
                size="small"
                aria-label={`View ${count} callers`}
                onClick={() => onViewCallers(r)}
                sx={{
                  color: '#ff9f0a',
                  border: '1px solid',
                  borderColor: alpha('#ff9f0a', 0.35),
                  borderRadius: 1.25,
                  px: 0.85,
                  py: 0.35,
                  gap: 0.5,
                  '&:hover': { borderColor: '#ff9f0a', bgcolor: alpha('#ff9f0a', 0.08) },
                }}
              >
                <GroupsOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography component="span" sx={{ fontSize: 12, fontWeight: 800, lineHeight: 1 }}>
                  {count}
                </Typography>
              </IconButton>
            </Tooltip>
          );
        },
      },
      {
        id: 'created',
        label: 'Created by',
        width: 200,
        align: 'left',
        render: (r) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {formatC2cCreatorLabel(r)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {formatCreatedStamp(r.createdAt)}
            </Typography>
          </Box>
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 130,
        render: (r) => (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Tooltip title="Open">
              <IconButton
                size="small"
                aria-label="Open campaign"
                onClick={() => void openCampaign(r._id)}
                sx={{
                  color: '#1a1200',
                  bgcolor: '#ff9f0a',
                  borderRadius: 1.25,
                  width: 32,
                  height: 32,
                  '&:hover': { bgcolor: '#e08c00' },
                }}
              >
                <OpenInNewOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Duplicate">
              <span>
                <IconButton
                  size="small"
                  aria-label="Duplicate campaign"
                  onClick={() => openDuplicate(r)}
                  disabled={duplicating}
                  sx={{
                    color: '#ff9f0a',
                    border: '1px solid',
                    borderColor: alpha('#ff9f0a', 0.35),
                    borderRadius: 1.25,
                    width: 32,
                    height: 32,
                    '&:hover': { borderColor: '#ff9f0a', bgcolor: alpha('#ff9f0a', 0.08) },
                  }}
                >
                  <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [duplicating, onViewCallers, openCampaign, openDuplicate],
  );
}
