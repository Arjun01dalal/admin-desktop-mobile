import 'react-native-gesture-handler';
import './src/lib/webShim';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { hydrateStorage } from './src/lib/webShim';
import { setupSslPinning } from './src/security/sslPins';
import { applyStoredTheme, colors, watchSystemThemeChanges } from './src/theme';

type ComponentWithDefaults = {
  defaultProps?: Record<string, unknown>;
};

/**
 * Keep the app layout independent of the device's system font-size setting.
 * This applies to all native Text/TextInput instances loaded below AppRoot.
 */
function lockNativeFontScaling() {
  const components = [Text, TextInput] as unknown as ComponentWithDefaults[];
  components.forEach((component) => {
    component.defaultProps = {
      ...component.defaultProps,
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
    };
  });
}

lockNativeFontScaling();

/**
 * Boot loader: hydrate persisted storage and apply the stored theme BEFORE
 * requiring the app tree — screens capture theme colors in module-scope
 * StyleSheet.create, so the palette must be final before those imports run.
 */
export default function App() {
  const [AppRoot, setAppRoot] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    let stopWatch: (() => void) | undefined;
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        /* orientation lock best-effort on web / unsupported hosts */
      }
      // SSL pinning before any panel API traffic (bootstrap + /api/generate).
      await setupSslPinning();
      try {
        await hydrateStorage();
      } catch {
        /* storage best-effort — fall back to defaults */
      }
      applyStoredTheme();
      // Lazy require so screen modules evaluate AFTER the palette is set.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('./src/AppRoot') as { default: React.ComponentType };
      if (alive) {
        setAppRoot(() => mod.default);
        // System mode: follow OS light/dark changes (requires JS reload).
        stopWatch = watchSystemThemeChanges();
      }
    })();
    return () => {
      alive = false;
      stopWatch?.();
    };
  }, []);

  if (!AppRoot) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return <AppRoot />;
}
