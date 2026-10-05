/** Styles for ActiveExchangePanel — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '800', marginBottom: spacing(1.5) },
  currentLabel: { color: colors.muted, fontSize: 13, marginBottom: spacing(2.5) },
  currentValue: { color: colors.primary, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3), flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  confirmRow: { gap: spacing(2) },
  confirmText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  confirmButtons: { flexDirection: 'row', gap: spacing(2) },
  smallBtn: { height: 40, alignSelf: 'flex-start' },
  message: { marginTop: spacing(2), fontSize: 12, fontWeight: '600' },
  msgError: { color: colors.destructive },
  msgOk: { color: colors.success },
});
