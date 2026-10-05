/** Styles for DataTable — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
    overflow: 'hidden',
  },
  tableClip: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  headRow: { borderBottomColor: colors.primary },
  badgeCell: { paddingHorizontal: spacing(0.5) },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeSub: { color: '#fff', fontSize: 10, opacity: 0.9 },
  filterRow: { paddingVertical: spacing(1) },
  filterCell: { paddingHorizontal: spacing(0.5) },
  footerRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.primary },
  headText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: spacing(1),
  },
  cell: {
    color: colors.foreground,
    fontSize: 12,
    paddingHorizontal: spacing(1),
    overflow: 'hidden',
  },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  spinner: { marginVertical: spacing(6) },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(2) },
});
