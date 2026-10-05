/** Styles for DepositConfigScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', flex: 1 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  editBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  editBtnText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '28%' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    gap: spacing(2),
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  modalInputDisabled: { opacity: 0.6 },
  modalMsg: { color: colors.destructive, fontSize: 12 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(1),
  },
  saveBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
