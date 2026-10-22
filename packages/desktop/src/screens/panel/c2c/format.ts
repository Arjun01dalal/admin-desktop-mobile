import { alpha } from '@mui/material/styles';
import { c2cCustomerStatusTone } from '@astro/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';

export function formatCreatedStamp(value?: string): string {
  if (!value) return '—';
  const date = formatDisplayDate(value);
  const time = formatDisplayTime(value);
  if (date && time) return `${date} ${time}`;
  return date || time || '—';
}

export function statusChipSx(status?: string) {
  const tone = c2cCustomerStatusTone(status);
  if (tone === 'pending') {
    return {
      bgcolor: alpha('#ff9f0a', 0.16),
      color: '#ff9f0a',
      border: `1px solid ${alpha('#ff9f0a', 0.4)}`,
    };
  }
  if (tone === 'assigned') {
    return {
      bgcolor: alpha('#64b5f6', 0.16),
      color: '#64b5f6',
      border: `1px solid ${alpha('#64b5f6', 0.4)}`,
    };
  }
  if (tone === 'completed') {
    return {
      bgcolor: alpha('#4ade80', 0.16),
      color: '#4ade80',
      border: `1px solid ${alpha('#4ade80', 0.4)}`,
    };
  }
  return {
    bgcolor: alpha('#94a3b8', 0.14),
    color: 'text.secondary',
    border: `1px solid ${alpha('#94a3b8', 0.3)}`,
  };
}
