/** Styles for LiveStreamModal — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
  },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  close: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  scoreBox: {
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: spacing(2),
  },
  streamBox: {
    height: 240,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
});
