/** Styles for LiveMatchBookFilters — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  wrap: { gap: spacing(2), marginBottom: spacing(2) },
  row: { flexDirection: 'row', gap: spacing(2) },
  field: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  fieldLabel: { color: colors.muted, fontSize: 11, marginBottom: 2 },
  fieldValue: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  sortRow: { flexDirection: 'row', gap: spacing(2) },
  sortBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  sortBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  sortText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  sortTextActive: { color: colors.primaryForeground },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(4),
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  sheetList: { maxHeight: 420 },
  option: {
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { color: colors.foreground, fontSize: 15 },
});
