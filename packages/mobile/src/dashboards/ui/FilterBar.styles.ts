/** Styles for FilterBar — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  row: { gap: spacing(2), alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  datesRow: { flexDirection: 'row', gap: spacing(2) },
  dateField: { flex: 1 },
  dateLabel: { color: colors.muted, fontSize: 11, marginBottom: spacing(1) },
  dateInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(2.5),
  },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  outlineText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
});
