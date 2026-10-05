/** Styles for HistoryFilterBar — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  collapseWrap: { marginBottom: spacing(2) },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  collapseTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  collapseChevron: { color: colors.muted, fontSize: 12, marginLeft: spacing(2) },
  collapseBody: { paddingTop: spacing(2) },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  cell: { width: '48%', flexGrow: 1 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.75),
    fontSize: 13,
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  searchBtn: {
    marginTop: spacing(1.5),
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.75),
  },
});
