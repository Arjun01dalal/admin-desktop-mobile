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
  'ops.casinoEditGame': {
    method: 'POST',
    path: '/Qtech/Edit-Games',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.nonPerformingUser': {
    method: 'POST',
    path: '/User/nonPerformingUser',
    encryptRequest: true,
    decryptResponse: true,
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
    decryptResponse: false,
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
  'ops.kycReject': {
    method: 'POST',
    path: '/kyc/reject',
    encryptRequest: true,
    decryptResponse: true,
  },
  'ops.kycApprove': {
    method: 'POST',
    path: '/kyc/kyc',
    encryptRequest: true,
    decryptResponse: true,
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
  'dashboard.nonPerformingUser': {
    method: 'POST',
    path: '/User/nonPerformingUser',
    encryptRequest: true,
    decryptResponse: true,
  },
  'analytics.userBalance': {
    method: 'POST',
    path: '/change-percentage/get-user-balance',
    encryptRequest: true,
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
};
