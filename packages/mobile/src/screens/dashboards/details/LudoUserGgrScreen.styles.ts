/** Styles for LudoUserGgrScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  filterLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  chips: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  emptyChip: { color: colors.muted, fontSize: 12 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  summaryItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing(1),
  },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loaderText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
