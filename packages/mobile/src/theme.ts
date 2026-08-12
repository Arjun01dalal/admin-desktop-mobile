/**
 * App theme — dark (default, matches desktop panel) and light palettes.
 *
 * Screens do `StyleSheet.create` with `colors` at module load, so the active
 * palette must be applied (via `applyStoredTheme`) BEFORE any screen module
 * is imported. App.tsx hydrates storage, applies the theme, then lazily
 * requires the app root. Changing the theme therefore requires a JS reload
 * (the picker in the drawer triggers one automatically).
 */
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appStorage } from './lib/webShim';

export type ThemeMode = 'dark' | 'light' | 'system';

const darkColors = {
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

const lightColors: typeof darkColors = {
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

/** Mutable palette — mutated in place by applyStoredTheme before screens load. */
export const colors = { ...darkColors };

let dark = true;

export function isDarkTheme(): boolean {
  return dark;
}

const THEME_KEY = 'theme_mode';

export function getThemeMode(): ThemeMode {
  const v = appStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'system' ? v : 'dark';
}

/**
 * Persist the theme choice and resolve only once it is actually written to
 * disk — the caller reloads the JS bundle right after, and a fire-and-forget
 * write can be lost, making the theme "not change".
 */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  appStorage.setItem(THEME_KEY, mode);
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    /* in-memory value still applies for this session */
  }
}

/** Resolve + apply the stored mode. Call after hydrateStorage(), before UI loads. */
export function applyStoredTheme(): void {
  const mode = getThemeMode();
  const system = Appearance.getColorScheme();
  dark = mode === 'dark' || (mode === 'system' && system !== 'light');
  Object.assign(colors, dark ? darkColors : lightColors);
}

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
};
