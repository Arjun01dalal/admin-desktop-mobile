/** Styles for DateField — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    justifyContent: 'center',
  },
  inputDisabled: { opacity: 0.5 },
  valueText: { color: colors.foreground, fontSize: 13 },
  placeholderText: { color: colors.muted, fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(2),
  },
  iosPicker: {
    transform: [{ scale: 0.85 }],
    marginVertical: -spacing(4),
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginTop: spacing(2),
  },
  doneText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
});
