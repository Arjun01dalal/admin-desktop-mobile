/**
 * Material icon per nav item id — Menu hub grid tiles.
 * Fallback: category icon from navCategories.
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import type { NavCategoryId } from './navCategories';
import { NAV_CATEGORY_META } from './navCategories';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const NAV_ITEM_ICONS: Record<string, MaterialIconName> = {
  welcome: 'apps',
  dashboard: 'dashboard',
  vipDashboard: 'star',
  combinedDashboard: 'widgets',
  riskDashboard: 'warning',
  profitLoss: 'trending-up',
  houseGames: 'casino',
  leaderboard: 'emoji-events',
  callerResponsibility: 'support-agent',
  playerActivity: 'timeline',
  whatsapp: 'chat',
  gameActivity: 'sports-esports',
  callLogs: 'call',
  gtelCalls: 'phone-callback',
  c2cCampaignData: 'campaign',
  dialerPushData: 'ring-volume',
  botPerformance: 'smart-toy',
  newRegisters: 'person-add',
  stateWiseRegistration: 'map',
  users: 'people',
  loginReport: 'login',
  allUserLoginReport: 'history',
  sosBlockedUsers: 'block',
  checkersReport: 'fact-check',
  sheetDownloadReport: 'download',
  pointsReport: 'toll',
  coinRemoval: 'remove-circle',
  showMyCoinHistory: 'receipt-long',
  customerAllotment: 'assignment-ind',
  nonPerformingUser: 'person-off',
  todaysActive: 'bolt',
  feedback: 'feedback',
  betConstructLists: 'list-alt',
  casinoLists: 'grid-view',
  casinoSwitch: 'swap-horiz',
  topGames: 'leaderboard',
  casinoTopup: 'add-card',
  usersKyc: 'verified-user',
  banners: 'image',
  upiPayments: 'qr-code',
  upiLists: 'list',
  utrProvider: 'account-balance',
  instantDepositProviders: 'flash-on',
  depositProviders: 'account-balance-wallet',
  midLimits: 'tune',
  depositConfig: 'settings-applications',
  funds: 'payments',
  withdrawalProviders: 'outbound',
  botData: 'smart-toy',
  playerRtp: 'percent',
  dumpUsers: 'delete-sweep',
  callerAllotment: 'group-add',
  percentage: 'pie-chart',
  newDeposits: 'add-circle',
  deposit: 'south',
  depositList: 'format-list-bulleted',
  stateWiseDeposit: 'place',
  withdrawal: 'north',
  activeUserWithdrawal: 'pending-actions',
  blockWithdrawal: 'money-off',
  ggrAlert: 'notifications-active',
  withdrawalFund: 'account-balance',
  fundRequest: 'request-page',
  socialMedia: 'share',
  pushNotifications: 'notifications',
  whatsappMid: 'forum',
  aaaFraudBetReport: 'gavel',
  aaaBlacklistedUsers: 'person-off',
  mobileApp: 'phone-android',
  incomingBotCall: 'phone-forwarded',
  skyTalk: 'record-voice-over',
  rolesResponsibilities: 'admin-panel-settings',
  bonusWalletFundRequest: 'card-giftcard',
  bonusWalletRequests: 'redeem',
  depositApprovedReport: 'task-alt',
  uniqueDepositPending: 'hourglass-top',
};

export function iconForNavItem(
  itemId: string,
  category?: string | null,
): MaterialIconName {
  const mapped = NAV_ITEM_ICONS[itemId];
  if (mapped) return mapped;
  const cat = String(category || '').trim() as NavCategoryId;
  if (cat && cat in NAV_CATEGORY_META) {
    return NAV_CATEGORY_META[cat].icon;
  }
  return 'chevron-right';
}
