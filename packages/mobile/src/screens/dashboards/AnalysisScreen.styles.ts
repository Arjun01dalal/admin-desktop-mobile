/** Styles for AnalysisScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loading: { paddingVertical: spacing(8), alignItems: 'center' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(3),
  },
  monthBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  monthBtnText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  monthLabel: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    minWidth: '47%',
    flexGrow: 1,
  },
  statLabel: { color: colors.muted, fontSize: 12, marginBottom: spacing(1) },
  statValue: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  section: { marginBottom: spacing(4) },
  sectionTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  tableBlock: { marginTop: spacing(2) },
  jsonBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  jsonText: { color: colors.muted, fontSize: 11, fontFamily: 'monospace' },
  tableTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
});
