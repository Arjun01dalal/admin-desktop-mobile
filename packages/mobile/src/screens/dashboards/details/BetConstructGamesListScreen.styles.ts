/** Styles for BetConstructGamesListScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  summaryCard: {
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
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing(1),
  },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
});
