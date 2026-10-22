/** Theme-aware colors for Caller Dashboard (light + dark). */

import { useMemo } from 'react';

import { gtelCallerDashStatTone, type GtelCallerDashTone } from '@astro/shared';
import { alpha, useTheme } from '@mui/material/styles';

export type DashPalette = {
  dark: boolean;
  tone: Record<GtelCallerDashTone, string>;
  chart: {
    answered: string;
    notAnswered: string;
    noWebhook: string;
    campaign: string;
    manual: string;
    campActive: string;
    allot: string;
    flagged: string;
    exch: string;
    casino: string;
    sm: string;
  };
  name: string;
  nameHover: string;
  tabActive: string;
  tabIdleBg: string;
  tabIdleBorder: string;
  dispBorder: string;
  dispBg: string;
  dispBadge: string;
  dispBadgeFg: string;
  gridLine: string;
};

export function useDashPalette(): DashPalette {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  return useMemo(() => {
    if (dark) {
      return {
        dark: true,
        tone: {
          ok: '#86efac',
          bad: '#fca5a5',
          warn: '#fdba74',
          time: '#93c5fd',
          allot: '#5eead4',
          caller: '#d8b4fe',
          calls: '#93c5fd',
          neutral: '#94a3b8',
        },
        chart: {
          answered: '#4ade80',
          notAnswered: '#fb923c',
          noWebhook: '#f87171',
          campaign: '#4ade80',
          manual: '#c084fc',
          campActive: '#4ade80',
          allot: '#2dd4bf',
          flagged: '#f472b6',
          exch: '#f472b6',
          casino: '#e2e8f0',
          sm: '#c084fc',
        },
        name: '#d8b4fe',
        nameHover: '#e9d5ff',
        tabActive: '#db2777',
        tabIdleBg: alpha('#c084fc', 0.12),
        tabIdleBorder: alpha('#c084fc', 0.28),
        dispBorder: alpha('#f472b6', 0.35),
        dispBg: alpha('#f472b6', 0.12),
        dispBadge: alpha('#f472b6', 0.28),
        dispBadgeFg: '#f9a8d4',
        gridLine: alpha('#94a3b8', 0.2),
      };
    }

    return {
      dark: false,
      tone: {
        ok: '#2e7d32',
        bad: '#c62828',
        warn: '#ef6c00',
        time: '#1565c0',
        allot: '#00838f',
        caller: '#6a1b9a',
        calls: '#1565c0',
        neutral: '#64748b',
      },
      chart: {
        answered: '#2e7d32',
        notAnswered: '#ef6c00',
        noWebhook: '#c62828',
        campaign: '#2e7d32',
        manual: '#6a1b9a',
        campActive: '#43a047',
        allot: '#00838f',
        flagged: '#ad1457',
        exch: '#ad1457',
        casino: '#424242',
        sm: '#6a1b9a',
      },
      name: '#6a1b9a',
      nameHover: '#4a148c',
      tabActive: '#ad1457',
      tabIdleBg: alpha('#6a1b9a', 0.08),
      tabIdleBorder: alpha('#6a1b9a', 0.18),
      dispBorder: alpha('#ad1457', 0.28),
      dispBg: alpha('#ad1457', 0.08),
      dispBadge: alpha('#ad1457', 0.2),
      dispBadgeFg: '#ad1457',
      gridLine: alpha('#94a3b8', 0.35),
    };
  }, [dark]);
}

export function dashToneColor(
  palette: DashPalette,
  tone?: GtelCallerDashTone,
  key?: string,
): string {
  if (tone && palette.tone[tone]) return palette.tone[tone];
  return palette.tone[gtelCallerDashStatTone(key || '')] || palette.tone.neutral;
}

/** @deprecated Prefer useDashPalette().chart — kept for gradual migration. */
export const CHART_COLORS = {
  answered: '#2e7d32',
  notAnswered: '#ef6c00',
  noWebhook: '#c62828',
  campaign: '#2e7d32',
  manual: '#6a1b9a',
  campActive: '#43a047',
  allot: '#00838f',
  flagged: '#ad1457',
} as const;
