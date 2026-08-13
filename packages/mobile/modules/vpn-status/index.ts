import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

type VpnChangeEvent = { active?: boolean };

type VpnStatusNative = {
  isVpnActive: () => boolean;
  addListener?: (
    event: 'onChange',
    listener: (event: VpnChangeEvent) => void,
  ) => { remove: () => void };
};

function loadNative(): VpnStatusNative | null {
  try {
    // Prefer requireNativeModule; fall back to proxy so missing modules never throw hard.
    if (NativeModulesProxy?.VpnStatus) {
      return requireNativeModule<VpnStatusNative>('VpnStatus');
    }
    return null;
  } catch {
    return null;
  }
}

const native = loadNative();

/** `null` when this JS bundle is running on a binary that does not include the module yet. */
export function isVpnActiveNative(): boolean | null {
  if (!native) return null;
  try {
    return Boolean(native.isVpnActive());
  } catch {
    return null;
  }
}

export function hasNativeVpnModule(): boolean {
  return native != null;
}

export function subscribeNativeVpn(onChange: (active: boolean) => void): () => void {
  if (!native?.addListener) return () => undefined;
  try {
    const sub = native.addListener('onChange', (event) => {
      onChange(Boolean(event?.active));
    });
    return () => {
      try {
        sub.remove();
      } catch {
        /* already removed */
      }
    };
  } catch {
    return () => undefined;
  }
}
