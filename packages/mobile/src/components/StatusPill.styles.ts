/** Shared status / disposition pills used by Gtel Calls + C2C Campaign. */
import { makeStyles } from '../styles/common';
import { radius, spacing } from '../theme';

export const styles = makeStyles({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
