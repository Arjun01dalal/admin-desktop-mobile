/**
 * Mobile transport scaffold.
 * Later: implement HTTPS + encryption here — never import Electron.
 *
 * Shared business logic (SOS parse, paging, action names) comes from createAstroApi.
 */
import {
  createAstroApi,
  isSosFlagEnabled,
  type ApiTransport,
  CLIENT_NAMES,
} from '@astro/shared';

/**
 * Placeholder transport — replace with real HTTPS client when RN/Expo ships.
 * Desktop uses IPC; mobile will use this shape with a different `call` body.
 */
const mobileTransport: ApiTransport = {
  async call() {
    return {
      ok: false,
      message:
        '@astro/mobile HTTPS transport not implemented yet — use createAstroApi(realTransport)',
    };
  },
};

/** Same facade as desktop `astroApi` — swap transport only. */
export const astroApi = createAstroApi(mobileTransport);

export function getSupportedClientNames(): readonly string[] {
  return CLIENT_NAMES;
}

export { isSosFlagEnabled, createAstroApi };
