/** Styles for BothMasterAddScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

export const styles = makeStyles({
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loading: { paddingVertical: spacing(8), alignItems: 'center' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  emptyBox: {
    backgroundColor: colors.surface,
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
  matchName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(3),
  },
  section: { marginBottom: spacing(3) },
  sectionTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  teamLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  teamValue: { color: colors.success, fontSize: 13, fontWeight: '700' },
  negative: { color: colors.destructive },
});
