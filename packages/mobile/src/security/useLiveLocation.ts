/**
 * useLiveLocation — fetch device location continuously while authenticated.
 *
 * Requests permission, starts a watch, and also re-reads on every app
 * foreground so location is always fresh for audit/compliance. No-ops on web.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';

export type LiveLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: number;
};

export function useLiveLocation(enabled: boolean): {
  location: LiveLocation | null;
  denied: boolean;
} {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [denied, setDenied] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let cancelled = false;

    const read = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          at: pos.timestamp,
        });
      } catch {
        /* transient — keep last known */
      }
    };

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      if (cancelled) return;
      setDenied(false);
      await read();
      if (cancelled) return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 25 },
        (pos) => {
          if (cancelled) return;
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            at: pos.timestamp,
          });
        },
      );
      // If cleanup ran while awaiting, remove the just-created watcher.
      if (cancelled) {
        sub.remove();
        return;
      }
      watcher.current = sub;
    })();

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void read();
    });

    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
      appSub.remove();
    };
  }, [enabled]);

  return { location, denied };
}
