import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'react-toastify';
import type { AddressInfo } from '@/types/gcalc';
import { LocationEnableDialog } from '@/components/LocationEnableDialog';
import { getAuthToken } from '@/utils/authToken';

export type Coords = {
  latitude: number;
  longitude: number;
};

type LocationSource = 'gps' | 'network' | null;

type LocationContextValue = {
  coords: Coords | null;
  address: AddressInfo | null;
  source: LocationSource;
  error: string | null;
  loading: boolean;
  isReady: boolean;
  requestLocation: (options?: { force?: boolean }) => Promise<Coords>;
  openLocationSettings: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

type OsFailure = {
  kind: 'denied' | 'unavailable' | 'timeout' | 'unsupported';
  message: string;
};

const LOCATION_OFF_MESSAGE =
  'Location is turned off. Turn Location ON in System Settings to use the panel.';

function tryOsLocation(timeoutMs = 5000): Promise<Coords> {
  return new Promise((resolve, reject: (err: OsFailure) => void) => {
    if (!navigator.geolocation) {
      reject({
        kind: 'unsupported',
        message: 'Geolocation is not supported in this app.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject({
            kind: 'denied',
            message:
              'Location permission denied. Allow Location for Electron / Astro in System Settings.',
          });
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject({
            kind: 'unavailable',
            message: LOCATION_OFF_MESSAGE,
          });
          return;
        }
        reject({
          kind: 'timeout',
          message:
            'Device GPS timed out (common in Electron). Using network location instead…',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 60_000,
      },
    );
  });
}

async function tryNetworkLocation(): Promise<{
  coords: Coords;
  address: AddressInfo;
}> {
  const result = await window.gcalc?.getIpLocation();
  if (!result?.ok || result.latitude == null || result.longitude == null) {
    throw new Error(result?.message || 'Network location lookup failed');
  }

  return {
    coords: { latitude: result.latitude, longitude: result.longitude },
    address:
      result.address ||
      ({
        city: result.city,
        state: result.state,
        source: result.source || 'network',
      } as AddressInfo),
  };
}

function isHardLocationOff(failure: OsFailure): boolean {
  return failure.kind === 'denied' || failure.kind === 'unavailable';
}

type Props = {
  children: ReactNode;
};

export function LocationProvider({ children }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [address, setAddress] = useState<AddressInfo | null>(null);
  const [source, setSource] = useState<LocationSource>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hadLocationRef = useRef(false);
  const coordsRef = useRef<Coords | null>(null);
  const inflightRef = useRef<Promise<Coords> | null>(null);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const blockForLocationOff = useCallback((message: string) => {
    setCoords(null);
    setAddress(null);
    setSource(null);
    setError(message);
    setDialogOpen(true);
    hadLocationRef.current = false;
  }, []);

  const markSuccess = useCallback((next: Coords, nextSource: LocationSource, nextAddress?: AddressInfo | null) => {
    setCoords(next);
    setSource(nextSource);
    if (nextAddress) setAddress(nextAddress);
    setDialogOpen(false);
    setError(null);

    if (!hadLocationRef.current) {
      toast.success('Location fetch successfully');
      hadLocationRef.current = true;
    }
  }, []);

  const requestLocation = useCallback(
    async (options?: { force?: boolean }) => {
      if (coordsRef.current && !options?.force) {
        return coordsRef.current;
      }

      if (inflightRef.current) return inflightRef.current;

      const run = (async () => {
        setLoading(true);
        setError(null);

        try {
          // 1) Try OS / device GPS briefly
          try {
            const gps = await tryOsLocation(5000);
            markSuccess(gps, 'gps');

            window.gcalc
              ?.getAddress({
                lat: gps.latitude,
                lng: gps.longitude,
                token: getAuthToken(),
              })
              .then((result) => {
                if (result?.ok && result.address) setAddress(result.address);
              })
              .catch(() => {});

            return gps;
          } catch (osErr) {
            // Electron/macOS often reports PERMISSION_DENIED or UNAVAILABLE even when
            // system Location is on (app not granted / no GPS). Fall through to IP
            // geo lookup instead of hard-blocking every time.
            const failure = osErr as OsFailure;
            if (failure.kind === 'timeout') {
              // expected — quiet fallthrough
            }
          }

          // 2) Network location via geoip-lite (main process) — no OS GPS popup needed
          const { coords: netCoords, address: netAddress } =
            await tryNetworkLocation();
          markSuccess(netCoords, 'network', netAddress);
          return netCoords;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not get location. Enable Location Services or check your internet.';

          if (coordsRef.current) {
            setDialogOpen(false);
            setError(null);
            return coordsRef.current;
          }

          setError(message);
          setDialogOpen(true);
          throw new Error(message);
        } finally {
          setLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = run;
      return run;
    },
    [blockForLocationOff, markSuccess],
  );

  const openLocationSettings = useCallback(() => {
    window.gcalc?.openLocationSettings?.();
  }, []);

  useEffect(() => {
    requestLocation({ force: true }).catch(() => {});
  }, [requestLocation]);

  // While the block dialog is open, keep checking so the panel unlocks
  // as soon as Location is turned back on (no need to tap Try again).
  useEffect(() => {
    if (!dialogOpen) return;

    const poll = () => {
      requestLocation({ force: true }).catch(() => {});
    };

    const id = window.setInterval(poll, 2500);
    return () => window.clearInterval(id);
  }, [dialogOpen, requestLocation]);

  // Recheck when returning to the app only if we still have no location
  useEffect(() => {
    const recheck = () => {
      if (coordsRef.current) return;
      requestLocation({ force: true }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };

    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [requestLocation]);

  // Soft recheck: if OS GPS later says denied, do NOT wipe a working network location.
  // Only clear when we can confirm both GPS and network are unavailable.
  useEffect(() => {
    if (!coords) return;

    let cancelled = false;

    const watch = async () => {
      try {
        await tryOsLocation(5000);
      } catch (osErr) {
        if (cancelled) return;
        const failure = osErr as OsFailure;
        if (!isHardLocationOff(failure)) return;

        // GPS denied/unavailable — verify network still works before blocking.
        try {
          const { coords: netCoords, address: netAddress } =
            await tryNetworkLocation();
          if (cancelled) return;
          markSuccess(netCoords, 'network', netAddress);
        } catch {
          if (cancelled) return;
          blockForLocationOff(
            failure.message ||
              'Location is unavailable. Check Location Services and internet.',
          );
        }
      }
    };

    const id = window.setInterval(() => {
      void watch();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [coords, blockForLocationOff, markSuccess]);

  const value = useMemo<LocationContextValue>(
    () => ({
      coords,
      address,
      source,
      error,
      loading,
      isReady: Boolean(coords),
      requestLocation,
      openLocationSettings,
    }),
    [coords, address, source, error, loading, requestLocation, openLocationSettings],
  );

  const blocked = dialogOpen && !coords;

  return (
    <LocationContext.Provider value={value}>
      {children}
      <LocationEnableDialog
        open={blocked}
        loading={loading}
        error={error}
        onEnable={() => {
          requestLocation({ force: true }).catch(() => {
            toast.error('Still no location. Turn on Location, then retry.');
          });
        }}
        onOpenSettings={openLocationSettings}
      />
    </LocationContext.Provider>
  );
}

export function useLocationController() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocationController must be used inside LocationProvider');
  }
  return ctx;
}
