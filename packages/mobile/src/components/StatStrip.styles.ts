import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  stat: {
    minWidth: 72,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  value: { marginTop: 2, color: colors.foreground, fontSize: 17, fontWeight: '800' },
});
