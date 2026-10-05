/** Styles for GameUserStatsScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: spacing(6) },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginTop: spacing(2),
  },
  metaChip: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  // Wider two-up cards than the shared three-up default.
  totalsCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  totalsLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  totalsValue: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginTop: spacing(1) },
  // Boxed empty state rather than the shared bare-text one.
  empty: {
    color: colors.muted,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
});
