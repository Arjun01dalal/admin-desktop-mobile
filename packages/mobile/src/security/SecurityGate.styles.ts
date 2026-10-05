/** Styles for SecurityGate — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(5),
  },
  icon: { fontSize: 48, marginBottom: spacing(3) },
  title: { color: colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: spacing(2) },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
    maxWidth: 320,
  },
  list: { alignSelf: 'stretch', paddingHorizontal: spacing(4) },
  reason: { color: colors.destructive, fontSize: 14, marginBottom: spacing(1) },
  button: {
    marginTop: spacing(5),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
    minWidth: 180,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 15 },
});
