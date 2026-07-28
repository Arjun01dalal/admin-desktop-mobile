/**
 * Allowlisted secure actions — must stay in sync with electron/secure/registry.cjs.
 * Renderer can only call these names; paths/secrets stay in main.
 */
export const SECURE_ACTIONS = [
  'auth.sendOtp',
  'auth.verifyOtp',
  'auth.getAddress',
  'auth.checkTokenBlacklisted',
  'houseGames.transactions',
  'houseGames.updateBetStatus',
  'caller.depositByEmpcodeOffice',
  'caller.subadminsByRole',
  'caller.activeUsersFromCalls',
  'caller.withdrawalByEmpcode',
  'caller.uniquePendingDeposits',
  'caller.callerActiveToday',
  'caller.nonPerforming',
  'caller.callerActiveInactive',
  'caller.activeUsersDepositByEmpcode',
  'caller.uploadDiallerData',
  'player.wcoStats',
  'player.qtechStats',
  'game.wcoStats',
  'game.qtechStats',
  'callLogs.getDialerData',
  'callLogs.botStatusSummary',
  'callLogs.updateCallData',
  'callLogs.addToBotDialer',
  'callLogs.deleteQueuedCalls',
  'callLogs.fetchDeleted',
  'callLogs.processCall',
  'callLogs.externalDialerBatch',
  'callLogs.externalDialerSingle',
  'users.getAll',
  'users.blockUnblock',
  'users.appVersions',
  'users.addToDialer',
  'users.coinRemovalUsers',
  'users.getTransactionHistory',
  'mobileApp.getLinks',
  'dashboard.summary',
  'dashboard.depositCount',
  'dashboard.activeCustomers',
  'dashboard.nonPerformingUser',
  'analytics.userBalance',
  'profitLoss.depositWithdrawal',
] as const;

export type SecureAction = (typeof SECURE_ACTIONS)[number];

const ACTION_SET: ReadonlySet<string> = new Set(SECURE_ACTIONS);

export function isSecureAction(action: string): action is SecureAction {
  return ACTION_SET.has(action);
}
