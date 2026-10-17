/** Display helpers for C2C Campaign screens (IST date/time). */
import { formatDisplayDate, formatDisplayTime } from '../../../../utils/dates';

export function formatC2cCreatedStamp(value?: string): string {
  if (!value) return '';
  const date = formatDisplayDate(value);
  const time = formatDisplayTime(value);
  if (date && time) return `${date} ${time}`;
  return date || time || '';
}
