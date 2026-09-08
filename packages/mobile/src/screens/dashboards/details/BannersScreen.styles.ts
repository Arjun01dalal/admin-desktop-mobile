/** Styles for BannersScreen — shared presets from styles/common plus screen-specific keys. */
import { StyleSheet } from 'react-native';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  actionRow: { marginTop: spacing(3), flexGrow: 0 },
  actionRowContent: { gap: spacing(2), paddingRight: spacing(2) },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
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
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '100%',
  },
  modalScroll: { flexGrow: 0 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  pickBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  pickBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  previewImage: {
    width: '100%',
    height: 160,
    marginTop: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  videoHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing(2),
  },
});
