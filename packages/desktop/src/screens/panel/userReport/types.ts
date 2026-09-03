export type UserReportTab =
  | 'wallet_history'
  | 'game_history'
  | 'starline_history'
  | 'king_bazar_history'
  | 'worli_history'
  | 'qtech_history'
  | 'jetfair_history'
  | 'falcon_history'
  | 'coins'
  | 'add_bonus_coins'
  | 'remove_bonus_coins'
  | 'fund_request'
  | 'provider_history'
  | 'Qtech_Missing_Bets'
  | 'jetfairprovider_history'
  | 'sm_provider-history'
  | 'qtech_bet_details'
  | 'crazzy_wheel'
  | 'settle_sm'
  | 'settle_jetfair'
  | 'player_rtp';

export const USER_REPORT_TABS: { id: UserReportTab; label: string }[] = [
  { id: 'wallet_history', label: 'Wallet History' },
  { id: 'game_history', label: 'Game History' },
  { id: 'starline_history', label: 'Starline History' },
  { id: 'king_bazar_history', label: 'King Bazar History' },
  { id: 'worli_history', label: 'Instant Win History' },
  { id: 'qtech_history', label: 'Qtech History' },
  { id: 'jetfair_history', label: 'JetFair History' },
  { id: 'falcon_history', label: 'Falcon History' },
  { id: 'coins', label: 'Coins' },
  { id: 'add_bonus_coins', label: 'Add Bonus Coins' },
  { id: 'remove_bonus_coins', label: 'Remove Bonus Coins' },
  { id: 'fund_request', label: 'Fund Request' },
  { id: 'provider_history', label: 'Qtech Provider History' },
  { id: 'Qtech_Missing_Bets', label: 'Qtech Missing Bets' },
  { id: 'jetfairprovider_history', label: 'Jetfair Provider History' },
  { id: 'sm_provider-history', label: 'SM Provider History' },
  { id: 'qtech_bet_details', label: 'Qtech bet details' },
  { id: 'crazzy_wheel', label: 'Crazzy wheel' },
  { id: 'settle_sm', label: 'Settle SM Bets' },
  { id: 'settle_jetfair', label: 'Settle Jetfair Bets' },
  { id: 'player_rtp', label: 'Player RTP' },
];

export type EncryptedUser = {
  encryptedUserName?: string;
  createdAt?: string;
  createdOn?: string;
  activeUser?: string;
  lastActivity?: string;
  updatedOn?: string;
  updatedAt?: string;
};

export type WalletRow = {
  _id?: string;
  providerName?: string;
  action?: string;
  amount?: number;
  balance?: number;
  lastBalance?: number;
  transactionType?: string;
  commissionAmount?: number;
  createdOn?: string;
  updatedOn?: string;
  description?: Record<string, unknown>;
  [key: string]: unknown;
};
