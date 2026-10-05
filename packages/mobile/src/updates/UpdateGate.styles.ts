/** Styles for UpdateGate — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing(5),
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    alignItems: 'center',
  },
  icon: { fontSize: 40, marginBottom: spacing(2) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginBottom: spacing(2) },
  body: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
    lineHeight: 20,
  },
  error: { color: colors.destructive, fontSize: 13, textAlign: 'center', marginBottom: spacing(3) },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 15 },
  laterBtn: { marginTop: spacing(3), paddingVertical: spacing(1) },
  laterText: { color: colors.muted, fontSize: 14 },
  downloading: { color: colors.muted, fontSize: 13, marginTop: spacing(3) },
});
