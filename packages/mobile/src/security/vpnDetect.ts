/**
 * Live VPN detection. NetInfo's `type === 'vpn'` is unreliable on Android
 * (Wi‑Fi/cellular is reported first when both transports are present) and is
 * not reported on iOS at all. Prefer the native VpnStatus module, then NetInfo.
 */
import { Platform } from 'react-native';
import {
  hasNativeVpnModule,
  isVpnActiveNative,
  subscribeNativeVpn,
} from 'vpn-status';

type NetInfoLike = {
  fetch: () => Promise<{ type?: string }>;
  refresh: () => Promise<{ type?: string }>;
  addEventListener: (listener: (state: { type?: string }) => void) => () => void;
};

function loadNetInfo(): NetInfoLike | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-community/netinfo').default as NetInfoLike;
  } catch {
    return null;
  }
}

export function netInfoLooksLikeVpn(state: { type?: string } | null | undefined): boolean {
  return state?.type === 'vpn';
}

export { hasNativeVpnModule, subscribeNativeVpn };

export async function detectVpn(): Promise<boolean> {
  const native = isVpnActiveNative();
  if (native !== null) return native;
  const NetInfo = loadNetInfo();
  if (!NetInfo) return false;
  try {
    const state = await NetInfo.fetch();
    return netInfoLooksLikeVpn(state);
  } catch {
    return false;
  }
}

export async function refreshVpn(): Promise<boolean> {
  const native = isVpnActiveNative();
  if (native !== null) return native;
  return refreshNetInfoVpn();
}

export function subscribeNetInfoVpn(onChange: (vpn: boolean) => void): () => void {
  const NetInfo = loadNetInfo();
  if (!NetInfo) return () => undefined;
  return NetInfo.addEventListener((state) => {
    onChange(netInfoLooksLikeVpn(state));
  });
}

export async function refreshNetInfoVpn(): Promise<boolean> {
  const NetInfo = loadNetInfo();
  if (!NetInfo) return false;
  try {
    const state = await NetInfo.refresh();
    return netInfoLooksLikeVpn(state);
  } catch {
    return false;
  }
}
