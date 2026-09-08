/**
 * Shared screen style presets.
 *
 * Every detail screen re-declared the same ~50 keys (`screen`, `content`, `card`,
 * `chip`, `pager`, `modalSheet`, …). They live here once; screens compose them
 * with `makeStyles` and only declare what is genuinely screen-specific.
 *
 * IMPORTANT: like every other style module, `StyleSheet.create` runs at import
 * time and bakes the active palette. This file must only be imported from screen
 * and component modules, i.e. after `applyStoredTheme()` has run (see theme.ts).
 */
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

type AnyStyle = ViewStyle | TextStyle | ImageStyle;

/** Translucent destructive/success washes used for banners and pills. */
export const tint = {
  destructive: 'rgba(239,68,68,0.12)',
  success: 'rgba(34,197,94,0.12)',
  primary: 'rgba(37,99,235,0.12)',
  scrim: 'rgba(0,0,0,0.5)',
} as const;

export const common = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6) },

  // ── Typography ────────────────────────────────────────────────────────────
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  empty: { color: colors.muted, fontSize: 13, marginTop: spacing(4), textAlign: 'center' },

  // ── Feedback ──────────────────────────────────────────────────────────────
  errorBox: {
    // Literal (not `tint.destructive`) so the codemod can match existing screens.
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },

  // ── Cards ─────────────────────────────────────────────────────────────────
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1, minWidth: 0 },
  cardTitleLink: { color: colors.primary, textDecorationLine: 'underline' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },

  // ── Chips / toggles ───────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(2),
    marginBottom: spacing(1),
  },
  chip: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },

  // ── Status pills ──────────────────────────────────────────────────────────
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: '40%',
  },
  statusOn: { color: colors.success, backgroundColor: tint.success },
  statusOff: { color: colors.destructive, backgroundColor: tint.destructive },

  // ── Metric / totals grid ──────────────────────────────────────────────────
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  totalsCard: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
  },
  totalsLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  totalsValue: { color: colors.foreground, fontSize: 13, fontWeight: '800', marginTop: 2 },

  // ── Forms ─────────────────────────────────────────────────────────────────
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  inputError: { borderColor: colors.destructive },
  searchRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  // ── Modals / bottom sheets ────────────────────────────────────────────────
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },

  // ── Pagination ────────────────────────────────────────────────────────────
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
});

export type CommonStyles = typeof common;

/**
 * Compose the shared presets with screen-specific styles.
 *
 * Keys declared in `extra` win, so a screen can override a preset (e.g. a
 * square `chip`) without forking the whole sheet. Usage stays identical to a
 * plain `StyleSheet.create` — `styles.title`, `styles.myOwnKey`, etc.
 */
export function makeStyles<T extends Record<string, AnyStyle>>(extra: T): CommonStyles & T {
  return { ...common, ...StyleSheet.create(extra) };
}
