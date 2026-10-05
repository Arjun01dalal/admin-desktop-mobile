/** Styles for TermsAndConditionsScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  backBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(1), minWidth: 64 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  headerRight: { width: 64 },
  title: {
    flex: 1,
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(6),
    gap: spacing(3),
    alignItems: 'center',
  },
  logo: { width: 64, height: 64, marginTop: spacing(1) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(1),
  },
  paragraph: {
    alignSelf: 'stretch',
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 22,
  },
});
