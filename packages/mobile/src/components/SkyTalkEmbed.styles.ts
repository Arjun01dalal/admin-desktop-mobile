/** Styles for SkyTalkEmbed — shared presets from styles/common plus component-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  frame: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pausedText: {
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.destructive,
    textAlign: 'center',
    paddingHorizontal: spacing(4),
    marginBottom: spacing(3),
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  retryText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },
});
