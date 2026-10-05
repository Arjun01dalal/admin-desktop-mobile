/** Styles for UtrProviderScreen — shared presets from styles/common plus screen-specific keys. */
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
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(12),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  modalSheet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md * 2,
    padding: spacing(4),
    gap: spacing(2),
    maxHeight: '100%',
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: spacing(2), paddingBottom: spacing(1) },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
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
