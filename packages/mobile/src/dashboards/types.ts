/** Shared types for Dashboard / VIP / Combined (ported from admin-panel-domains). */

export type DashboardMode = 'main' | 'vip' | 'combined';

/** Filter By — Astro / Jyotish display names (also used as filter values). */
export type ProviderFilter =
  | 'Ashwini'
  | 'Exaltation'
  | 'Chandra'
  | 'Ketu'
  | 'Vakra'
  | 'Shani'
  | 'Budha'
  | 'Jyeshtha'
  | 'Phalguni'
  | 'Ascendant'
  | 'Shatabhisha'
  | 'Chitra'
  | 'Pushya'
  | 'Indu'
  | 'Lagna';

export type MetricRow = {
  label: string;
  value: number | string;
  /** Optional metric-specific drilldown (for example Ludo GGR details). */
  onPress?: () => void;
};

export type SelectOption = { value: string; label: string };

export type CardAction = {
  label: string;
  onClick: () => void;
};

export type ProviderCardModel = {
  id: string;
  title: string;
  /** Provider filter names that show this card. */
  filters: ProviderFilter[];
  /** Hide on VIP mode when false. */
  showOnVip?: boolean;
  rows: MetricRow[];
  activeCustomerCount?: number;
  /**
   * Laxmi ActiveUserData customerKey (qtech / wco / jetfair / falcon /
   * sattamatka / exchange). When set, player count is clickable.
   */
  activeCustomerKey?: string;
  /** Override label (e.g. Total Exchange Players on Jetfair / AAA). */
  activeCustomerLabel?: string;
  loading?: boolean;
  /** Optional game filter dropdown (Ludo / Diva / Plutus). */
  selectValue?: string;
  selectOptions?: SelectOption[];
  onSelectChange?: (value: string) => void;
  /** Laxmi Ludo dropdown: open user GGR report for the tapped game row. */
  onSelectGgrPress?: (gameId: string, ggr: number) => void;
  /**
   * When set (Lagna / Ludo card), select menu renders Game|Players|Bet|Win|RTP|GGR
   * table like laxminarayan Dashboard.
   */
  selectStatsMap?: Record<
    string,
    {
      uniquePlayers: number;
      bet: number;
      win: number;
      ggr: number;
      rtp: number;
    }
  >;
  /** Footer action links (Update / Update RTP). */
  actions?: CardAction[];
  /** Card body click → navigate (laxminarayan dashboard cards). */
  href?: string;
  state?: Record<string, unknown>;
  /** Query string appended to href (e.g. `?type=jetfair&…`). */
  search?: string;
};

export type KpiItem = {
  id: string;
  label: string;
  value: number | string;
  prefix?: string;
  href?: string;
  /** Optional react-router location state when navigating via href. */
  state?: Record<string, unknown>;
  /** Heading-only nav card (Master Data / Panchang / Live Match Total / Gochar). */
  headingOnly?: boolean;
};

export type DashboardFilters = {
  startDate: string;
  endDate: string;
  appClientName: string;
  filterBy: ProviderFilter;
};

export type GameRow = {
  gameName?: string;
  totalBetAmount?: number;
  totalWinningAmount?: number;
  totalBets?: number;
  totalWins?: number;
  RTP?: number;
  [key: string]: unknown;
};

export type OpsDashboardBundle = {
  summary: Record<string, unknown>;
  depositCount: Record<string, unknown>;
  depositWithdrawal: Record<string, unknown>;
  activeCustomers: Record<string, unknown>;
  qtech: Record<string, unknown>;
  wco: unknown;
  falcon: Record<string, unknown>;
  jetfair: Record<string, unknown>;
  satta: Record<string, unknown>;
  betConstruct: Record<string, unknown>;
  sportBook: Record<string, unknown>;
  plutus: unknown;
  indianDiva: unknown;
  ludo: Record<string, unknown>;
  ludoGameOptions: SelectOption[];
  /** Per-game house-stats for Ludo select table (All + each gameId). */
  ludoGameStatsMap: Record<
    string,
    {
      uniquePlayers: number;
      bet: number;
      win: number;
      ggr: number;
      rtp: number;
    }
  >;
  activeExchange: Record<string, unknown>;
  /** Optional AAA zehnPL payload (main dashboard AAA card). */
  aaa?: Record<string, unknown>;
};
