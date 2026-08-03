/**
 * Shared action names used by both desktop and mobile.
 * Desktop still allowlists via secureActions; keep these strings in sync with registry.
 */
export const ApiActions = {
  auth: {
    sendOtp: 'auth.sendOtp',
    verifyOtp: 'auth.verifyOtp',
    getResponsibility: 'auth.getResponsibility',
    checkTokenBlacklisted: 'auth.checkTokenBlacklisted',
    getAllBlockedUserIds: 'auth.getAllBlockedUserIds',
    getSosFlag: 'auth.getSosFlag',
    sosFlag: 'auth.sosFlag',
    getAllSosBlocks: 'auth.getAllSosBlocks',
  },
  users: {
    getAll: 'users.getAll',
  },
  callLogs: {
    externalDialerBatch: 'callLogs.externalDialerBatch',
  },
} as const;

export type AuthAction = (typeof ApiActions.auth)[keyof typeof ApiActions.auth];
