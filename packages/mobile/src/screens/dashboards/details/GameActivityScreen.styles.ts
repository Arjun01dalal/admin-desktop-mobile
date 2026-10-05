/** Styles for GameActivityScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  toggleRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  lockedLabel: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing(3) },
  cardCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  cardCheckOn: { borderColor: colors.primary, backgroundColor: 'rgba(37,99,235,0.12)' },
  cardCheckText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  cardCheckTextOn: { color: colors.primary },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  selectAllBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  selectAllText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
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
});
