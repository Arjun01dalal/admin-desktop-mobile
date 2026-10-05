/** Styles for BonusWalletRequestsScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  chipsRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center', marginTop: spacing(3) },
  chipsLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
  summaryChip: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  summaryText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  reportBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
});
