/** Styles for RecordingPlayerModal — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '700' },
  time: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  error: { color: colors.destructive, fontSize: 13, lineHeight: 20 },
  loadingBox: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(2) },
  controls: { alignItems: 'center', paddingVertical: spacing(1) },
  playBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
    minWidth: 120,
    alignItems: 'center',
  },
  playBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignSelf: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  closeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignSelf: 'flex-end',
  },
  closeBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
});
