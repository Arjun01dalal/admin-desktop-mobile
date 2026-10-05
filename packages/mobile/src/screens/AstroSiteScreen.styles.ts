/** Styles for AstroSiteScreen — shared presets from styles/common plus screen-specific keys. */
import { makeStyles } from '../styles/common';
import { colors, spacing } from '../theme';

export const styles = makeStyles({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  frame: { flex: 1, backgroundColor: '#0b0b0f' },
  webview: { flex: 1, backgroundColor: '#0b0b0f' },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    zIndex: 2,
    backgroundColor: '#0b0b0f',
  },
  loaderText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: {
    height: 52,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#121218',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
