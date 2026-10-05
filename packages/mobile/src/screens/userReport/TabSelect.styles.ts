/** Styles for TabSelect — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 180,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: spacing(2.5),
    paddingRight: spacing(2),
    paddingVertical: spacing(1.75),
    gap: spacing(1),
  },
  btnText: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: { color: colors.muted, fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    paddingTop: spacing(3),
    overflow: 'hidden',
  },
  sheetTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(1),
  },
  list: { paddingBottom: spacing(2) },
  row: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.25),
  },
  rowActive: { backgroundColor: `${colors.primary}22` },
  rowText: { color: colors.foreground, fontSize: 14 },
  rowTextActive: { color: colors.primary, fontWeight: '700' },
});
