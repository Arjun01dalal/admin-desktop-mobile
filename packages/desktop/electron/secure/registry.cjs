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
  'auth.getResponsibility': {
    method: 'POST',
    path: '/SubAdmin/get-responsibility',
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
  'auth.getAllBlockedUserIds': {
    method: 'POST',
    path: '/SubAdmin/get-all-blockedUserId',
    encryptRequest: false,
    decryptResponse: false,
  },
  'auth.sosFlag': {
    method: 'POST',
    path: '/SubAdmin/sos-flag',
    encryptRequest: false,
    decryptResponse: false,
  },
  'auth.getSosFlag': {
    method: 'POST',
    path: '/SubAdmin/get-sos-flag',
    encryptRequest: false,
    decryptResponse: false,
  },
  'auth.getAllSosBlocks': {
    method: 'POST',
    path: '/SubAdmin/get-all-sos-blocks',
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
  'users.getAllBalance': {
    method: 'POST',
    path: '/User/getAllBalance',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.getAllBonus': {
    method: 'POST',
    path: '/User/getAllBonus',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.registeredUser': {
    method: 'POST',
    path: '/User/registered-user',
    encryptRequest: true,
    decryptResponse: true,
  },
  // State wise Registration (RegisterUserReport — laxminarayan)
  'users.registeredUsersReport': {
    method: 'POST',
    path: '/User/registered-users-report',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.blockUnblock': {
    method: 'POST',
    path: '/User/blockAndUnblockUser',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.sendBlockOtp': {
    method: 'POST',
    path: '/User/sendOtp-walletToWallet',
    // Laxminarayan Users.tsx sends plain body (not encrypted token)
    encryptRequest: false,
    decryptResponse: false,
  },
  'users.verifyBlockOtp': {
    method: 'POST',
    path: '/User/verifyOtp-walletToWallet',
    encryptRequest: false,
    decryptResponse: false,
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
  // New Registers — comment + call-log (admin-panel-domains NewRegisterUsers)
  'users.addNewRegistrationComment': {
    method: 'POST',
    path: '/User/add-new-registration-comment',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.callLogsForNewRegistration': {
    method: 'POST',
    path: '/User/call-logs-for-new-registration',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Caller Details — laxminarayan update-alternate-mobile
  'users.updateAlternateMobile': {
    method: 'POST',
    path: '/User/update-alternate-mobile',
    encryptRequest: true,
    decryptResponse: true,
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
  'users.create': {
    method: 'POST',
    path: '/User/create-user',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.createSubAdmin': {
    method: 'POST',
    path: '/SubAdmin/create-subadmin',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Register form (Users.tsx handleSubmit) — distinct from create-user modal
  'users.register': {
    method: 'POST',
    path: '/User',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.registerSubAdmin': {
    method: 'POST',
    path: '/SubAdmin',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.setUserEmpCode': {
    method: 'POST',
    path: '/SubAdmin/set-user-empcode',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.updateSubAdminName': {
    method: 'POST',
    path: '/SubAdmin/update-name',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.updateSubAdminRole': {
    method: 'POST',
    path: '/SubAdmin/update-subAdmin-role',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.updateRealName': {
    method: 'POST',
    path: '/SubAdmin/update-real-name',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.appVersion': {
    method: 'POST',
    path: '/User/app-version',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.updatedAppVersion': {
    method: 'POST',
    path: '/User/updated-app-version',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.getGlobalsCount': {
    method: 'POST',
    path: '/User/get-user-globals-count',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.companyContacts': {
    method: 'POST',
    path: '/thirdParty/company-contacts',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.savePerformanceData': {
    method: 'POST',
    path: '/SubAdmin/save-performance-data',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.getActiveUsers': {
    method: 'POST',
    path: '/User/get-active-users',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.getSubAdmins': {
    method: 'POST',
    path: '/SubAdmin/get-all-subadmins',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Reports (ported from laxminarayan_live-admin)
  'reports.subadminCoinReport': {
    method: 'POST',
    path: '/coin/subadmin-report',
    encryptRequest: false,
    decryptResponse: false,
  },
  'reports.addCoin': {
    method: 'POST',
    path: '/SubAdmin/add-coin',
    encryptRequest: true,
    decryptResponse: true,
  },
  'reports.sheetDownloadAudit': {
    method: 'POST',
    path: '/report-download/report-download-audit/get-all',
    encryptRequest: true,
    decryptResponse: true,
  },
  'reports.sheetDownloadAuditCreate': {
    method: 'POST',
    path: '/report-download/report-download-audit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'reports.getAllMidOld': {
    method: 'POST',
    path: '/payinAccounts/getAllMidOld',
    encryptRequest: true,
    decryptResponse: true,
  },
  'reports.checkersData': {
    method: 'POST',
    path: '/transaction/checker-data-all',
    encryptRequest: false,
    decryptResponse: false,
  },
  'reports.allUserLoginLogout': {
    method: 'POST',
    path: '/SubAdmin/logout-login-panel',
    encryptRequest: false,
    decryptResponse: false,
  },
  'reports.loginByRole': {
    method: 'POST',
    path: '/SubAdmin/getAllByRole',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Ops / management (ported from laxminarayan_live-admin)
  'ops.socialMediaGetAll': {
    method: 'POST',
    path: '/socialMedia/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.socialMediaCreate': {
    method: 'POST',
    path: '/socialMedia',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.socialMediaUpdate': {
    method: 'POST',
    path: '/socialMedia/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.socialMediaDelete': {
    method: 'POST',
    path: '/socialMedia/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.upiGetAll': {
    method: 'POST',
    path: '/upiLists/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.upiCreate': {
    method: 'POST',
    path: '/upiLists/',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.upiUpdate': {
    method: 'POST',
    path: '/upiLists/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.upiDelete': {
    method: 'POST',
    path: '/upiLists/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  // UPI Payments page (AllUpiPayment — laxminarayan)
  'upiPayments.notifications': {
    method: 'POST',
    path: '/transaction/getAllUpiPayment',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.transactions': {
    method: 'POST',
    path: '/transaction/getAllTransaction',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.gateways': {
    method: 'POST',
    path: '/payinAccounts/getPayinGatewayName',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.changeAmount': {
    method: 'POST',
    path: '/transaction/upiChangeAmount',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.changeMid': {
    method: 'POST',
    path: '/transaction/upiChangeMid',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.changeNotification': {
    method: 'POST',
    path: '/transaction/upiChangeNotification',
    encryptRequest: true,
    decryptResponse: true,
  },
  'upiPayments.addCoin': {
    method: 'POST',
    path: '/coin/addUpi',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.utrGetAll': {
    method: 'POST',
    path: '/utrProvider/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.utrCreate': {
    method: 'POST',
    path: '/utrProvider',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.utrUpdate': {
    method: 'POST',
    path: '/utrProvider/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.utrDelete': {
    method: 'POST',
    path: '/utrprovider/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Instant Deposit Providers (laxminarayan InstantDepositProvider)
  'instantDeposit.list': {
    method: 'POST',
    path: '/transaction/all-instant-deposits',
    encryptRequest: true,
    decryptResponse: true,
  },
  'instantDeposit.create': {
    method: 'POST',
    path: '/instantDeposit/create',
    encryptRequest: true,
    decryptResponse: true,
  },
  'instantDeposit.delete': {
    method: 'POST',
    path: '/instantDeposit/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'instantDeposit.updateStatus': {
    method: 'POST',
    path: '/instantDeposit/updateStatus',
    encryptRequest: true,
    decryptResponse: true,
  },
  'instantDeposit.updateInstant': {
    method: 'POST',
    path: '/instantDeposit/update-instant',
    encryptRequest: true,
    decryptResponse: true,
  },
  'instantDeposit.updateName': {
    method: 'POST',
    path: '/instantDeposit/update-name',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Deposit Providers /pay-g-mid (laxminarayan Deposit_Withdraw_Providers)
  'depositProviders.list': {
    method: 'POST',
    path: '/payinAccounts/getAllDash',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.create': {
    method: 'POST',
    path: '/payinAccounts/',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.update': {
    method: 'POST',
    path: '/payinAccounts/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.delete': {
    method: 'POST',
    path: '/payinAccounts/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateMidNameLink': {
    method: 'POST',
    path: '/payinAccounts/update-mid-name-link',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateMidArray': {
    method: 'POST',
    path: '/payinAccounts/update-mid-array',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateUpiArray': {
    method: 'POST',
    path: '/payinAccounts/update-upiArray',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateWhatsappNumbers': {
    method: 'POST',
    path: '/payinAccounts/update-whatsapp-numbers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateBonusAndClients': {
    method: 'POST',
    path: '/payinAccounts/updateBonusAndClients',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateGatewayAmt': {
    method: 'POST',
    path: '/payinAccounts/updateGatewayAmt',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.updateOrder': {
    method: 'POST',
    path: '/payinAccounts/update-order',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositProviders.cloneIntentPay': {
    method: 'POST',
    path: '/payinAccounts/clone-intent-pay',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Deposit Config
  'depositConfig.getAll': {
    method: 'POST',
    path: '/depositConfig/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositConfig.add': {
    method: 'POST',
    path: '/depositConfig/add',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositConfig.update': {
    method: 'POST',
    path: '/depositConfig/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Withdrawal Providers (/payout-accounts)
  'withdrawalProviders.list': {
    method: 'POST',
    path: '/payoutAccounts/getAllDash',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalProviders.create': {
    method: 'POST',
    path: '/payoutAccounts/',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalProviders.update': {
    method: 'POST',
    path: '/payoutAccounts/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalProviders.delete': {
    method: 'POST',
    path: '/payoutAccounts/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalProviders.updateAll': {
    method: 'POST',
    path: '/payoutAccounts/updateAll/',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalProviders.updateMidNameLink': {
    method: 'POST',
    path: '/payoutAccounts/update-mid-name-link',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Bot Data
  'botData.filteredUsersByBots': {
    method: 'POST',
    path: '/SubAdmin/get-filtered-users-by-bots',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Bot Performance (laxminarayan sends plain body)
  'botPerformance.callerUserActivity': {
    method: 'POST',
    path: '/SubAdmin/caller-user-activity',
    encryptRequest: false,
    decryptResponse: true,
  },
  'ops.percentageGetAll': {
    method: 'POST',
    path: '/change-percentage/get-All',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.percentageSave': {
    method: 'POST',
    path: '/change-percentage',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.percentageChangeStatus': {
    method: 'POST',
    path: '/change-percentage/change-status',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.feedbackGetAll': {
    method: 'POST',
    path: '/feedBack/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.feedbackCreate': {
    method: 'POST',
    path: '/feedBack',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.feedbackUpdate': {
    method: 'POST',
    path: '/feedBack/updateById',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.feedbackDelete': {
    method: 'POST',
    path: '/feedBack/getById',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.bannersGetAll': {
    method: 'POST',
    path: '/bannerGames/getAll',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.bannersCreate': {
    method: 'POST',
    path: '/bannerGames/create',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.bannersDelete': {
    method: 'POST',
    path: '/bannerGames/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.bannersUpdatePosition': {
    method: 'POST',
    path: '/bannerGames/update-position',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.bannersUpdate': {
    method: 'POST',
    path: '/bannerGames',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.betConstructGetAll': {
    method: 'POST',
    path: '/BetConstruct/get-all-games',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.betConstructUpdateImage': {
    method: 'POST',
    path: '/BetConstruct/Update-game-image',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.betConstructUpdateStatus': {
    method: 'POST',
    path: '/BetConstruct/Update-game-status',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoGetData': {
    method: 'POST',
    path: '/casinoGames/getDataWithPages',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoGetProviders': {
    method: 'POST',
    path: '/Qtech/Get-provider',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoGetConfig': {
    method: 'GET',
    path: '/configs',
    encryptRequest: false,
    decryptResponse: false,
  },
  'ops.casinoSetActiveProvider': {
    method: 'POST',
    path: '/change-percentage/active-casino-providers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoMiraiGet': {
    method: 'POST',
    path: '/change-percentage/mirai-casino',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoMiraiStatus': {
    method: 'POST',
    path: '/change-percentage/status-mirai-casino',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoEditGame': {
    method: 'POST',
    path: '/Qtech/Edit-Games',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.casinoAddTableId': {
    method: 'POST',
    path: '/Qtech/Add-tableId',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.nonPerformingUser': {
    method: 'POST',
    path: '/User/nonPerformingUser',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.addNonPerformingComment': {
    method: 'POST',
    path: '/User/add-non-performing-comment',
    encryptRequest: true,
    decryptResponse: false,
  },
  'ops.activeCustomers': {
    method: 'POST',
    path: '/User/get-active-customers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.inactiveDeposit': {
    method: 'POST',
    path: '/transaction/inactive-customer-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.nonPerformingActive': {
    method: 'POST',
    path: '/User/inactive-7days-active-today',
    encryptRequest: true,
    decryptResponse: true,
  },
  'users.laxmi999': {
    method: 'POST',
    path: '/SubAdmin/historical-wallet-summary-with-users',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.newDeposits': {
    method: 'POST',
    path: '/transaction/inactive-customer-months-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.dumpUsersUpdate': {
    method: 'POST',
    path: '/User/update-dump',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.playerRtpQtech': {
    method: 'POST',
    path: '/Qtech/rtp-by-users-per-game',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.playerRtpExchange': {
    method: 'POST',
    path: '/exchange/client-wise-report',
    encryptRequest: true,
    // Old UI uses decryptData-style full object, then Object.entries(res.payload).
    decryptResponse: true,
    keepDataEnvelope: true,
  },
  'ops.myCustomersGetAll': {
    method: 'POST',
    path: '/SubAdmin/get-all-customer',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersNonPerforming': {
    method: 'POST',
    path: '/SubAdmin/non-performing',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersInactiveDeposit': {
    method: 'POST',
    path: '/SubAdmin/inActive-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersCallerActiveInactive': {
    method: 'POST',
    path: '/SubAdmin/caller-active-inactive',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersCallerDepositFirst': {
    method: 'POST',
    path: '/SubAdmin/caller-deposit-first',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersCallerActiveToday': {
    method: 'POST',
    path: '/SubAdmin/caller-active-today',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersAddComment': {
    method: 'POST',
    path: '/SubAdmin/add-comment',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.myCustomersDeposit': {
    method: 'POST',
    path: '/SubAdmin/myCustomerDeposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.customerSupportGetAll': {
    method: 'POST',
    path: '/SubAdmin/get-all-customerSupport',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.customerSupportDeposit': {
    method: 'POST',
    path: '/SubAdmin/get-all-customerSupport-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.blockCaller': {
    method: 'POST',
    path: '/SubAdmin/block-caller',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateCity': {
    method: 'POST',
    path: '/SubAdmin/updateCity',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Leaderboard (laxminarayan Leaderboard / CustomerCount)
  'leaderboard.list': {
    method: 'POST',
    path: '/subAdmin/caller-leaderBoard',
    encryptRequest: true,
    decryptResponse: true,
  },
  'leaderboard.callerUsers': {
    method: 'POST',
    path: '/User/callerUserList',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateAppCallers': {
    method: 'POST',
    path: '/SubAdmin/update-app-callers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateCustomer': {
    method: 'POST',
    path: '/SubAdmin/update-customer',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.callerReport': {
    method: 'POST',
    path: '/SubAdmin/caller-report',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.callerAllotmentSubadmins': {
    method: 'POST',
    path: '/SubAdmin/subadmins-by-role',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateCallerHead': {
    method: 'POST',
    path: '/SubAdmin/update-caller-head',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateOfficeLocation': {
    method: 'POST',
    path: '/SubAdmin/update-office-location',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateSubadminAttributes': {
    method: 'POST',
    path: '/SubAdmin/update-subadmin-attributes',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.updateLanguage': {
    method: 'POST',
    path: '/SubAdmin/update-language',
    encryptRequest: true,
    decryptResponse: true,
  },
  // KYC (admin-panel-domains KYC.tsx flow)
  'ops.kycReject': {
    method: 'POST',
    path: '/kyc/reject',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Bank verification step before OTP (POST /kyc/kyc)
  'ops.kycApprove': {
    method: 'POST',
    path: '/kyc/kyc',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Final approve after customer + admin OTP
  'ops.kycAdminOtp': {
    method: 'POST',
    path: '/kyc/kycAdminOtp',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycSendOtp': {
    method: 'POST',
    path: '/kyc/send-otp',
    encryptRequest: false,
    decryptResponse: false,
  },
  'ops.kycManualUpdate': {
    method: 'POST',
    path: '/kyc/manualKycUpdate',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycVerifyUpi': {
    method: 'POST',
    path: '/kyc/verify-upi',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycCheckReject': {
    method: 'POST',
    path: '/kyc/check-reject-kyc',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycCheckDoc': {
    method: 'POST',
    path: '/Kyc/check-doc-kyc',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycCheckManual': {
    method: 'POST',
    path: '/Kyc/check-manual-kyc',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Mobile App — config only (no remote API); returned from main so CDN base stays private
  'mobileApp.getLinks': {
    type: 'local',
  },

  // Dashboards & Analytics (ported from admin-panel-domains)
  'dashboard.summary': {
    method: 'POST',
    path: '/User/dashboard',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.depositCount': {
    method: 'POST',
    path: '/User/depositCount',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.activeCustomers': {
    method: 'POST',
    path: '/User/get-active-customers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.activeCustomersCategory': {
    method: 'POST',
    path: '/User/get-active-customers-categorywise',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.nonPerformingUser': {
    method: 'POST',
    path: '/User/nonPerformingUser',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.wco': {
    method: 'POST',
    path: '/User/wco',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.qtech': {
    method: 'POST',
    path: '/Qtech/store-bet-All',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.falcon': {
    method: 'POST',
    path: '/falcon/falcon-own-ggr',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.jetfair': {
    method: 'POST',
    path: '/jetfair/jetfair-match-date-ggr',
    encryptRequest: true,
    decryptResponse: true,
  },
  // keepDataEnvelope: page reads `.payload` like laxminarayan FalconRateManagement
  'dashboard.jetfairByEvent': {
    method: 'POST',
    path: '/jetfair/jetfair-match-date-ggr-by-event',
    encryptRequest: true,
    decryptResponse: true,
    keepDataEnvelope: true,
  },
  'dashboard.falconByEvent': {
    method: 'POST',
    path: '/falcon/falcon-own-ggr-by-event',
    encryptRequest: true,
    decryptResponse: true,
    keepDataEnvelope: true,
  },
  // Live Match Total (external AAA hosts — absolute URLs)
  'dashboard.oddsGameList': {
    method: 'GET',
    path: 'https://nodebackend.aaryapaar.exchange/api/v2/odds/gameList',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.finalBookLaxmi': {
    method: 'GET',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/os/finalBookLaxmi',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.finalBookVip': {
    method: 'GET',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/os/finalBookVIP',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.finalBookBoth': {
    method: 'GET',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/os/finalBook',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.zehnRiskOs': {
    method: 'GET',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/zehnRiskAnalysis?providerCode=OS_PRODUCTION',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.zehnRiskVip': {
    method: 'GET',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/zehnRiskAnalysis?providerCode=FairBetVip_Prod',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.aaaGameWise': {
    method: 'POST',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/gameWisePlusMinus',
    encryptRequest: false,
    decryptResponse: false,
  },
  // AAA zehnPL (external host — absolute URL; axios ignores baseURL)
  'dashboard.aaaZehnPl': {
    method: 'POST',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/zehnPL',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.masterAaaZehnPl': {
    method: 'POST',
    path: 'https://nodeadmin.aaryapaar.exchange/api/v1/zehnPL?providerCode=FairBetVip_Prod',
    encryptRequest: false,
    decryptResponse: false,
  },
  // Master Dashboard (fairbets.vip host — laxminarayan MasterDashboard)
  'dashboard.masterWco': {
    method: 'POST',
    path: 'https://fairbets.vip/api/User/wco',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.masterFalcon': {
    method: 'POST',
    path: 'https://fairbets.vip/api/falcon/falcon-own-ggr',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.masterSatta': {
    method: 'POST',
    path: 'https://fairbets.vip/api/User/sattaMarketOverallGGR',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.satta': {
    method: 'POST',
    path: '/User/sattaMarketOverallGGR',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.betConstruct': {
    method: 'POST',
    path: '/BetConstruct/store-bet-ggr',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.betConstructGameWiseGgr': {
    method: 'POST',
    path: '/BetConstruct/game-wise-ggr',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.sportBook': {
    method: 'POST',
    path: '/vking/vking-match-date-ggr',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.plutus': {
    method: 'POST',
    path: '/User/plutus-gaming',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.indianDiva': {
    method: 'POST',
    path: '/User/indian-diva',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.ludo': {
    method: 'POST',
    path: '/Ludo/admin/house-stats',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.ludoGameIds': {
    method: 'POST',
    path: '/change-percentage/game-ids/get',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.ludoGameIdsUpdate': {
    method: 'POST',
    path: '/change-percentage/game-ids/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.ludoRtp': {
    method: 'POST',
    path: '/Ludo/admin/rtp',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.activeExchangeGet': {
    method: 'POST',
    path: '/change-percentage/active-exchange-providers',
    encryptRequest: true,
    decryptResponse: true,
  },
  'dashboard.activeExchangeUpdate': {
    method: 'POST',
    path: '/change-percentage/active-exchange-providers-update',
    encryptRequest: false,
    decryptResponse: false,
  },
  'dashboard.appDeposit': {
    method: 'POST',
    path: '/transaction/app-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'analytics.userBalance': {
    method: 'POST',
    path: '/change-percentage/get-user-balance',
    encryptRequest: true,
    decryptResponse: true,
  },
  'analytics.userAnalytics': {
    method: 'POST',
    path: '/User/analytics',
    encryptRequest: false,
    decryptResponse: true,
  },
  'profitLoss.depositWithdrawal': {
    method: 'POST',
    path: '/transaction/deposit-withdrawal',
    encryptRequest: true,
    decryptResponse: true,
  },
  'profitLoss.list': {
    method: 'POST',
    path: '/User/getProfitLoss',
    encryptRequest: true,
    decryptResponse: true,
  },
  // Master Flow (AAA hierarchy — plain SubAdmin endpoints, same as laxminarayan)
  'masterFlow.masters': {
    method: 'POST',
    path: '/SubAdmin/masters-aaa',
    encryptRequest: false,
    decryptResponse: false,
  },
  'masterFlow.superMasters': {
    method: 'POST',
    path: '/SubAdmin/super-masters-aaa',
    encryptRequest: false,
    decryptResponse: false,
  },
  'masterFlow.superAdmins': {
    method: 'POST',
    path: '/SubAdmin/super-admins-aaa',
    encryptRequest: false,
    decryptResponse: false,
  },
  // User Report (wallet history hub)
  'userReport.encryptedId': {
    method: 'POST',
    path: '/User/encryptedId',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.walletHistory': {
    method: 'POST',
    path: '/wallet-History',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.walletHistoryCustomer': {
    method: 'POST',
    path: '/wallet-History/customer',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.betAmountsByCategory': {
    method: 'POST',
    path: '/User/get-bet-amounts-by-category',
    encryptRequest: true,
    // Unwrap if encrypted; plain category maps pass through unwrap unchanged.
    decryptResponse: true,
  },
  'userReport.bonusTotalEarning': {
    method: 'POST',
    path: '/bonus-wallet/user-total-earning',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.bonusApprovedTotal': {
    method: 'POST',
    path: '/bonus-wallet/user-approved-transaction-total',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.userExposure': {
    method: 'POST',
    path: '/User/user-exposer',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.gameHistory': {
    method: 'POST',
    path: '/User/get-game-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.starlineHistory': {
    method: 'POST',
    path: '/User/get-starline-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.kingBazarHistory': {
    method: 'POST',
    path: '/User/get-kingbazar-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.instantWorliHistory': {
    method: 'POST',
    path: '/User/get-instantWorli-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.qtechHistory': {
    method: 'POST',
    path: '/User/get-qtech-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.jetfairHistory': {
    method: 'POST',
    path: '/User/get-jetfair-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.falconHistory': {
    method: 'POST',
    path: '/User/get-falcon-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.crazyWheelHistory': {
    method: 'POST',
    path: '/User/get-crazywheel-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.transactionHistory': {
    method: 'POST',
    path: '/User/get-transaction-history',
    encryptRequest: true,
    decryptResponse: true,
  },
  'userReport.removeBonus': {
    method: 'POST',
    path: '/bonus-wallet/remove-bonus',
    encryptRequest: true,
    decryptResponse: false,
  },
  'userReport.qtechStoreBet': {
    method: 'POST',
    path: '/Qtech/store-bet',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.qtechMissingBets': {
    method: 'POST',
    path: '/Qtech/store-bet-comparision',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.qtechRtp': {
    method: 'POST',
    path: '/Qtech/rtp',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.jetfairMapping': {
    method: 'POST',
    path: '/jetfair/jetfair-mapping',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.smMapping': {
    method: 'POST',
    path: '/sattaMatka/sattaMatka-mapping',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.settleSmBets': {
    method: 'POST',
    path: '/User/findBetAndUpdate-sattamatka',
    encryptRequest: false,
    decryptResponse: false,
  },
  'userReport.settleJetfair': {
    method: 'POST',
    path: '/jetfair/Settlemarket',
    encryptRequest: false,
    decryptResponse: true,
  },
  'userReport.settleGameBet': {
    method: 'POST',
    path: '/User/update-status-l-to-w',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Incoming Bot Call (external helper host)
  'incomingBot.list': { type: 'local' },
  'incomingBot.processCall': { type: 'local' },

  // Roles & Responsibilities
  'roles.list': {
    method: 'POST',
    path: '/roles',
    encryptRequest: true,
    decryptResponse: true,
  },
  'roles.add': {
    method: 'POST',
    path: '/roles/add',
    encryptRequest: true,
    decryptResponse: true,
  },
  'roles.update': {
    method: 'POST',
    path: '/roles/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'roles.delete': {
    method: 'POST',
    path: '/roles/delete',
    encryptRequest: true,
    decryptResponse: true,
  },
  'roles.clone': {
    method: 'POST',
    path: '/roles/clone',
    encryptRequest: true,
    decryptResponse: true,
  },
  'responsibilities.list': {
    method: 'POST',
    path: '/responsibilities',
    encryptRequest: true,
    decryptResponse: true,
  },
  'responsibilities.add': {
    method: 'POST',
    path: '/responsibilities/add',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Coin Permission page (Add_Roles_And_Responsibilities in the web panel)
  'subadmin.updateCoinRoles': {
    method: 'POST',
    path: '/SubAdmin/update-coin-roles',
    encryptRequest: true,
    decryptResponse: true,
  },
  'subadmin.removeCoinPermission': {
    method: 'POST',
    path: '/SubAdmin/removeCoin',
    encryptRequest: true,
    decryptResponse: true,
  },
  'subadmin.updateAppHeads': {
    method: 'POST',
    path: '/SubAdmin/update-app-heads',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Casino Switch
  'casinoSwitch.list': {
    method: 'POST',
    path: '/change-percentage/active-casino-providers/get',
    encryptRequest: true,
    decryptResponse: true,
  },
  'casinoSwitch.create': {
    method: 'POST',
    path: '/change-percentage/active-casino-providers/create',
    encryptRequest: true,
    decryptResponse: true,
  },
  'casinoSwitch.changeStatus': {
    method: 'POST',
    path: '/change-percentage/active-casino-providers/change-status',
    encryptRequest: true,
    decryptResponse: true,
  },
  'casinoSwitch.delete': {
    method: 'POST',
    path: '/change-percentage/active-casino-providers/delete',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Top Games
  'topGames.completeDoc': {
    method: 'POST',
    path: '/change-percentage/top-games/complete-doc',
    encryptRequest: true,
    decryptResponse: true,
  },
  'topGames.removeAtPosition': {
    method: 'POST',
    path: '/change-percentage/top-games/remove-game-at-position-test',
    encryptRequest: false,
    decryptResponse: false,
  },
  'topGames.updateStatus': {
    method: 'POST',
    path: '/change-percentage/top-games/update-status',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Deposit List (approved deposit/withdrawal report)
  'depositList.report': {
    method: 'POST',
    path: '/transaction/approved-deposit-withdrawal-report',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Bonus Wallet
  'bonusWallet.transferRequests': {
    method: 'POST',
    path: '/bonus-wallet/get-transferRequest',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.updateTransferRequest': {
    method: 'POST',
    path: '/bonus-wallet/update-transferRequest',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.fundRequestSummary': {
    method: 'POST',
    path: '/bonus-wallet/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.fundPending': {
    method: 'POST',
    path: '/bonus-wallet/fund-pending',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.fundApproved': {
    method: 'POST',
    path: '/bonus-wallet/fund-approved',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.fundTransferIn': {
    method: 'POST',
    path: '/bonus-wallet/fund-transfer-in-bonus-wallet',
    encryptRequest: true,
    decryptResponse: true,
  },
  'bonusWallet.history': {
    method: 'POST',
    path: '/bonus-wallet/get-history',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Deposit Approved Report
  'depositApproved.transactions': {
    method: 'POST',
    path: '/transaction/getAllTransaction',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositApproved.approvedSum': {
    method: 'POST',
    path: '/payinAccounts/getApprovedSum',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositApproved.gatewayNames': {
    method: 'POST',
    path: '/payinAccounts/getPayinGatewayName',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositApproved.fundRequest': {
    method: 'POST',
    path: '/SubAdmin/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'depositApproved.scannerData': {
    method: 'POST',
    path: '/transaction/get-scanner-data',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Unique Deposit Pending
  'uniquePending.list': {
    method: 'POST',
    path: '/transaction/unique-pending-deposits',
    encryptRequest: true,
    decryptResponse: true,
  },
  'uniquePending.fundRequest': {
    method: 'POST',
    path: '/SubAdmin/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'uniquePending.message': {
    method: 'POST',
    path: '/transaction/uniquePending-message',
    encryptRequest: true,
    decryptResponse: true,
  },
  'uniquePending.statusChange': {
    method: 'POST',
    path: '/transaction/uniquePending-status-change',
    encryptRequest: true,
    decryptResponse: true,
  },
  'uniquePending.mids': {
    method: 'POST',
    path: '/payinAccounts/getAllMidOld',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Deposit page
  'deposits.transactions': {
    method: 'POST',
    path: '/transaction/getAllTransaction',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.fundRequest': {
    method: 'POST',
    path: '/SubAdmin/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.mids': {
    method: 'POST',
    path: '/payinAccounts/getAllMidOld',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.gateways': {
    method: 'POST',
    path: '/payinAccounts/getPayinGatewayName',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.updateStatus': {
    method: 'POST',
    path: '/transaction/update-deposit-status',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.approvePending': {
    method: 'POST',
    path: '/transaction/approve-pending-by-orderId',
    encryptRequest: false,
    decryptResponse: false,
  },
  'deposits.check': {
    method: 'POST',
    path: '/transaction/check-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.scannerData': {
    method: 'POST',
    path: '/transaction/get-scanner-data',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.addCoin': {
    method: 'POST',
    path: '/coin/add',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.updateGatewayName': {
    method: 'POST',
    path: '/transaction/updatePaymentGatewayName',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.stateWise': {
    method: 'POST',
    path: '/transaction/state-deposit',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.activeCustomerState': {
    method: 'POST',
    path: '/User/active-customer-state',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.updatePaymentByOrderId': {
    method: 'POST',
    path: '/transaction/update-payment-by-orderId',
    encryptRequest: true,
    decryptResponse: true,
  },
  'deposits.updateUserOldName': {
    method: 'POST',
    path: '/User/updateUserOldName',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Withdrawal page
  'withdrawals.transactions': {
    method: 'POST',
    path: '/transaction/getAllTransaction',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.fundRequest': {
    method: 'POST',
    path: '/SubAdmin/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.payoutAccounts': {
    method: 'POST',
    path: '/payoutAccounts/getAll-active',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.statusUpdate': {
    method: 'POST',
    path: '/transaction/withdrawal-status-update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.lock': {
    method: 'POST',
    path: '/transaction/update-withdrawal-status',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.unlock': {
    method: 'POST',
    path: '/transaction/update-withdrawal-unlock',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.check': {
    method: 'POST',
    path: '/transaction/check-withdrawal',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.mids': {
    method: 'POST',
    path: '/payinAccounts/getAllMidOld',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.bulkLock': {
    method: 'POST',
    path: '/transaction/bulk-lock',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.bulkUnlock': {
    method: 'POST',
    path: '/transaction/bulk-unlock',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.bulkApprove': {
    method: 'POST',
    path: '/transaction/bulk-Approve',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.bulkManualApprove': {
    method: 'POST',
    path: '/transaction/bulk-manual-approved',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.delayReason': {
    method: 'POST',
    path: '/transaction/delay-reason',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.availableBanks': {
    method: 'POST',
    path: '/change-percentage/available-banks/get',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.createAvailableBanks': {
    method: 'POST',
    path: '/change-percentage/available-banks/create',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.updateAvailableBanks': {
    method: 'POST',
    path: '/change-percentage/available-banks/update',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.addBeneficiary': {
    method: 'POST',
    path: '/User/add-beneficiary-account',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawals.syncBeneficiary': {
    method: 'POST',
    path: '/transaction/sync-withdrawal-beneficiary-accounts',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalFund.report': {
    method: 'POST',
    path: '/transaction/withdrawal-type-provider-mid-report',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalFund.latestReport': {
    method: 'POST',
    path: '/withdrawal/latest-withdrawal-report',
    encryptRequest: true,
    decryptResponse: true,
  },
  'withdrawalFund.sheetComparison': {
    method: 'POST',
    path: '/transaction/withdrawal-sheet-comparison-report',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Fund Requests page
  'fundRequests.summary': {
    method: 'POST',
    path: '/SubAdmin/fund-request',
    encryptRequest: true,
    decryptResponse: true,
  },
  'fundRequests.coin': {
    method: 'POST',
    path: '/SubAdmin/fund-request-coin',
    encryptRequest: true,
    decryptResponse: true,
  },
  'fundRequests.withdrawalHold': {
    method: 'POST',
    path: '/SubAdmin/fund-request-withdrawal',
    encryptRequest: true,
    decryptResponse: true,
  },
  'fundRequests.depositWithdrawal': {
    method: 'POST',
    path: '/transaction/deposit-withdrawal',
    encryptRequest: true,
    decryptResponse: true,
  },
  'fundRequests.transactions': {
    method: 'POST',
    path: '/transaction/getAllTransaction',
    encryptRequest: true,
    decryptResponse: true,
  },

  // Funds (gateway / MID / payin) — large date-range dumps need a longer timeout
  'funds.upiPaymentApproved': {
    method: 'POST',
    path: '/payinAccounts/upi-payment-approved',
    encryptRequest: true,
    decryptResponse: true,
    timeout: 180000,
  },
  'funds.allPayment': {
    method: 'POST',
    path: '/payinAccounts/all-payment',
    encryptRequest: true,
    decryptResponse: true,
    timeout: 180000,
  },

  // Casino Top-up Balance
  'casinoTopup.get': {
    method: 'POST',
    path: '/change-percentage/qtech-topped-up-balance/get',
    encryptRequest: true,
    decryptResponse: true,
  },
  'casinoTopup.addQtech': {
    method: 'POST',
    path: '/change-percentage/qtech-topped-up-balance/add',
    encryptRequest: true,
    decryptResponse: true,
  },
  'casinoTopup.addBetconstruct': {
    method: 'POST',
    path: '/change-percentage/betconstruct-topped-up-balance/add',
    encryptRequest: true,
    decryptResponse: true,
  },

  // WhatsApp inbox
  'whatsapp.getCallbacks': {
    method: 'POST',
    path: '/Subadmin/get-whatsapp-statuscallbacks',
    encryptRequest: true,
    decryptResponse: true,
  },
  'whatsapp.sendExotel': {
    method: 'POST',
    path: '/subAdmin/send-exotel-whatsapp-message',
    encryptRequest: false,
    decryptResponse: false,
  },
};
