/** Styles for SosBlockedUsersScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, spacing } from '../../../theme';

export const styles = makeStyles({
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 8,
    padding: spacing(3),
    marginTop: spacing(3),
  },
});
