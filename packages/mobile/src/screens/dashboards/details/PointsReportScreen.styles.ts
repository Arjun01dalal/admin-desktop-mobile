/** Styles for PointsReportScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  coinCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  coinTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  coinRow: { flexDirection: 'row', alignItems: 'center' },
  coinInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
  },
  coinBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  coinBtnDisabled: { opacity: 0.5 },
  coinBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  coinMsg: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
});
