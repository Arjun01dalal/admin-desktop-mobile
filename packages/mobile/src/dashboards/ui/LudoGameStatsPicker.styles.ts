/** Styles for LudoGameStatsPicker — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

const ROW_H = 40;
const GAME_COL_W = 116;
const NUM_COL_W = 78;

export const styles = makeStyles({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    maxWidth: '100%',
  },
  triggerLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  triggerGgr: { fontSize: 13, fontWeight: '800', flexShrink: 0 },
  chevron: { color: colors.muted, fontSize: 12, marginLeft: 'auto' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing(3),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    maxHeight: '80%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetCompact: { padding: spacing(2) },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing(2),
  },
  headerRow: { flexDirection: 'row', alignItems: 'stretch' },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tableScroll: { maxHeight: 320 },
  frozenCol: {
    width: GAME_COL_W,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  metricsViewport: { flexGrow: 1, flexShrink: 1 },
  gameCell: {
    width: GAME_COL_W,
    height: ROW_H,
    justifyContent: 'center',
    paddingHorizontal: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingHorizontal: spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricSelect: { flexDirection: 'row', alignItems: 'center' },
  headerCell: { backgroundColor: colors.surfaceAlt },
  bodyCell: { backgroundColor: 'transparent' },
  rowActive: { backgroundColor: 'rgba(245,179,1,0.12)' },
  th: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  td: { color: colors.foreground, fontSize: 12, fontWeight: '500' },
  tdGame: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  colNum: {
    width: NUM_COL_W,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  ggrCell: { fontWeight: '800', textDecorationLine: 'underline' },
  ggrPos: { color: colors.success },
  ggrNeg: { color: colors.destructive },
  closeBtn: {
    marginTop: spacing(2),
    alignSelf: 'center',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
  },
  closeText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
