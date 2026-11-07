/** Styles for ShowMyCoinHistoryScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, spacing } from '../../../theme';

export const styles = makeStyles({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  link: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  summaryBody: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing(0.5),
  },
  metaHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing(1.5),
  },
});
