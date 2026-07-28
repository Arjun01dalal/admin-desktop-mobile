/**
 * Named API action registry — MAIN PROCESS ONLY.
 * Renderer never sees these paths or the API base URL.
 *
 * encryptRequest: wrap body as { token: encrypt(payload) }
 * decryptResponse: decrypt response.data.data
 */
module.exports = {
  // Auth (existing)
  'auth.sendOtp': {
    method: 'POST',
    path: '/SubAdmin/send-otp',
    encryptRequest: true,
    decryptResponse: false,
  },
  'auth.verifyOtp': {
    method: 'POST',
    path: '/SubAdmin/verify-otp',
    encryptRequest: true,
    decryptResponse: true,
  },
  'auth.getAddress': {
    method: 'POST',
    path: '/transaction/getAddress',
    encryptRequest: true,
    decryptResponse: true,
  },
  'auth.checkTokenBlacklisted': {
    method: 'POST',
    path: '/SubAdmin/check-token-blacklisted',
    encryptRequest: false,
    decryptResponse: false,
  },

  // House Games
  'houseGames.transactions': {
    method: 'POST',
    path: '/Ludo/admin/transactions',
    encryptRequest: true,
    decryptResponse: true,
  },
  'houseGames.updateBetStatus': {
    method: 'POST',
    path: '/Ludo/admin/update-bet-status',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Caller Responsibility
  'caller.depositByEmpcodeOffice': {
    method: 'POST',
    path: '/SubAdmin/deposit-by-empcode-office',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.subadminsByRole': {
    method: 'POST',
    path: '/SubAdmin/subadmins-by-role',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.activeUsersFromCalls': {
    method: 'POST',
    path: '/SubAdmin/active-users-from-calls',
    encryptRequest: false,
    decryptResponse: true,
  },
  'caller.withdrawalByEmpcode': {
    method: 'POST',
    path: '/SubAdmin/withdrawal-by-empcode',
    encryptRequest: false,
    decryptResponse: true,
  },
  'caller.uniquePendingDeposits': {
    method: 'POST',
    path: '/transaction/unique-pending-deposits-by-empcode',
    encryptRequest: false,
    decryptResponse: true,
  },
  'caller.callerActiveToday': {
    method: 'POST',
    path: '/SubAdmin/caller-active-today',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.nonPerforming': {
    method: 'POST',
    path: '/SubAdmin/non-performing',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.callerActiveInactive': {
    method: 'POST',
    path: '/SubAdmin/caller-active-inactive',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.activeUsersDepositByEmpcode': {
    method: 'POST',
    path: '/SubAdmin/active-users-deposit-by-empcode',
    encryptRequest: true,
    decryptResponse: true,
  },
  'caller.uploadDiallerData': {
    type: 'local',
  },

  // Player Activity
  'player.wcoStats': {
    method: 'POST',
    path: '/User/wco-user-provider-game-stats',
    encryptRequest: true,
    decryptResponse: true,
  },
  'player.qtechStats': {
    method: 'POST',
    path: '/Qtech/rtp-summary-by-user',
    encryptRequest: false,
    decryptResponse: true,
  },

  // Game Activity
  'game.wcoStats': {
    method: 'POST',
    path: '/User/wco-provider-game-stats',
    encryptRequest: true,
    decryptResponse: true,
  },
  'game.qtechStats': {
    method: 'POST',
    path: '/Qtech/rtp-summary',
    encryptRequest: false,
    decryptResponse: true,
  },

  // Call Logs — keep encrypt flags aligned with backend (plain SubAdmin dialer APIs)
  'callLogs.getDialerData': {
    method: 'POST',
    path: '/SubAdmin/get-dialer-data',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.botStatusSummary': {
    method: 'POST',
    path: '/SubAdmin/bot-call-status-summary',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.updateCallData': {
    method: 'POST',
    path: '/SubAdmin/update-call-data',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.addToBotDialer': {
    method: 'POST',
    path: '/SubAdmin/add-to-dialer',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.deleteQueuedCalls': {
    method: 'POST',
    path: '/SubAdmin/delete-all-queued-calls',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.fetchDeleted': {
    method: 'POST',
    path: '/subAdmin/fetch-deleted-call-records',
    encryptRequest: false,
    decryptResponse: false,
  },
  'callLogs.processCall': {
    type: 'local',
  },
  'callLogs.externalDialerBatch': {
    type: 'local',
  },
  'callLogs.externalDialerSingle': {
    type: 'local',
  },

  // New Registers
  'users.getAll': {
    method: 'POST',
    path: '/User/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.blockUnblock': {
    method: 'POST',
    path: '/User/blockAndUnblockUser',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.appVersions': {
    method: 'POST',
    path: '/User/All-app-version',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.addToDialer': {
    type: 'local',
  },
  'users.coinRemovalUsers': {
    method: 'POST',
    path: '/User/coinRemovalUsers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.getTransactionHistory': {
    method: 'POST',
    path: '/User/get-transaction-history',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Mobile App — config only (no remote API); returned from main so CDN base stays private
  'mobileApp.getLinks': {
    type: 'local',
  },
};
