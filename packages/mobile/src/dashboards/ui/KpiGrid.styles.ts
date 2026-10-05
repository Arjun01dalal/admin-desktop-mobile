/** Styles for KpiGrid — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  tile: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    minHeight: 74,
    justifyContent: 'space-between',
  },
  tileTappable: { borderColor: colors.primary },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  labelLink: { color: colors.primary },
  value: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: spacing(1) },
});
