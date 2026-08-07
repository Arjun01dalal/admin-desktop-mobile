/** Shared types for Dashboard / VIP / Combined (ported from admin-panel-domains). */

export type DashboardMode = 'main' | 'vip' | 'combined';

export type ProviderFilter =
  | 'All'
  | 'Exchange'
  | 'Casino'
  | 'Qtech'
  | 'WCO'
  | 'SportBook'
  | 'BetConstruct'
  | 'Jetfair'
  | 'Falcon'
  | 'AAA Exchange'
  | 'Satta Matka'
  | 'Crazy Wheel'
  | 'Plutus Gaming'
  | 'Indian Diva'
  | 'Ludo';

export type MetricRow = {
  label: string;
  value: number | string;
};

export type SelectOption = { value: string; label: string };

export type CardAction = {
  label: string;
  onClick: () => void;
};

export type ProviderCardModel = {
  id: string;
  title: string;
  /** ProviderLists values that show this card. */
  filters: ProviderFilter[];
  /** Hide on VIP mode when false. */
  showOnVip?: boolean;
  rows: MetricRow[];
  activeCustomerCount?: number;
  loading?: boolean;
  /** Optional game filter dropdown (Ludo / Indian Diva / Plutus). */
  selectValue?: string;
  selectOptions?: SelectOption[];
  onSelectChange?: (value: string) => void;
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
  /** Heading-only nav card (Master Data / Live Match Total). */
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
  activeExchange: Record<string, unknown>;
  /** Optional AAA zehnPL payload (main dashboard AAA card). */
  aaa?: Record<string, unknown>;
};
