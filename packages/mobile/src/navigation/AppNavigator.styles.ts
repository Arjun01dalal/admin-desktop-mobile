/** Styles for AppNavigator — header chrome only (no drawer). */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  headerIconBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
