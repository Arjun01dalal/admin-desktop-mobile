/** Styles for SosAlertOverlay — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(127,29,29,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1c1917',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.destructive,
    padding: spacing(6),
    alignItems: 'center',
  },
  icon: { fontSize: 44, marginBottom: spacing(2) },
  title: {
    color: colors.destructive,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing(3),
  },
  line: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: spacing(2) },
  bold: { fontWeight: '800' },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing(5),
  },
  ackBtn: {
    backgroundColor: colors.destructive,
    borderRadius: radius.md,
    paddingHorizontal: spacing(8),
    paddingVertical: spacing(3),
  },
  ackText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
