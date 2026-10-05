/** Styles for SplashScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
  },
  logo: { width: 96, height: 96, marginBottom: spacing(4) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(3),
  },
  welcome: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  brand: {
    marginTop: spacing(1),
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#f1a144',
  },
  badge: {
    marginTop: spacing(4),
    backgroundColor: '#000',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(2),
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 13,
  },
});
