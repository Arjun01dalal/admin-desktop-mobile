import {
  Box,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ProviderCardModel } from './types';
import { floorNum } from './mergeMetrics';
import { metricJyotishLabel, toDisplayText } from './constants';
import { useRevealCodes } from '@/context/useRevealCodes';

type Props = {
  card: ProviderCardModel;
  onClick?: () => void;
};

/** Reusable provider metric card (Ludo / Diva / Plutus support select + actions). */
export function ProviderMetricCard({ card, onClick }: Props) {
  useRevealCodes(); // re-render when OTP reveal toggles
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'border-color 0.15s ease',
        '&:hover': onClick ? { borderColor: 'warning.main' } : undefined,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={1.5}
        flexWrap="wrap"
      >
        <Typography variant="subtitle1" fontWeight={800}>
          {toDisplayText(card.title)}
        </Typography>
        {card.selectOptions && card.onSelectChange && (
          <TextField
            select
            size="small"
            value={card.selectValue ?? 'All'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              card.onSelectChange?.(e.target.value);
            }}
            sx={{ minWidth: 140, flexShrink: 0 }}
          >
            {card.selectOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {toDisplayText(opt.label)}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <Stack spacing={0.75}>
        {card.activeCustomerCount != null && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              {toDisplayText(metricJyotishLabel('Active Customer'))}:
            </Typography>
            <Typography
              variant="body2"
              fontWeight={800}
              color="warning.main"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {floorNum(card.activeCustomerCount)}
            </Typography>
          </Box>
        )}
        {card.rows.map((row) => (
          <Box
            key={row.label}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="body2" fontWeight={700}>
              {toDisplayText(row.label)}:
            </Typography>
            <Typography
              variant="body2"
              fontWeight={800}
              color="warning.main"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {typeof row.value === 'number' ? floorNum(row.value) : row.value}
            </Typography>
          </Box>
        ))}
      </Stack>

      {card.actions && card.actions.length > 0 && (
        <Stack
          direction="row"
          spacing={2}
          mt={1.5}
          onClick={(e) => e.stopPropagation()}
        >
          {card.actions.map((action) => (
            <Link
              key={action.label}
              component="button"
              type="button"
              underline="hover"
              onClick={action.onClick}
              sx={{
                color: 'warning.main',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {toDisplayText(action.label)}
            </Link>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
