/** Static light/dark palettes — no React dependency. */

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  success: string;
};

export const darkColors: ThemeColors = {
  background: '#0b0f14',
  surface: '#121820',
  surfaceAlt: '#1a2230',
  border: '#243040',
  foreground: '#e6edf3',
  muted: '#8b98a5',
  primary: '#f5b301',
  primaryForeground: '#1a1200',
  destructive: '#ef4444',
  success: '#22c55e',
};

export const lightColors: ThemeColors = {
  background: '#f4f6f9',
  surface: '#ffffff',
  surfaceAlt: '#eaeef4',
  border: '#d5dce6',
  foreground: '#101828',
  muted: '#5d6b7d',
  primary: '#c47f00',
  primaryForeground: '#ffffff',
  destructive: '#dc2626',
  success: '#16a34a',
};
