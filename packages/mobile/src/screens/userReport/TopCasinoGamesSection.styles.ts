/** Styles for TopCasinoGamesSection — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  wrap: {
    marginBottom: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flex: 1 },
  chevron: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', color: colors.foreground, flex: 1 },
  count: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(2.5),
  },
  loader: { paddingVertical: spacing(3) },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: spacing(3) },
  row: {
    paddingVertical: spacing(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  refreshBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing(2),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
});
