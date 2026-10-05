/** Styles for DepositWithdrawalMidModal — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: spacing(3) },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingVertical: spacing(8),
    paddingHorizontal: spacing(3),
  },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  errorText: { color: colors.destructive, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#ff9f0a',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  headCell: {
    color: '#1a1200',
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  bodyCell: {
    color: colors.foreground,
    fontSize: 13,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  midCol: { flex: 1.2 },
  amountCol: { flex: 1, textAlign: 'right' },
  midText: { fontWeight: '700' },
  footer: {
    padding: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
});
