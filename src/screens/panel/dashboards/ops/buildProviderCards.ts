import type {
  DashboardMode,
  OpsDashboardBundle,
  ProviderCardModel,
} from './types';
import { floorNum, sumArrayField, toNum } from './mergeMetrics';
import { buildGameMetricRows, gameNames } from './gameMetrics';

function row(label: string, value: unknown) {
  return { label, value: floorNum(value) };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstOf(value: unknown): Record<string, unknown> {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  return asRecord(value);
}

function qtechPayload(qtech: Record<string, unknown>) {
  const payload = asRecord(qtech.payload);
  const wallet = Array.isArray(qtech.walletHistory)
    ? asRecord(qtech.walletHistory[0])
    : {};
  return { payload, wallet };
}

export type GameCardState = {
  selectedLudoGame: string;
  selectedIndianDiva: string;
  selectedPlutus: string;
  onLudoGameChange: (value: string) => void;
  onIndianDivaChange: (value: string) => void;
  onPlutusChange: (value: string) => void;
  onLudoUpdate?: () => void;
  onLudoUpdateRtp?: () => void;
};

export type ProviderNavContext = {
  startDate: string;
  endDate: string;
  appClientName?: string;
};

/** Build provider metric cards from loaded API bundle (shared by all 3 dashboards). */
export function buildProviderCards(
  mode: DashboardMode,
  bundle: OpsDashboardBundle | null,
  loading: boolean,
  games?: GameCardState,
  nav?: ProviderNavContext,
): ProviderCardModel[] {
  if (!bundle) return [];

  const startDate = nav?.startDate || '';
  const endDate = nav?.endDate || '';
  const dateState = { startDate, endDate };
  const rateSearch = (type: string) =>
    `?${new URLSearchParams({ startDate, endDate, type }).toString()}`;
  const rateState = (type: string) => ({ startDate, endDate, type });
  const aaaSearch = `?${new URLSearchParams({ startDate, endDate }).toString()}`;
  const { payload: qPayload, wallet: qWallet } = qtechPayload(bundle.qtech);
  const wco = firstOf(bundle.wco);
  const falcon = asRecord(bundle.falcon);
  const jetfair = asRecord(bundle.jetfair);
  const satta = asRecord(bundle.satta);
  const bc = asRecord(bundle.betConstruct);
  const sb = asRecord(bundle.sportBook);
  const ludo = asRecord(bundle.ludo);
  const summary = asRecord(bundle.summary);
  const active = asRecord(bundle.activeCustomers);

  const plutusPayin = sumArrayField(bundle.plutus, 'totalBetAmount');
  const plutusPayout = sumArrayField(bundle.plutus, 'totalWinningAmount');
  const divaPayin = sumArrayField(bundle.indianDiva, 'totalBetAmount');
  const divaPayout = sumArrayField(bundle.indianDiva, 'totalWinningAmount');

  const totalPayin =
    toNum(qPayload.totalBetAmount) +
    toNum(satta.sattaMatkaTotalBetAmount ?? summary.sattaMatkaTotalBetAmount) +
    divaPayin +
    plutusPayin +
    toNum(ludo.playerBetAmount) +
    toNum(bc.totalBetAmount) +
    toNum(wco.totalBetAmount) +
    toNum(jetfair.payin) +
    toNum(sb.payin) +
    toNum(falcon.payin);

  const totalPayout =
    toNum(qPayload.totalWinAmount) +
    toNum(
      satta.sattaMatkaTotalBetWinAmount ?? summary.sattaMatkaTotalBetWinAmount,
    ) +
    divaPayout +
    plutusPayout +
    toNum(ludo.playerWinAmount) +
    toNum(bc.totalWinAmount) +
    toNum(wco.totalWinAmount) +
    toNum(jetfair.payout) +
    toNum(sb.payout) +
    toNum(falcon.payout);

  const totalCommission =
    toNum(falcon.CommissionAmount) +
    toNum(jetfair.commissionAmount) +
    toNum(sb.commissionAmount) +
    toNum(
      asRecord(Array.isArray(bc.walletHistory) ? bc.walletHistory[0] : null)
        .totalCommission,
    ) +
    toNum(ludo.totalPlayerCommission) +
    toNum(wco.commissionAmount) +
    toNum(qWallet.totalCommission);

  const selectedDiva = games?.selectedIndianDiva ?? 'All';
  const selectedPlutus = games?.selectedPlutus ?? 'All';
  const selectedLudo = games?.selectedLudoGame ?? 'All';

  const divaOptions = [
    { value: 'All', label: 'All' },
    ...gameNames(bundle.indianDiva).map((name) => ({
      value: name,
      label: name,
    })),
  ];
  const plutusOptions = [
    { value: 'All', label: 'All' },
    ...gameNames(bundle.plutus).map((name) => ({ value: name, label: name })),
  ];
  const ludoOptions = [
    { value: 'All', label: 'All' },
    ...(bundle.ludoGameOptions || []),
  ];

  const cards: ProviderCardModel[] = [
    {
      id: 'totalProviders',
      title: 'Total Providers Detail',
      filters: ['All'],
      showOnVip: true,
      loading,
      rows: [
        row('Total Payin', totalPayin),
        row('Total Payout', totalPayout),
        row('Total Commission', totalCommission),
        row('Net Profit', totalPayin - totalPayout),
      ],
    },
    {
      id: 'totalExch',
      title: 'Total Exch Details',
      filters: ['All', 'Exchange'],
      showOnVip: false,
      loading,
      rows: [
        row('Bet Amount', toNum(jetfair.payin) + toNum(falcon.payin)),
        row('Win', toNum(jetfair.payout) + toNum(falcon.payout)),
        row(
          'GGR',
          toNum(jetfair.payin) +
            toNum(falcon.payin) -
            toNum(jetfair.payout) -
            toNum(falcon.payout),
        ),
        row(
          'Commission',
          toNum(jetfair.commissionAmount) + toNum(falcon.CommissionAmount),
        ),
      ],
    },
    {
      id: 'qtech',
      title: 'Qtech Platform Details',
      filters: ['All', 'Casino', 'Qtech'],
      showOnVip: true,
      loading,
      href: '/game-activity',
      state: { ...dateState, type: 'Qtech' },
      activeCustomerCount: toNum(asRecord(active.qtech).count),
      rows: [
        row('Total Bet Amount', qPayload.totalBetAmount),
        row(
          'Total RollBack',
          qWallet.totalRollbackAmount ?? qPayload.totalRollbackAmount,
        ),
        row('Total Win Amount', qPayload.totalWinAmount),
        row('Total Commission', qWallet.totalCommission),
        row(
          'GGR',
          toNum(qPayload.totalBetAmount) - toNum(qPayload.totalWinAmount),
        ),
        row('Total Profit', qWallet.totalProfit ?? qPayload.totalProfit),
      ],
    },
    {
      id: 'betConstruct',
      title: 'BetConstruct Platform Details',
      filters: ['All', 'Casino', 'BetConstruct'],
      showOnVip: false,
      loading,
      href: '/betConstructGamesList',
      state: dateState,
      rows: [
        row('Total Bet Amount', bc.totalBetAmount),
        row('Total Win Amount', bc.totalWinAmount),
        row('GGR', toNum(bc.totalBetAmount) - toNum(bc.totalWinAmount)),
        row('RTP', bc.rtp),
        row(
          'Commission',
          asRecord(Array.isArray(bc.walletHistory) ? bc.walletHistory[0] : null)
            .totalCommission,
        ),
      ],
    },
    {
      id: 'wco',
      title: 'WCO Platform Details',
      filters: ['All', 'Casino', 'WCO'],
      showOnVip: true,
      loading,
      href: '/game-activity',
      state: { ...dateState, type: 'Wco' },
      activeCustomerCount: toNum(asRecord(active.wco).count),
      rows: [
        row('Total Bet Amount', wco.totalBetAmount),
        row('Total GGR', wco.totalGGR ?? wco.ggr),
        row('Provider GGR', wco.providerGGR),
        row('Commission', wco.commissionAmount),
        row('Total Win Amount', wco.totalWinAmount),
        row('Net RTP', wco.net_rtp ?? wco.netRtp),
      ],
    },
    {
      id: 'satta',
      title: 'Satta Matka Details',
      filters: ['All', 'Satta Matka'],
      showOnVip: true,
      loading,
      activeCustomerCount: toNum(asRecord(active.sattaMatka).count),
      rows: [
        row(
          'Bet Amount',
          satta.sattaMatkaTotalBetAmount ?? summary.sattaMatkaTotalBetAmount,
        ),
        row(
          'Bet Count',
          satta.sattaMatkaTotalBetCount ?? summary.sattaMatkaTotalBetCount,
        ),
        row(
          'Pending',
          satta.sattaMatkaTotalBetPendingAmount ??
            summary.sattaMatkaTotalBetPendingAmount,
        ),
        row(
          'Win Amount',
          satta.sattaMatkaTotalBetWinAmount ??
            summary.sattaMatkaTotalBetWinAmount,
        ),
        row('GGR', satta.sattaMatkaGGR ?? summary.sattaMatkaGGR),
      ],
    },
    {
      id: 'sportBook',
      title: 'SportBook Details',
      filters: ['All', 'SportBook'],
      showOnVip: false,
      loading,
      rows: [
        row('Payin', sb.payin),
        row('Payout', sb.payout),
        row('Net P/L', sb.netpl ?? toNum(sb.payin) - toNum(sb.payout)),
        row('Commission', sb.commissionAmount),
        row('Profit', sb.profit),
      ],
    },
    {
      id: 'ludo',
      title: 'Ludo Platform Details',
      filters: ['All', 'Ludo'],
      showOnVip: false,
      loading,
      selectValue: selectedLudo,
      selectOptions: ludoOptions,
      onSelectChange: games?.onLudoGameChange,
      actions: [
        {
          label: 'Update',
          onClick: () => games?.onLudoUpdate?.(),
        },
        {
          label: 'Update RTP',
          onClick: () => games?.onLudoUpdateRtp?.(),
        },
      ],
      rows: [
        row('Total Bet Amount', ludo.playerBetAmount),
        row('Total Win Amount', ludo.playerWinAmount),
        row('Unique Player', ludo.uniquePlayers),
        row('Total Player Commission', ludo.totalPlayerCommission),
        row('RTP', Math.round(toNum(ludo.rtp))),
        row('GGR', Math.round(toNum(ludo.ggr))),
      ],
    },
    {
      id: 'jetfair',
      title: 'Jetfair Exchange Details',
      filters: ['All', 'Exchange', 'Jetfair'],
      showOnVip: true,
      loading,
      href: '/falconRateManagement',
      search: rateSearch('jetfair'),
      state: rateState('jetfair'),
      activeCustomerCount: toNum(asRecord(active.jetfair).count),
      rows: [
        row('Total Exchange Players', jetfair.totalPlayers ?? jetfair.players),
        row('Payin', jetfair.payin),
        row('Payout', jetfair.payout),
        row(
          'Net P/L',
          jetfair.netpl ?? toNum(jetfair.payin) - toNum(jetfair.payout),
        ),
        row('Commission', jetfair.commissionAmount),
        row('Profit', jetfair.profit),
      ],
    },
    {
      id: 'falcon',
      title: 'Falcon Exchange Details',
      filters: ['All', 'Exchange', 'Falcon'],
      showOnVip: true,
      loading,
      href: '/falconRateManagement',
      search: rateSearch('falcon'),
      state: rateState('falcon'),
      activeCustomerCount: toNum(asRecord(active.falcon).count),
      rows: [
        row('Payin', falcon.payin),
        row('Payout', falcon.payout),
        row('Total GGR', falcon.TotalGGR ?? falcon.totalGGR),
        row('Commission', falcon.CommissionAmount),
        row('Final GGR', falcon.final_ggr ?? falcon.finalGgr),
      ],
    },
    {
      id: 'aaa',
      title: 'AAA Exch Details',
      filters: ['All', 'Exchange', 'AAA Exchange'],
      showOnVip: false,
      loading,
      href: '/exchangeRateManagement',
      search: aaaSearch,
      activeCustomerCount: toNum(asRecord(active.exchange).count),
      rows: [
        row('Total Bet Amount', asRecord(bundle.aaa).totalVolume),
        row('Total Win', asRecord(bundle.aaa).totalClientWin),
        row('Total Active Users', asRecord(bundle.aaa).totalClient),
        row(
          'GGR (Without commission)',
          asRecord(bundle.aaa).totalWinLossWithoutCommission,
        ),
        row('Commission', asRecord(bundle.aaa).totalCommission),
        row('Gross GGR', asRecord(bundle.aaa).finalWinLoss),
      ],
    },
    {
      id: 'indianDiva',
      title:
        selectedDiva !== 'All'
          ? `Indian Diva Games - ${selectedDiva}`
          : 'Indian Diva Games',
      filters: ['All', 'Indian Diva'],
      showOnVip: false,
      loading,
      selectValue: selectedDiva,
      selectOptions: divaOptions,
      onSelectChange: games?.onIndianDivaChange,
      rows: buildGameMetricRows(bundle.indianDiva, selectedDiva),
    },
    {
      id: 'plutus',
      title:
        selectedPlutus !== 'All'
          ? `Plutus Games - ${selectedPlutus}`
          : 'Plutus Games',
      filters: ['All', 'Plutus Gaming'],
      showOnVip: false,
      loading,
      selectValue: selectedPlutus,
      selectOptions: plutusOptions,
      onSelectChange: games?.onPlutusChange,
      rows: buildGameMetricRows(bundle.plutus, selectedPlutus),
    },
  ];

  if (mode === 'vip') {
    return cards.filter((c) => c.showOnVip !== false);
  }
  return cards;
}
