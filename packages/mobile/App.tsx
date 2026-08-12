import 'react-native-gesture-handler';
import './src/lib/webShim';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { hydrateStorage } from './src/lib/webShim';
import { applyStoredTheme, colors } from './src/theme';

/**
 * Boot loader: hydrate persisted storage and apply the stored theme BEFORE
 * requiring the app tree — screens capture theme colors in module-scope
 * StyleSheet.create, so the palette must be final before those imports run.
 */
export default function App() {
  const [AppRoot, setAppRoot] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await hydrateStorage();
      } catch {
        /* storage best-effort — fall back to defaults */
      }
      applyStoredTheme();
      // Lazy require so screen modules evaluate AFTER the palette is set.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('./src/AppRoot') as { default: React.ComponentType };
      if (alive) setAppRoot(() => mod.default);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!AppRoot) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return <AppRoot />;
}
