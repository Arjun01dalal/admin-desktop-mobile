/** Styles for ActiveBotUsersScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, spacing } from '../../../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: colors.background },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loadingBox: { paddingVertical: spacing(8), alignItems: 'center' as const },
});
