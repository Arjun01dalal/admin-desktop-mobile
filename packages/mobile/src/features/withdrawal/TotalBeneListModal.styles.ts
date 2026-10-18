/** Styles for TotalBeneListModal — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(5),
    paddingBottom: spacing(4),
    gap: spacing(2.5),
  },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: spacing(0.5) },
  state: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  scroll: { maxHeight: 420 },
  summaryRow: {
    gap: spacing(1),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  summaryText: { color: colors.foreground, fontSize: 13 },
  bold: { fontWeight: '700' },
  error: { color: '#dc2626', fontSize: 12, marginBottom: spacing(1) },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: spacing(4) },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    marginBottom: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  rowTitle: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  rowMeta: { color: colors.muted, fontSize: 12 },
  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing(1),
  },
  closeBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
});
