/** Styles for PlayerRtpScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  unavailableCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
  winPill: {
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    color: colors.foreground,
    overflow: 'hidden',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  infoBox: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  infoText: { color: colors.foreground, fontSize: 13 },
});
