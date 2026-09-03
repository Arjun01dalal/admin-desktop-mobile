import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createAppTheme, type AppPaletteMode } from '@/theme';

export type ColorModePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'astro-color-mode-preference';

type ColorModeContextValue = {
  /** User preference: system | light | dark (default dark). */
  preference: ColorModePreference;
  /** Resolved palette after system preference. */
  resolved: AppPaletteMode;
  setPreference: (next: ColorModePreference) => void;
  theme: ReturnType<typeof createAppTheme>;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readStoredPreference(): ColorModePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function getSystemMode(): AppPaletteMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyDomMode(mode: AppPaletteMode) {
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.style.colorScheme = mode;
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ColorModePreference>(() =>
    readStoredPreference(),
  );
  const [systemMode, setSystemMode] = useState<AppPaletteMode>(() => getSystemMode());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemMode(mq.matches ? 'dark' : 'light');
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: AppPaletteMode = preference === 'system' ? systemMode : preference;

  useEffect(() => {
    applyDomMode(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ColorModePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = useMemo(() => createAppTheme(resolved), [resolved]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, theme }),
    [preference, resolved, setPreference, theme],
  );

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    throw new Error('useColorMode must be used within ColorModeProvider');
  }
  return ctx;
}
