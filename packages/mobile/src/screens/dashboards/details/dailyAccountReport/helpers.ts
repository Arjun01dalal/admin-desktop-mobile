import { dayBalanceStatus } from '@astro/shared/dailyAccountReport';

import { colors } from '../../../../theme';
import type { DaySheetItem } from './api';

export function statusTone(status: ReturnType<typeof dayBalanceStatus>) {
  if (status === 'done') return { bg: 'rgba(34,197,94,0.14)', color: '#4ade80', label: 'Done' };
  if (status === 'open') return { bg: 'rgba(245,158,11,0.14)', color: '#fbbf24', label: 'Open only' };
  return { bg: 'rgba(148,163,184,0.16)', color: colors.muted, label: 'Pending' };
}

export function daySheetStatusTone(row: DaySheetItem) {
  return statusTone(dayBalanceStatus(row));
}
