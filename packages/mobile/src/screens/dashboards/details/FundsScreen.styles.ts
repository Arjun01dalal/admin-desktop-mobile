/** Styles for FundsScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  backLink: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: spacing(2),
  },
  totalBox: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  totalText: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  midGroupsBtn: {
    marginTop: spacing(2),
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  midGroupsBtnText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },
  kpiWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  kpiBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  kpiText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  downloadChip: { borderColor: colors.primary },
  downloadChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  cardDisabled: { opacity: 0.55 },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '50%',
    textAlign: 'right',
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '40%' },
});
