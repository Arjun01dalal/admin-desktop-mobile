/**
 * Desktop transport — Electron IPC only.
 * Secrets / base URL stay in main process via window.gcalc.secureApi.
 */
import { createAstroApi, type ApiTransport } from '@astro/shared';
import { secureApi } from './secureClient';
import { isSecureAction, type SecureAction } from './secureActions';

export const desktopTransport: ApiTransport = {
  async call<T = unknown>(action: string, payload: Record<string, unknown> = {}) {
    if (!isSecureAction(action)) {
      return { ok: false, message: `Unknown secure action: ${action}` };
    }
    return secureApi<T>(action as SecureAction, payload);
  },
};

/** Shared business API on top of desktop IPC — same ops mobile will call later. */
export const astroApi = createAstroApi(desktopTransport);
