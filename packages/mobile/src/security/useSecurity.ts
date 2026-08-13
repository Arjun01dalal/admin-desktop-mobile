/**
 * useSecurity — aggregates runtime protections.
 * Preview builds: no freeRASP; VPN via NetInfo + optional native VpnStatus.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { enableScreenshotBlock, disableScreenshotBlock } from './screenshot';
import { useRaspThreats } from './raspGuard';
import {
  detectVpn,
  refreshVpn,
  subscribeNativeVpn,
  subscribeNetInfoVpn,
} from './vpnDetect';
import type { ThreatKind } from './rasp';

export type SecurityStatus = {
  threats: ThreatKind[];
  blocked: boolean;
  /** Always true quickly — never block first paint forever. */
  vpnReady: boolean;
  refresh: () => Promise<void>;
};

const BLOCKING: ThreatKind[] = [
  'privilegedAccess',
  'hooks',
  'appIntegrity',
  'simulator',
  'systemVPN',
];

const VPN_POLL_MS = 3_000;

function useLiveVpn(raspVpn: boolean): {
  vpn: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
} {
  const [vpn, setVpn] = useState(false);
  // Never gate the whole app on VPN probe — mark ready ASAP.
  const [ready, setReady] = useState(true);
  const [ignoreRasp, setIgnoreRasp] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const next = await refreshVpn();
      setVpn(next);
      if (!next) setIgnoreRasp(true);
    } catch {
      setVpn(false);
      setIgnoreRasp(true);
    }
  }, []);

  useEffect(() => {
    if (vpn) setIgnoreRasp(false);
  }, [vpn]);

  useEffect(() => {
    if (raspVpn && !ignoreRasp) setVpn(true);
  }, [raspVpn, ignoreRasp]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    const apply = (value: boolean) => {
      if (!cancelled) setVpn(value);
    };

    // Hard timeout so a hung native call cannot freeze the UI.
    const readyTimer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 800);

    void detectVpn()
      .then(apply)
      .catch(() => apply(false))
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    let unsubNative: (() => void) | undefined;
    try {
      unsubNative = subscribeNativeVpn(apply);
    } catch {
      unsubNative = undefined;
    }

    const unsubNet = subscribeNetInfoVpn((netVpn) => {
      void detectVpn().then(apply).catch(() => undefined);
      if (netVpn) apply(true);
    });
    const poll = setInterval(() => {
      void detectVpn().then(apply).catch(() => undefined);
    }, VPN_POLL_MS);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void detectVpn().then(apply).catch(() => undefined);
    });

    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      unsubNative?.();
      unsubNet();
      clearInterval(poll);
      appSub.remove();
    };
  }, []);

  const locked = vpn || (raspVpn && !ignoreRasp);
  return { vpn: locked, ready, refresh };
}

export function useSecurity(): SecurityStatus {
  useEffect(() => {
    void enableScreenshotBlock().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void enableScreenshotBlock().catch(() => undefined);
    });
    return () => {
      sub.remove();
      void disableScreenshotBlock().catch(() => undefined);
    };
  }, []);

  const { threats: raspThreats } = useRaspThreats();
  const raspVpn = raspThreats.includes('systemVPN');
  const { vpn: liveVpn, ready: vpnReady, refresh } = useLiveVpn(raspVpn);

  const raspWithoutVpn = raspThreats.filter((t) => t !== 'systemVPN');
  // Preview: do not hard-block on freeRASP integrity (sideload false positives).
  const hardThreats = raspWithoutVpn.filter((t) => t !== 'appIntegrity' && t !== 'unofficialStore');
  const threats: ThreatKind[] = liveVpn ? [...hardThreats, 'systemVPN'] : hardThreats;

  const blocked = threats.some((t) => BLOCKING.includes(t));
  return { threats, blocked, vpnReady, refresh };
}
