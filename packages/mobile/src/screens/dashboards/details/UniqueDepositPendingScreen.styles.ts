/**
 * Styles for UniqueDepositPendingScreen — shared presets from styles/common plus
 * screen-specific keys for the dual-summary polish (summary cards, region/gateway
 * chips, By State modal, live-poll indicator) and the comment/status input modal.
 */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  // ── Generic row/label (MID chip row inside DetailFilterBar children) ──────
  row: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  midScrollContent: { gap: spacing(2), alignItems: 'center', paddingRight: spacing(2) },

  // ── Compact Total / Pending / Approved summary cards ───────────────────────
  summaryScroll: { marginTop: spacing(3) },
  summaryScrollContent: { gap: spacing(2), paddingRight: spacing(2) },
  summaryCard: {
    minWidth: 136,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2.5),
    paddingLeft: spacing(3.5),
    overflow: 'hidden',
  },
  summaryCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  summaryCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  summaryStatsRow: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(1.5) },
  summaryStat: { minWidth: 0 },
  summaryStatLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryStatValue: { color: colors.foreground, fontSize: 13, fontWeight: '800', marginTop: 2 },

  // ── South / North + gateway chips (shared pill look) ──────────────────────
  regionRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  gatewayScroll: { marginTop: spacing(2) },
  gatewayScrollContent: { gap: spacing(2), alignItems: 'center', paddingRight: spacing(2) },
  clearChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: 'transparent',
  },
  clearChipText: { color: colors.destructive, fontSize: 12, fontWeight: '700' },

  // ── Utility row: By State button + Download chip + Live indicator ─────────
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
    marginBottom: spacing(4),
  },
  cardSpaced: { marginBottom: spacing(2.5) },
  byStateBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  byStateBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  downloadChip: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  downloadChipText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '700' },
  // ── By State modal ──────────────────────────────────────────────────────
  byStateModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    maxHeight: '85%',
    flexShrink: 1,
  },
  byStateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexShrink: 0,
  },
  byStateModalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1 },
  byStateScroll: { flexGrow: 0, flexShrink: 1 },
  byStateList: {
    gap: spacing(2),
    paddingTop: spacing(2),
    // Extra bottom so the last card clears home-indicator / sheet edge.
    paddingBottom: spacing(12),
  },
  byStateRow: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    gap: spacing(1.5),
  },
  byStateRowActive: { borderColor: colors.primary, borderWidth: 2 },
  byStateRowTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  byStateRowTitleActive: { color: colors.primary },
  byStateGroupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2.5) },
  byStateGroup: { flexGrow: 1, minWidth: '28%' },
  byStateGroupLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  byStateGroupValue: { color: colors.foreground, fontSize: 11, fontWeight: '700', marginTop: 2 },
  byStateEmpty: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: spacing(6) },

  // ── Row/card leftovers still used ───────────────────────────────────────
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

  // ── Comment / Change-status input modal ────────────────────────────────
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(6),
    gap: spacing(2),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1 },
  modalClose: { color: colors.muted, fontSize: 18, paddingHorizontal: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(3),
  },
});
