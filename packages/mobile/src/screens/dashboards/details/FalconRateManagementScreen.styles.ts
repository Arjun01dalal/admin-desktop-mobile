/** Styles for FalconRateManagementScreen — shared presets from styles/common plus screen-specific keys. */
import { StyleSheet } from 'react-native';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  description: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 10,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  loadingBox: { paddingVertical: spacing(8), alignItems: 'center' },
  emptyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(2),
    gap: spacing(2),
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1, fontWeight: '700' },
  rowValue: { fontSize: 13, fontWeight: '800' },
  warning: { color: colors.primary },
  positive: { color: colors.success },
  negative: { color: colors.destructive },
});
