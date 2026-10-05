/** Styles for OfflineGate — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(5),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#2b2b30',
    borderRadius: radius.lg,
    padding: spacing(5),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing(3),
  },
  icon: { fontSize: 18 },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing(3),
  },
  actions: {
    flexDirection: 'row',
    gap: spacing(2),
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  btnOutlineText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
