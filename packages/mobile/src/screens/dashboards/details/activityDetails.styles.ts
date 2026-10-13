/** Shared detail styles for GameActivityDetailsScreen and PlayerActivityDetailsScreen. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: spacing(6) },
  // Boxed empty state rather than the shared bare-text one.
  empty: {
    color: colors.muted,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
});
