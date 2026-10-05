/** Styles for PlaceholderScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    padding: spacing(5),
  },
  card: { alignItems: 'center', gap: spacing(2) },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14 },
});
