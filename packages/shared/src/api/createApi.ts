import { ApiActions } from './actions';
import { asPaged, unpackPayload } from './parse';
import { getSosBlock, isSosFlagEnabled, type SosFlagPayload } from './sos';
import type { ApiResult, ApiTransport } from './types';

/**
 * Shared API facade — business operations once, transport injected per platform.
 *
 * Desktop:  createAstroApi(desktopTransport)  // IPC secureApi
 * Mobile:   createAstroApi(mobileHttpsTransport)
 */
export function createAstroApi(transport: ApiTransport) {
  return {
    /** Low-level escape hatch when an action isn't wrapped yet. */
    call: <T = unknown>(action: string, payload: Record<string, unknown> = {}) =>
      transport.call<T>(action, payload),

    auth: {
      getSosFlag: () =>
        transport.call<SosFlagPayload>(ApiActions.auth.getSosFlag, {}),

      /** Parsed helper — same logic on every client. */
      async getSosEnabled(): Promise<boolean> {
        const res = await transport.call<SosFlagPayload>(
          ApiActions.auth.getSosFlag,
          {},
        );
        if (!res.ok) return false;
        return isSosFlagEnabled(res.data);
      },

      getAllSosBlocks: () =>
        transport.call(ApiActions.auth.getAllSosBlocks, {}),

      checkTokenBlacklisted: (userId: string) =>
        transport.call(ApiActions.auth.checkTokenBlacklisted, { _id: userId }),

      getAllBlockedUserIds: () =>
        transport.call(ApiActions.auth.getAllBlockedUserIds, {}),
    },

    users: {
      getAll: (payload: Record<string, unknown>) =>
        transport.call(ApiActions.users.getAll, payload),

      async getAllPaged<T = unknown>(payload: Record<string, unknown>) {
        const res = await transport.call(ApiActions.users.getAll, payload);
        if (!res.ok) {
          return { ...res, rows: [] as T[], total: 0, totalPages: 1 };
        }
        const page = asPaged<T>(res.data);
        return { ...res, ...page };
      },
    },
  };
}

export type AstroApi = ReturnType<typeof createAstroApi>;

export {
  ApiActions,
  asPaged,
  unpackPayload,
  getSosBlock,
  isSosFlagEnabled,
};
export type { ApiResult, ApiTransport, SosFlagPayload };
