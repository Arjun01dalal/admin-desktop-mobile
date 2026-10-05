/** Styles for ShowMyCoinHistoryScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../../styles/common';
import { colors, spacing } from '../../../theme';

export const styles = makeStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  body: { color: colors.foreground, fontSize: 13, marginBottom: 2 },
  hint: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorText: { color: colors.destructive },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.primary, fontWeight: '600' },
});
