/** Styles for NewDepositsScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipsLabel: { color: colors.muted, fontSize: 12 },
  activeChip: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2.5),
    overflow: 'hidden',
  },
  clearChip: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  reportBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
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
});
