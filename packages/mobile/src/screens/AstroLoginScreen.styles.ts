/** Styles for AstroLoginScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollKeyboard: {
    justifyContent: 'flex-start',
  },
  logo: { width: 96, height: 96, marginBottom: spacing(2) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(2),
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
  },
  card: { width: '100%', maxWidth: 420, gap: spacing(3) },
  linksRow: { alignItems: 'flex-end', marginTop: -spacing(2) },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  termsText: { color: colors.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxCheck: { color: colors.primaryForeground, fontWeight: '900', fontSize: 12 },
  forgotWrap: { alignSelf: 'flex-end' },
  loginBtn: { marginTop: spacing(1) },
});
