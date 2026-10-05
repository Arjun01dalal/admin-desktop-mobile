/** Styles for CustomerAllotmentScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  searchWrap: { marginTop: spacing(3) },
  chipRow: { alignItems: 'center', paddingVertical: spacing(1) },
  rowLabel: { color: colors.muted, fontSize: 12, marginRight: spacing(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(2) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
});
