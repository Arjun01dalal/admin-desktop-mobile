/**
 * useLiveLocation — fetch device location continuously while authenticated.
 *
 * Hard-blocks the panel when Location is off or permission is denied
 * (desktop LocationProvider parity). Polls until location is available again.
 * No-ops on web.
 *
 * Gate path prefers last-known + Low accuracy with a short timeout (desktop uses
 * ~5s / enableHighAccuracy:false). Do NOT hard-fail solely on
 * `hasServicesEnabledAsync()` — some Android OEMs report false negatives while
 * Location is actually ON, which re-blocks the panel every health-check tick.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
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

/** Panel gate only needs a coarse fix — match desktop (5s, low accuracy). */
const GATE_POSITION_TIMEOUT_MS = 6_000;
const GATE_LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;
const GATE_LAST_KNOWN_ACCURACY_M = 5_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/** Android/iOS emulators often have no GPS fix — use a stable fallback so panel isn't blocked. */
function isEmulator(): boolean {
  return !Device.isDevice;
}

function emulatorFallbackLocation(): LiveLocation {
  return {
    lat: 28.6139,
    lng: 77.209,
    accuracy: 50,
    at: Date.now(),
  };
}

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

function classifyPositionError(err: unknown): LocationFailure {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();
  if (message.includes('denied') || message.includes('permission')) {
    return { kind: 'denied', message: PERMISSION_DENIED_MESSAGE };
  }
  if (
    message.includes('disabled') ||
    message.includes('unavailable') ||
    message.includes('turned off') ||
    message.includes('location services')
  ) {
    return { kind: 'unavailable', message: LOCATION_OFF_MESSAGE };
  }
  return {
    kind: 'timeout',
    message: 'Could not get device location. Checking again…',
  };
}

async function ensureForegroundPermission(): Promise<void> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === 'granted') return;

  const requested = await Location.requestForegroundPermissionsAsync();
  if (requested.status !== 'granted') {
    throw {
      kind: 'denied',
      message: PERMISSION_DENIED_MESSAGE,
    } satisfies LocationFailure;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const id = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out`));
    }, ms);

    promise.then(
      (value) => {
        // Late resolve after timeout must be swallowed — otherwise Android can
        // throw uncaught "Array already consumed" from the orphaned native call.
        if (settled) return;
        settled = true;
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

async function tryOsLocation(): Promise<LiveLocation> {
  if (Platform.OS === 'web') {
    throw {
      kind: 'unsupported',
      message: 'Geolocation is not supported in this app.',
    } satisfies LocationFailure;
  }

  // Emulator: never call native GPS. Concurrent/hanging getCurrentPosition on
  // Android emulator commonly surfaces as HostFunction "Array already consumed".
  if (isEmulator()) {
    try {
      await ensureForegroundPermission();
    } catch {
      /* permission optional for local emulator testing */
    }
    return emulatorFallbackLocation();
  }

  try {
    await ensureForegroundPermission();
  } catch (err) {
    throw err;
  }

  // Fast path: last known fix (avoids indoor GPS timeouts / OEM flakes).
  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: GATE_LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: GATE_LAST_KNOWN_ACCURACY_M,
    });
    if (last) return toLiveLocation(last);
  } catch {
    /* continue to live read */
  }

  try {
    // Low accuracy + short timeout unlocks the panel quickly (network/wifi).
    // Balanced GPS can hang 15s+ indoors and is not needed for the gate.
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      }),
      GATE_POSITION_TIMEOUT_MS,
      'getCurrentPosition',
    );
    return toLiveLocation(pos);
  } catch (err) {
    const classified = classifyPositionError(err);

    // Only after a real position failure, consult the services flag — and even
    // then treat it as a hint, not the sole source of truth.
    if (classified.kind === 'timeout') {
      try {
        const servicesOn = await Location.hasServicesEnabledAsync();
        if (!servicesOn) {
          throw {
            kind: 'unavailable',
            message: LOCATION_OFF_MESSAGE,
          } satisfies LocationFailure;
        }
      } catch (inner) {
        if ((inner as LocationFailure)?.kind) throw inner;
      }
    }

    throw classified;
  }
}

/** Lightweight check used while we already have a fix — avoid false re-blocks. */
async function checkLocationStillAllowed(): Promise<LocationFailure | null> {
  // Emulator GPS / services flags are unreliable — never re-block after a fix.
  if (isEmulator()) return null;

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { kind: 'denied', message: PERMISSION_DENIED_MESSAGE };
  }

  // If the OS claims services are off, verify with a position read before
  // blocking (hasServicesEnabledAsync false-negatives are common on Android).
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (servicesOn) return null;

  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: GATE_LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: GATE_LAST_KNOWN_ACCURACY_M,
    });
    if (last) return null;

    await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      }),
      HEALTH_CHECK_TIMEOUT_MS,
      'healthCheckPosition',
    );
    return null;
  } catch (err) {
    const classified = classifyPositionError(err);
    if (classified.kind === 'denied' || classified.kind === 'unavailable') {
      return classified;
    }
    // Soft failure while we still have a cached fix: do not re-block.
    return null;
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
    // Emulator GPS watch is flaky / empty — mock fix is enough for local testing.
    if (Platform.OS === 'web' || watcher.current || isEmulator()) return;
    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Low, timeInterval: 30000, distanceInterval: 50 },
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
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (!enabled || Platform.OS === 'web') return locationRef.current;
      if (locationRef.current && !options?.force) return locationRef.current;
      if (inflightRef.current) return inflightRef.current;

      const run = (async () => {
        if (!options?.silent) setLoading(true);
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
            failure?.message || 'Could not get location. Enable Location Services and try again.';
          setError(message);
          setBlocked(true);
          return null;
        } finally {
          if (!options?.silent) setLoading(false);
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
  // silent: avoid permanent spinner on the Try again button.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || !blocked) return;

    const id = setInterval(() => {
      void requestLocation({ force: true, silent: true });
    }, 2500);

    return () => clearInterval(id);
  }, [blocked, enabled, requestLocation]);

  // Recheck when returning to the app if we still have no location.
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (locationRef.current && !blocked) return;
      void requestLocation({ force: true, silent: true });
    });

    return () => sub.remove();
  }, [blocked, enabled, requestLocation]);

  // While using the panel with a location, detect real Location / permission loss
  // without trusting hasServicesEnabledAsync alone (OEM false negatives).
  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || !location) return;

    let cancelled = false;

    const watch = async () => {
      try {
        const failure = await checkLocationStillAllowed();
        if (cancelled || !failure) return;
        if (isHardLocationOff(failure)) {
          blockForLocationOff(failure.message);
        }
      } catch {
        /* keep existing fix on unexpected errors */
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
