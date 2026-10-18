/**
 * Theme context — persists mode, applies palette, then reloads JS so every
 * legacy StyleSheet (baked at import) picks up the new colors.
 * Screens migrated to `useStyles` update from context; full reload covers the rest.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';
import {
  applyStoredTheme,
  applyThemeMode,
  colors as mutableColors,
  getThemeMode,
  isDarkTheme,
  reloadAppForTheme,
  setThemeMode,
  type ThemeMode,
} from '../../theme';
import { type ThemeColors } from '../../themeTokens/palettes';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  /** Persist, apply, and reload so the whole app reflects the theme. */
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function snapshotColors(): ThemeColors {
  return { ...mutableColors };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode());
  const [isDark, setIsDark] = useState(() => isDarkTheme());
  const [palette, setPalette] = useState<ThemeColors>(snapshotColors);

  const syncFromStore = useCallback(() => {
    applyStoredTheme();
    setModeState(getThemeMode());
    setIsDark(isDarkTheme());
    setPalette(snapshotColors());
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    await setThemeMode(next);
    applyThemeMode(next);
    setModeState(next);
    setIsDark(isDarkTheme());
    setPalette(snapshotColors());
    // Most screens still bake colors in StyleSheet at import — reload applies theme app-wide.
    await reloadAppForTheme();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (getThemeMode() !== 'system') return;
      const before = isDarkTheme();
      syncFromStore();
      if (before !== isDarkTheme()) {
        void reloadAppForTheme({ silent: true });
      }
    });
    return () => sub.remove();
  }, [syncFromStore]);

  const value = useMemo(
    () => ({ mode, isDark, colors: palette, setMode }),
    [mode, isDark, palette, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback before provider mounts (boot splash).
    return {
      mode: getThemeMode(),
      isDark: isDarkTheme(),
      colors: snapshotColors(),
      setMode: async (next) => {
        await setThemeMode(next);
        applyThemeMode(next);
        await reloadAppForTheme();
      },
    };
  }
  return ctx;
}
