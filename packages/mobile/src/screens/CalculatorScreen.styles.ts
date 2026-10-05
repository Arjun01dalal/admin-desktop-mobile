/** Styles for CalculatorScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: 'transparent' },
  display: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: spacing(6),
  },
  displayText: { color: colors.foreground, fontSize: 64, fontWeight: '300' },
  pad: { padding: spacing(3), paddingBottom: spacing(5) },
  row: { flexDirection: 'row' },
  key: {
    flex: 1,
    margin: spacing(1.5),
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.foreground, fontSize: 26, fontWeight: '500' },
});
