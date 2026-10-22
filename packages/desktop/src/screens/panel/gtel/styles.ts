/** Shared Gtel Calls / Caller Dashboard visual tokens. */

import { alpha } from '@mui/material/styles';
import type { GtelStatusFilter } from '@astro/shared';

export const gtelHeroBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 800,
  height: 40,
  px: 2.25,
  borderRadius: 999,
  color: '#fff',
  whiteSpace: 'nowrap' as const,
  background: 'linear-gradient(180deg, #ffcc4d 0%, #ff9f0a 52%, #f08800 100%)',
  boxShadow: '0 0 14px rgba(255,159,10,0.55), 0 3px 8px rgba(0,0,0,0.35)',
  '&:hover': {
    background: 'linear-gradient(180deg, #ffd666 0%, #ffb020 52%, #f59a10 100%)',
    boxShadow: '0 0 18px rgba(255,159,10,0.7), 0 4px 10px rgba(0,0,0,0.4)',
  },
  '& .MuiButton-startIcon': { mr: 0.75 },
  '& .MuiSvgIcon-root': { color: '#fff' },
};

export const gtelIconBtnSx = {
  color: '#ff9f0a',
  p: 0.45,
  border: '1px solid',
  borderColor: 'rgba(255,159,10,0.35)',
  borderRadius: 1.25,
  width: 34,
  height: 34,
  '&:hover': { borderColor: '#ff9f0a', bgcolor: 'rgba(255,159,10,0.08)' },
  '&.Mui-disabled': { opacity: 0.45 },
} as const;

/** Primary search action in the filter toolbar. */
export const gtelSearchIconBtnSx = {
  ...gtelIconBtnSx,
  color: '#1a1200',
  bgcolor: '#ff9f0a',
  borderColor: '#ff9f0a',
  '&:hover': { bgcolor: '#e08c00', borderColor: '#e08c00' },
  '&.Mui-disabled': { opacity: 0.45, bgcolor: '#ff9f0a', color: '#1a1200' },
} as const;

/** Compact outlined fields for the Gtel filter row. */
export const gtelFilterFieldSx = {
  flexShrink: 0,
  '& .MuiInputBase-root': {
    height: 36,
    fontSize: 12.5,
    borderRadius: 1.25,
    bgcolor: 'action.hover',
  },
  '& .MuiInputBase-input': {
    py: 0.75,
    px: 1.1,
    fontSize: 12.5,
  },
  '& .MuiInputLabel-root': {
    fontSize: 12,
    transform: 'translate(12px, 8px) scale(1)',
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(12px, -8px) scale(0.85)',
  },
  '& .MuiSelect-select': {
    py: 0.75,
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,159,10,0.45)',
  },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#ff9f0a',
    borderWidth: 1,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#ff9f0a',
  },
} as const;

export const STATUS_CARD_TONES: Record<
  Exclude<GtelStatusFilter, ''> | 'total',
  { border: string; value: string; accent: string }
> = {
  total: { border: 'rgba(255,159,10,0.45)', value: '#ffb84d', accent: '#ff9f0a' },
  answered: { border: 'rgba(34,197,94,0.45)', value: '#86efac', accent: '#22c55e' },
  noAnswer: { border: 'rgba(249,115,22,0.45)', value: '#fdba74', accent: '#f97316' },
  failed: { border: 'rgba(239,68,68,0.45)', value: '#fca5a5', accent: '#ef4444' },
  pending: { border: 'rgba(59,130,246,0.45)', value: '#93c5fd', accent: '#3b82f6' },
};

/** Compact status pill for Gtel Calls table / Caller Calls modal. */
export const GTEL_STATUS_PILL: Record<
  'answer' | 'noAnswer' | 'completed' | 'muted',
  { fg: string; bg: string; border: string }
> = {
  answer: {
    fg: '#4ade80',
    bg: alpha('#22c55e', 0.16),
    border: alpha('#22c55e', 0.35),
  },
  noAnswer: {
    fg: '#fb923c',
    bg: alpha('#f97316', 0.16),
    border: alpha('#f97316', 0.35),
  },
  completed: {
    fg: '#60a5fa',
    bg: alpha('#3b82f6', 0.16),
    border: alpha('#3b82f6', 0.35),
  },
  muted: {
    fg: '#94a3b8',
    bg: alpha('#94a3b8', 0.12),
    border: alpha('#94a3b8', 0.28),
  },
};

export const gtelStatusPillSx = (tone: keyof typeof GTEL_STATUS_PILL) => {
  const pill = GTEL_STATUS_PILL[tone];
  return {
    height: 24,
    maxWidth: '100%',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.35,
    borderRadius: 999,
    bgcolor: pill.bg,
    color: pill.fg,
    border: `1px solid ${pill.border}`,
    '& .MuiChip-label': { px: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' },
  } as const;
};
