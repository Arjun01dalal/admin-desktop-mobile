/** Styles for DashboardUsersListScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  total: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: spacing(2) },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(2) },
  filterRow: {
    flexDirection: 'row',
    gap: spacing(2),
    alignItems: 'center',
    marginTop: spacing(2),
    paddingRight: spacing(2),
  },
  filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(2),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  cardIndex: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 28,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  cardApp: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 72,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  cardCell: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
  },
  cardCellWide: {
    width: '100%',
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardValue: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  cardAmount: {
    color: colors.primary,
    fontWeight: '700',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(2) },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
});
