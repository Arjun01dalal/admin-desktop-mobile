/** Styles for AppNavigator — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, radius, spacing } from '../theme';

export const styles = makeStyles({
  drawerRoot: { flex: 1, backgroundColor: colors.surface },
  drawerStickyTop: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing(2),
  },
  drawerScroll: { flex: 1, backgroundColor: colors.surface },
  drawerScrollContent: {
    // Override DrawerContentScrollView defaults — parent SafeAreaView
    // already clears notch / home-indicator / side insets.
    paddingTop: spacing(1),
    paddingBottom: spacing(3),
    paddingStart: spacing(1),
    paddingEnd: spacing(1),
  },
  drawerHeader: {
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
  },
  drawerTitle: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  drawerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  drawerSearchWrap: {
    marginHorizontal: spacing(2.5),
    position: 'relative',
    justifyContent: 'center',
  },
  drawerSearch: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingRight: spacing(9),
    paddingVertical: spacing(3),
    fontSize: 14,
    minHeight: 46,
  },
  drawerSearchClear: {
    position: 'absolute',
    right: spacing(2),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerSearchClearText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  drawerItem: {
    marginVertical: 0,
    marginHorizontal: spacing(1),
    borderRadius: radius.sm,
    paddingVertical: 0,
    minHeight: 40,
  },
  drawerItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: -8,
  },
  headerIconBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerNoMatch: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: spacing(3),
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  drawerVersion: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
