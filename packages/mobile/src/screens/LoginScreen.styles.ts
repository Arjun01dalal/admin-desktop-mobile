/** Styles for LoginScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', padding: spacing(5) },
  card: { gap: spacing(3) },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: spacing(2) },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing(1) },
  roleList: { maxHeight: 260 },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    marginBottom: spacing(2),
  },
  roleOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  roleTextActive: { color: colors.primaryForeground },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  linkMuted: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
