/** Styles for CoinRemovalListScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  cardBadge: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: 90,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  actionBtnText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '40%' },
  cardValue: { color: colors.foreground, fontSize: 11, flex: 1, textAlign: 'right' },
});
