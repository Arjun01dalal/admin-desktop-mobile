/** Styles for MobileAppScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1), marginBottom: spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  appCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCode: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing(3) },
});
