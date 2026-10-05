/** Styles for UI — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(4),
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  errorText: { color: '#fca5a5', fontSize: 14 },
});
