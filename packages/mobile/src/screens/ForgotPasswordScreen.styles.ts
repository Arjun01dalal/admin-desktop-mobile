/** Styles for ForgotPasswordScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing(5),
    alignItems: 'center',
  },
  logo: { width: 72, height: 72, marginBottom: spacing(2) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(3),
  },
  card: { width: '100%', maxWidth: 420, gap: spacing(3) },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: spacing(2) },
  info: { color: colors.primary, fontSize: 13, textAlign: 'center' },
});
