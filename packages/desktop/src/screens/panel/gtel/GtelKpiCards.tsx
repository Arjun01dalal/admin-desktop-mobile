/** KPI strip — theme-aware borders/values for light + dark (display-only). */

import { Box, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { GtelStatusFilter } from '@astro/shared';

import { STATUS_CARD_TONES } from './styles';

export type GtelKpiCard = {
  key: string;
  label: string;
  value?: string | number;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  accent?: string;
};

type Props = {
  cards: GtelKpiCard[];
};

function resolveAccent(key: string, accent: string | undefined, dark: boolean) {
  if (accent) return accent;
  const tone =
    STATUS_CARD_TONES[key as Exclude<GtelStatusFilter, ''> | 'total'] || STATUS_CARD_TONES.total;
  return dark ? tone.value : tone.accent;
}

export function GtelKpiCards({ cards }: Props) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  if (!cards.length) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 1,
      }}
    >
      {cards.map((card) => {
        const accent = resolveAccent(card.key, card.accent, dark);
        const display =
          card.value != null
            ? String(card.value)
            : (card.count ?? 0).toLocaleString('en-IN');
        return (
          <Paper
            key={card.key}
            onClick={card.onClick}
            elevation={0}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              cursor: card.onClick ? 'pointer' : 'default',
              px: 1.5,
              py: 1.25,
              border: '1px solid',
              borderColor: card.active ? accent : alpha(accent, dark ? 0.45 : 0.35),
              bgcolor: card.active
                ? alpha(accent, dark ? 0.16 : 0.08)
                : 'background.paper',
              transition: 'border-color 120ms ease, background-color 120ms ease',
              '&:hover': card.onClick
                ? { borderColor: accent, bgcolor: alpha(accent, dark ? 0.12 : 0.06) }
                : undefined,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                bgcolor: accent,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'text.secondary',
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              {card.label}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800, color: accent }}>
              {display}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
}
