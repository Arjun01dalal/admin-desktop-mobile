export const MOBILE_PAGE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'GameDrawer', label: 'Game Page' },
  { value: 'TopGames', label: 'Top Games' },
  { value: 'GameList', label: 'WACS Casino Page' },
  { value: 'QTechGameList', label: 'QTech Casino Page' },
  { value: 'LiveChat', label: 'Live Chat' },
  { value: 'Profile', label: 'Profile Page' },
  { value: 'WalletBonusScreen', label: 'Bonus' },
  { value: 'DepositScreen', label: 'Deposit' },
  { value: 'bonus-welcome-tnc-mobile', label: 'Bonus Welcome Banner' },
  { value: 'bonus-refill-tnc-mobile', label: 'Bonus Refill Banner' },
  { value: 'bonus-referral-tnc-mobile', label: 'Bonus Referral Banner' },
] as const;

export const MOBILE_PARAM_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Nandi', label: 'Satta Matka' },
  { value: 'Falcon', label: 'Falcon' },
  { value: 'Jetfair', label: 'Jetfair' },
  { value: 'LIVECASINO', label: 'Live Casino' },
  { value: 'SLOT', label: 'Slots' },
] as const;

export const BANNER_TYPE_OPTIONS = [
  { value: 'banner', label: 'Banner' },
  { value: 'game', label: 'Game' },
  { value: 'bonusScreenBanners', label: 'Bonus Banners' },
  { value: 'exchangeBanner', label: 'Exchange Banner' },
  { value: 'registerBanner', label: 'Register Banner' },
] as const;

export const BANNER_CATEGORY_OPTIONS = [
  { value: 'casino', label: 'Casino' },
  { value: 'sattamatka', label: 'Satta Matka' },
  { value: 'exchange', label: 'Exchange' },
  { value: 'others', label: 'Others' },
] as const;

export const VIDEO_TYPE_OPTIONS = [
  { value: 'tutorialVideo', label: 'Tutorial Video' },
  { value: 'howToDepositVideo', label: 'Deposit Tutorial Video' },
] as const;

export const GAME_LAUNCH_PROVIDERS = ['Wco', 'Qtech', 'betConstruct'] as const;
export const GAME_LAUNCH_CATEGORY = 'gameLaunch';
