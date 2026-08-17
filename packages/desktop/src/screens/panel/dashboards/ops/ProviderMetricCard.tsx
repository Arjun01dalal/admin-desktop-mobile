import {
  Box,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ProviderCardModel } from './types';
import { floorNum } from './mergeMetrics';
import { metricJyotishLabel, toDisplayText } from './constants';
import { useRevealCodes } from '@/context/useRevealCodes';
import { LudoGameSelect } from './LudoGameSelect';

type Props = {
  card: ProviderCardModel;
  onClick?: () => void;
};

/** Reusable provider metric card (Ludo / Diva / Plutus support select + actions). */
export function ProviderMetricCard({ card, onClick }: Props) {
  useRevealCodes(); // re-render when OTP reveal toggles
  const navigate = useNavigate();

  const openActiveUsers = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.activeCustomerKey) return;
    const startDate = String(
      card.state?.startDate ||
        (card.search
          ? new URLSearchParams(card.search.replace(/^\?/, '')).get('startDate')
          : '') ||
        '',
    );
    const endDate = String(
      card.state?.endDate ||
        (card.search
          ? new URLSearchParams(card.search.replace(/^\?/, '')).get('endDate')
          : '') ||
        '',
    );
    navigate('/activeUserData', {
      state: {
        startDate,
        endDate,
        customerKey: card.activeCustomerKey,
        appClientName: String(card.state?.appClientName || ''),
      },
    });
  };

  const activeLabel =
    card.activeCustomerLabel || metricJyotishLabel('Active Customer');

  const useLudoTable =
    Boolean(card.selectStatsMap) &&
    Boolean(card.selectOptions?.length) &&
    Boolean(card.onSelectChange);

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
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': onClick
          ? {
              borderColor: 'warning.main',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }
          : undefined,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        mb={1.5}
      >
        <Typography
          variant="subtitle1"
          fontWeight={800}
          sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {toDisplayText(card.title)}
        </Typography>
        {useLudoTable ? (
          <LudoGameSelect
            value={card.selectValue ?? 'All'}
            options={card.selectOptions!}
            statsMap={card.selectStatsMap}
            onChange={(v) => card.onSelectChange?.(v)}
          />
        ) : card.selectOptions && card.onSelectChange ? (
          <TextField
            select
            size="small"
            // The theme defaults TextField to fullWidth, which in this row would
            // claim the whole card and squeeze the title to zero width.
            fullWidth={false}
            value={card.selectValue ?? 'All'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              card.onSelectChange?.(e.target.value);
            }}
            sx={{
              width: { xs: '100%', sm: 140 },
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
            }}
          >
            {card.selectOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {toDisplayText(opt.label)}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Stack>

      <Stack spacing={0.75}>
        {card.activeCustomerCount != null && (
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
            onClick={card.activeCustomerKey ? openActiveUsers : undefined}
          >
            <Typography variant="body2" fontWeight={700}>
              {toDisplayText(activeLabel)}:
            </Typography>
            {card.activeCustomerKey ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={openActiveUsers}
                sx={{
                  color: 'warning.main',
                  fontWeight: 800,
                  fontSize: 14,
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                }}
              >
                {floorNum(card.activeCustomerCount)}
              </Link>
            ) : (
              <Typography
                variant="body2"
                fontWeight={800}
                color="warning.main"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {floorNum(card.activeCustomerCount)}
              </Typography>
            )}
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
              color={
                row.label.toLowerCase().includes('ggr') &&
                typeof row.value === 'number'
                  ? row.value < 0
                    ? 'error.main'
                    : 'success.main'
                  : 'warning.main'
              }
              sx={{
                fontVariantNumeric: 'tabular-nums',
                textDecoration:
                  row.label.toLowerCase().includes('ggr') &&
                  typeof row.value === 'number'
                    ? 'underline'
                    : 'none',
              }}
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
