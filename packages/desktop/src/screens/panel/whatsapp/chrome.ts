import type { Theme } from '@mui/material/styles';

/**
 * WhatsApp chrome colors.
 * Dark values match the existing panel. Light values follow AppShell
 * (#ffffff / #f0f0f2) so the tab tracks the theme switch.
 */
export function waChrome(theme: Theme) {
  const dark = theme.palette.mode === 'dark';
  return {
    dark,
    shell: dark ? '#111116' : '#ffffff',
    sidebar: dark ? '#15151a' : '#ffffff',
    panel: dark ? '#0f0f12' : '#f0f0f2',
    header: dark ? '#15151a' : '#ffffff',
    field: dark ? '#1e1e24' : '#f0f0f2',
    text: dark ? '#e8e8ea' : '#111111',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    borderStrong: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    fieldBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    canvas: dark
      ? 'radial-gradient(ellipse at 20% 0%, #1a2a22 0%, transparent 50%), #0f0f12'
      : 'radial-gradient(ellipse at 20% 0%, #e4f3ec 0%, transparent 50%), #f0f0f2',
    incoming: dark ? '#1f3d32' : '#d8f3e4',
    outgoing: dark ? '#1e1e28' : '#ffffff',
    selected: 'rgba(255,159,10,0.12)',
    sendDisabledBg: dark ? '#333' : '#e6e6ea',
    sendDisabledColor: dark ? '#777' : '#8a8a90',
  };
}
