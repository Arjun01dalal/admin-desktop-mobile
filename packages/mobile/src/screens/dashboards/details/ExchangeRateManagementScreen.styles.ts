/** Styles for ExchangeRateManagementScreen — shared presets from styles/common plus screen-specific keys. */
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
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  cardHead: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    padding: spacing(2),
    marginBottom: spacing(2),
    alignItems: 'center',
  },
  cardTitle: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  tournament: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  tournamentStrong: { color: colors.foreground, fontWeight: '700' },
  market: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.sm,
    padding: spacing(2),
    marginBottom: spacing(1.5),
  },
  marketName: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  marketMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  strong: { fontWeight: '800', color: colors.foreground },
  moreBtn: { alignItems: 'center', paddingVertical: spacing(2) },
  moreBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  totalPl: {
    color: colors.foreground,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing(1),
  },
});
