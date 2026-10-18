/** Styles for ValidationDetails — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../../styles/common';
import { colors, radius, spacing } from '../../theme';

export const styles = makeStyles({
  detailsBox: {
    marginTop: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1),
  },
  detailsLabel: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: spacing(0.5),
  },
  group: { marginTop: spacing(0.5), marginBottom: spacing(0.5) },
  groupTitle: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing(0.75),
  },
  nestedBox: {
    marginLeft: spacing(0.5),
    marginTop: spacing(0.75),
    padding: spacing(1.5),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    gap: spacing(0.5),
  },
  objectBox: {
    marginLeft: spacing(0.5),
    padding: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: spacing(0.5),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    paddingVertical: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 96,
    flexShrink: 0,
  },
  value: {
    color: colors.foreground,
    fontSize: 12,
    flex: 1,
  },
  muted: { color: colors.muted, fontSize: 12 },
});
