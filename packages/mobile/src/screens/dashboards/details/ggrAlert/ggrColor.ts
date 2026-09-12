import { ggrTone } from '@astro/shared';
import { colors } from '../../../../theme';

export function ggrColor(value: unknown): string {
  const tone = ggrTone(value);
  if (tone === 'neg') return '#dc2626';
  if (tone === 'pos') return '#16a34a';
  return colors.muted;
}
