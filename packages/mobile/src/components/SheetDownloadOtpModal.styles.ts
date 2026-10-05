/** Styles for SheetDownloadOtpModal — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  backdropTouch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  card: {
    marginHorizontal: spacing(6),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    paddingBottom: spacing(6),
  },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  sendingText: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 16,
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: spacing(3),
  },
  actions: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(4) },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  btnGhostText: { color: colors.foreground, fontWeight: '700', fontSize: 12 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 12 },
});
