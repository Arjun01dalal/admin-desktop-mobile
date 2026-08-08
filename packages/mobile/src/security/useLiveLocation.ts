/**
 * useLiveLocation — fetch device location continuously while authenticated.
 *
 * Hard-blocks the panel when Location is off or permission is denied
 * (desktop LocationProvider parity). Polls until location is available again.
 * No-ops on web.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type LiveLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: number;
};

const LOCATION_OFF_MESSAGE =
  'Location is turned off. Turn Location ON in System Settings to use the panel.';

const PERMISSION_DENIED_MESSAGE =
  'Location permission denied. Allow Location for Astro in System Settings.';

type LocationFailureKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

type LocationFailure = {
  kind: LocationFailureKind;
  message: string;
};

function isHardLocationOff(failure: LocationFailure): boolean {
  return failure.kind === 'denied' || failure.kind === 'unavailable';
}

function toLiveLocation(pos: Location.LocationObject): LiveLocation {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    at: pos.timestamp,
  };
}

async function tryOsLocation(): Promise<LiveLocation> {
  if (Platform.OS === 'web') {
    throw {
      kind: 'unsupported',
      message: 'Geolocation is not supported in this app.',
    } satisfies LocationFailure;
  }

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    throw {
      kind: 'unavailable',
      message: LOCATION_OFF_MESSAGE,
    } satisfies LocationFailure;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.status !== 'granted') {
      throw {
        kind: 'denied',
        message: PERMISSION_DENIED_MESSAGE,
      } satisfies LocationFailure;
    }
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return toLiveLocation(pos);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('denied') || message.includes('permission')) {
      throw {
        kind: 'denied',
        message: PERMISSION_DENIED_MESSAGE,
      } satisfies LocationFailure;
    }
    if (
      message.includes('disabled') ||
      message.includes('unavailable') ||
      message.includes('turned off') ||
      message.includes('location services')
    ) {
      throw {
        kind: 'unavailable',
        message: LOCATION_OFF_MESSAGE,
      } satisfies LocationFailure;
    }
    throw {
      kind: 'timeout',
      message: 'Could not get device location. Checking again…',
    } satisfies LocationFailure;
  }
}

export function useLiveLocation(enabled: boolean): {
  location: LiveLocation | null;
  blocked: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
  openSettings: () => void;
} {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationRef = useRef<LiveLocation | null>(null);
  const inflightRef = useRef<Promise<LiveLocation | null> | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const blockForLocationOff = useCallback((message: string) => {
    setLocation(null);
    locationRef.current = null;
    setError(message);
    setBlocked(true);
    watcher.current?.remove();
    watcher.current = null;
  }, []);

  const markSuccess = useCallback((next: LiveLocation) => {
    setLocation(next);
    locationRef.current = next;
    setError(null);
    setBlocked(false);
  }, []);

  const startWatch = useCallback(async () => {
    if (Platform.OS === 'web' || watcher.current) return;
    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 25 },
        (pos) => {
          markSuccess(toLiveLocation(pos));
        },
      );
      watcher.current = sub;
    } catch {
      /* watch is best-effort; polling / getCurrent covers hard failures */
    }
  }, [markSuccess]);

  const requestLocation = useCallback(
    async (options?: { force?: boolean }) => {
      if (!enabled || Platform.OS === 'web') return locationRef.current;
      if (locationRef.current && !options?.force) return locationRef.current;
      if (inflightRef.current) return inflightRef.current;

      const run = (async () => {
        setLoading(true);
        try {
          const next = await tryOsLocation();
          markSuccess(next);
          await startWatch();
          return next;
        } catch (err) {
          const failure = err as LocationFailure;
          if (isHardLocationOff(failure)) {
            blockForLocationOff(failure.message);
            return null;
          }

          // Soft failure (timeout): keep existing coords if any; otherwise block.
          if (locationRef.current) {
            setError(null);
            setBlocked(false);
            return locationRef.current;
          }

          const message =
            failure?.message ||
            'Could not get location. Enable Location Services and try again.';
          setError(message);
          setBlocked(true);
          return null;
        } finally {
          setLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = run;
      return run;
    },
    [blockForLocationOff, enabled, markSuccess, startWatch],
  );

  const retry = useCallback(() => {
    void requestLocation({ force: true });
  }, [requestLocation]);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {});
  }, []);

  // Initial + whenever auth enables location tracking.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setBlocked(false);
      setError(null);
      setLocation(null);
      locationRef.current = null;
      watcher.current?.remove();
      watcher.current = null;
      return;
    }

    void requestLocation({ force: true });

    return () => {
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [enabled, requestLocation]);

  // While blocked, poll so the panel unlocks as soon as Location is turned on.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || !blocked) return;

    const id = setInterval(() => {
      void requestLocation({ force: true });
    }, 2500);

    return () => clearInterval(id);
  }, [blocked, enabled, requestLocation]);

  // Recheck when returning to the app if we still have no location.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (locationRef.current && !blocked) return;
      void requestLocation({ force: true });
    });

    return () => sub.remove();
  }, [blocked, enabled, requestLocation]);

  // While using the panel with a location, detect if Location Services are turned off.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || !location) return;

    let cancelled = false;

    const watch = async () => {
      try {
        await tryOsLocation();
      } catch (err) {
        if (cancelled) return;
        const failure = err as LocationFailure;
        if (isHardLocationOff(failure)) {
          blockForLocationOff(failure.message);
        }
      }
    };

    const id = setInterval(() => {
      void watch();
    }, 12_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [blockForLocationOff, enabled, location]);

  return {
    location,
    blocked: enabled && Platform.OS !== 'web' ? blocked : false,
    loading,
    error,
    retry,
    openSettings,
  };
}
