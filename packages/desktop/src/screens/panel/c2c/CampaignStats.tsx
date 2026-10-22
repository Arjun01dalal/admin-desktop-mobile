import { Box, Stack, Typography } from '@mui/material';
import type { C2cCampaign } from '@astro/shared';

export function CampaignStats({ campaign }: { campaign: C2cCampaign }) {
  const d = campaign.data || { total: 0, pending: 0, assigned: 0, completed: 0 };
  const items = [
    { key: 'total', label: 'Total', value: d.total, color: 'text.primary' },
    { key: 'pending', label: 'Pending', value: d.pending, color: '#ff9f0a' },
    { key: 'assigned', label: 'Assigned', value: d.assigned, color: '#64b5f6' },
    { key: 'done', label: 'Done', value: d.completed, color: '#4ade80' },
  ];
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {items.map((item) => (
        <Box
          key={item.key}
          sx={{
            minWidth: 72,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15, color: item.color }}>
            {item.value}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              fontSize: 10,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
