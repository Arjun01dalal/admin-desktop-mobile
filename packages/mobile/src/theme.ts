/**
 * App theme — dark (default) and light palettes.
 *
 * Prefer `useTheme` / `useStyles` from `@features/theme` for runtime updates.
 * Legacy screens still bake `colors` into StyleSheet at import time — those
 * pick up the palette applied via `applyStoredTheme()` before AppRoot loads.
 */
import { Alert, Appearance, DevSettings, InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { appStorage } from './lib/webShim';
import { darkColors, lightColors, type ThemeColors } from './themeTokens/palettes';
import { resolveDark, type ThemeMode } from './themeTokens/resolveDark';

export type { ThemeMode, ThemeColors };
export { darkColors, lightColors, resolveDark };

/** Mutable palette — mutated by applyStoredTheme / applyThemeMode. */
export const colors: ThemeColors = { ...darkColors };

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
 * Persist the theme choice. Resolves after disk write so a subsequent reload
 * cannot race and lose the preference.
 */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  appStorage.setItem(THEME_KEY, mode);
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    /* in-memory value still applies for this session */
  }
}

/** Apply a mode to the mutable `colors` export (and dark flag). */
export function applyThemeMode(mode: ThemeMode): void {
  dark = resolveDark(mode, Appearance.getColorScheme());
  Object.assign(colors, dark ? darkColors : lightColors);
}

/** Resolve + apply the stored mode. Call after hydrateStorage(), before UI loads. */
export function applyStoredTheme(): void {
  applyThemeMode(getThemeMode());
}

/**
 * Optional full JS reload — only needed for legacy StyleSheets that still bake
 * colors at module load. Prefer ThemeProvider + useStyles instead.
 */
export async function reloadAppForTheme(opts?: { silent?: boolean }): Promise<void> {
  if (Platform.OS === 'web') {
    (globalThis as { location?: { reload: () => void } }).location?.reload();
    return;
  }

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });

  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';

  try {
    if (inExpoGo || __DEV__) {
      if (typeof DevSettings?.reload === 'function') {
        DevSettings.reload();
        return;
      }
    } else {
      const { restart } = await import('react-native-stallion');
      restart();
      return;
    }
  } catch {
    /* fall through */
  }

  if (!opts?.silent) {
    Alert.alert('Theme saved', 'Close and reopen the app to apply the new theme on all screens.');
  }
}

/**
 * When preference is System, re-apply + reload if the OS scheme changes
 * (StyleSheets bake colors at module load, so a remount alone is not enough).
 */
export function watchSystemThemeChanges(): () => void {
  const sub = Appearance.addChangeListener(() => {
    if (getThemeMode() !== 'system') return;
    const nextDark = resolveDark('system', Appearance.getColorScheme());
    if (nextDark === dark) return;
    applyThemeMode('system');
    void reloadAppForTheme({ silent: true });
  });
  return () => sub.remove();
}

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
};
