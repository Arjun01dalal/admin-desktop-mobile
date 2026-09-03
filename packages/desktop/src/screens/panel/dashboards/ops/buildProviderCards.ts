import type { DashboardMode, OpsDashboardBundle, ProviderCardModel } from './types';
import { floorNum, sumArrayField, toNum, activeCount, normalizeProviderMetrics } from './mergeMetrics';
import { buildGameMetricRows, gameNames } from './gameMetrics';
import { metricJyotishLabel } from './constants';

function row(label: string, value: unknown) {
  return { label: metricJyotishLabel(label), value: floorNum(value) };
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
  const wallet = Array.isArray(qtech.walletHistory) ? asRecord(qtech.walletHistory[0]) : {};
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
  const appClientName = nav?.appClientName || '';
  const dateState = { startDate, endDate, appClientName };
  const rateSearch = (type: string) =>
    `?${new URLSearchParams({ startDate, endDate, type }).toString()}`;
  const rateState = (type: string) => ({
    startDate,
    endDate,
    type,
    appClientName,
  });
  const aaaSearch = `?${new URLSearchParams({ startDate, endDate }).toString()}`;
  const { payload: qPayload, wallet: qWallet } = qtechPayload(bundle.qtech);
  const wco = firstOf(bundle.wco);
  const falcon = normalizeProviderMetrics(bundle.falcon);
  const jetfair = normalizeProviderMetrics(bundle.jetfair);
  const satta = asRecord(bundle.satta);
  const bc = normalizeProviderMetrics(bundle.betConstruct);
  const sb = normalizeProviderMetrics(bundle.sportBook);
  const ludo = asRecord(bundle.ludo);
  const summary = asRecord(bundle.summary);
  const active = asRecord(bundle.activeCustomers);
  const aaa = asRecord(bundle.aaa);
  const bcWallet = asRecord(Array.isArray(bc.walletHistory) ? bc.walletHistory[0] : null);
  const firstPlutus = asRecord(Array.isArray(bundle.plutus) ? bundle.plutus[0] : null);
  const qtechProfit = toNum(bundle.qtech.profit);

  // Laxmi Ashwini Payin/Payout uses dashboard summary satta fields (smBets).
  const summarySattaBet = toNum(summary.sattaMatkaTotalBetAmount);
  const summarySattaWin = toNum(summary.sattaMatkaTotalBetWinAmount);
  // Satta card + Ashwini Net Profit use sattaMarketOverallGGR (allSmBetsData).
  const sattaGgr = toNum(satta.sattaMatkaGGR ?? summary.sattaMatkaGGR);

  const plutusPayin = sumArrayField(bundle.plutus, 'totalBetAmount');
  const plutusPayout = sumArrayField(bundle.plutus, 'totalWinningAmount');
  const divaPayin = sumArrayField(bundle.indianDiva, 'totalBetAmount');
  const divaPayout = sumArrayField(bundle.indianDiva, 'totalWinningAmount');

  // Laxmi floors WCO before summing into Ashwini totals.
  const wcoBetFloored = floorNum(wco.totalBetAmount) || 0;
  const wcoWinFloored = floorNum(wco.totalWinAmount) || 0;
  // Laxmi only counts Qtech win in Ashwini payout when walletHistory is an array.
  const qtechWinForPayout = Array.isArray(bundle.qtech.walletHistory)
    ? toNum(qPayload.totalWinAmount)
    : 0;

  const vipMode = mode === 'vip';

  const totalPayin = vipMode
    ? toNum(qPayload.totalBetAmount) +
      summarySattaBet +
      toNum(aaa.totalVolume) +
      wcoBetFloored +
      toNum(jetfair.payin) +
      toNum(falcon.payin)
    : toNum(qPayload.totalBetAmount) +
      summarySattaBet +
      divaPayin +
      plutusPayin +
      toNum(ludo.playerBetAmount) +
      toNum(bc.totalBetAmount) +
      toNum(aaa.totalVolume) +
      wcoBetFloored +
      toNum(jetfair.payin) +
      toNum(sb.payin) +
      toNum(falcon.payin);

  const totalPayout = vipMode
    ? qtechWinForPayout +
      toNum(aaa.totalClientWin) +
      summarySattaWin +
      wcoWinFloored +
      toNum(jetfair.payout) +
      toNum(falcon.payout)
    : qtechWinForPayout +
      summarySattaWin +
      divaPayout +
      plutusPayout +
      toNum(bc.totalWinAmount) +
      toNum(aaa.totalClientWin) +
      wcoWinFloored +
      toNum(jetfair.payout) +
      toNum(ludo.playerWinAmount) +
      toNum(sb.payout) +
      toNum(falcon.payout);

  const totalCommission =
    toNum(aaa.totalCommission) +
    toNum(falcon.CommissionAmount) +
    toNum(jetfair.commissionAmount) +
    toNum(sb.commissionAmount) +
    toNum(bcWallet.totalCommission) +
    toNum(ludo.totalPlayerCommission) +
    toNum(wco.commissionAmount) +
    toNum(qWallet.totalCommission);

  // Laxmi Net Profit is provider-profit sum — not payin − payout.
  const wcoGgr = toNum(wco.totalBetAmount) - toNum(wco.totalWinAmount) || 0;
  const totalNetProfit = vipMode
    ? qtechProfit +
      sattaGgr +
      wcoGgr +
      toNum(falcon.final_ggr ?? falcon.finalGgr) +
      toNum(aaa.finalWinLoss) +
      (toNum(jetfair.commissionAmount) + toNum(jetfair.netpl))
    : qtechProfit +
      sattaGgr +
      wcoGgr +
      (divaPayin - divaPayout) +
      (toNum(firstPlutus.totalBetAmount) - toNum(firstPlutus.totalWinningAmount)) +
      toNum(falcon.final_ggr ?? falcon.finalGgr) +
      (toNum(bcWallet.totalCommission) + toNum(bc.ggr)) +
      toNum(aaa.finalWinLoss) +
      (toNum(sb.commissionAmount) + toNum(sb.netpl)) +
      (toNum(jetfair.commissionAmount) + toNum(jetfair.netpl)) +
      toNum(ludo.ggr);

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
  const ludoOptions = [{ value: 'All', label: 'All' }, ...(bundle.ludoGameOptions || [])];

  const cards: ProviderCardModel[] = [
    {
      id: 'totalProviders',
      title: 'Ashwini Details',
      filters: ['Ashwini'],
      showOnVip: true,
      loading,
      rows: vipMode
        ? [
            row('Total Payin', totalPayin),
            row('Total Payout', totalPayout),
            row('Net Profit', totalNetProfit),
          ]
        : [
            row('Total Payin', totalPayin),
            row('Total Payout', totalPayout),
            row('Total Commission', totalCommission),
            row('Net Profit', totalNetProfit),
          ],
    },
    {
      id: 'totalExch',
      title: 'Exaltation Details',
      filters: ['Ashwini', 'Exaltation'],
      showOnVip: false,
      loading,
      rows: [
        row('Bet Amount', toNum(aaa.totalVolume) + toNum(falcon.payin) + toNum(jetfair.payin)),
        row('Win', toNum(aaa.totalClientWin) + toNum(falcon.payout) + toNum(jetfair.payout)),
        row(
          'GGR',
          toNum(aaa.totalWinLossWithoutCommission) +
            toNum(falcon.TotalGGR ?? falcon.totalGGR) +
            toNum(jetfair.netpl),
        ),
        row(
          'Commission',
          toNum(aaa.totalCommission) +
            toNum(falcon.CommissionAmount) +
            toNum(jetfair.commissionAmount),
        ),
        row(
          'Gross GGR (Including Upline)',
          toNum(aaa.finalWinLoss) +
            toNum(jetfair.commissionAmount) +
            toNum(jetfair.netpl) +
            toNum(falcon.final_ggr ?? falcon.finalGgr),
        ),
      ],
    },
    {
      id: 'qtech',
      title: 'Ketu Details',
      filters: ['Ashwini', 'Chandra', 'Ketu'],
      showOnVip: true,
      loading,
      href: '/game-activity',
      state: { ...dateState, type: 'Qtech' },
      activeCustomerCount: activeCount(active, 'qtech'),
      activeCustomerKey: 'qtech',
      rows: [
        row('Total Bet Amount', qPayload.totalBetAmount),
        row('Total RollBack', qWallet.rollBackAmount ?? qWallet.totalRollbackAmount),
        row('Total Win Amount', qPayload.totalWinAmount),
        row('Total Commission', qWallet.totalCommission),
        {
          label: metricJyotishLabel('GGR'),
          value: (qtechProfit - toNum(qWallet.totalCommission)).toFixed(2),
        },
        {
          label: metricJyotishLabel('Total Profit'),
          value: qtechProfit.toFixed(2),
        },
      ],
    },
    {
      id: 'betConstruct',
      title: 'Budha Details',
      filters: ['Ashwini', 'Chandra', 'Budha'],
      showOnVip: false,
      loading,
      href: '/betConstructGamesList',
      state: dateState,
      rows: [
        row('Total Bet Amount', bc.totalBetAmount),
        row('Total Win Amount', bc.totalWinAmount),
        row('GGR', bc.ggr),
        row('RTP', bc.rtp),
        row('Commission', bcWallet.totalCommission),
        row('Total Roll Back Amount', bcWallet.rollBackAmount),
        row('GGR+Commission', toNum(bcWallet.totalCommission) + toNum(bc.ggr)),
      ],
    },
    {
      id: 'wco',
      title: 'Vakra Details',
      filters: ['Ashwini', 'Chandra', 'Vakra'],
      showOnVip: true,
      loading,
      href: '/game-activity',
      state: { ...dateState, type: 'Wco' },
      activeCustomerCount: activeCount(active, 'wco', 'wacs'),
      activeCustomerKey: 'wco',
      rows: [
        row('Total Bet Amount', wco.totalBetAmount),
        row('Total GGR', toNum(wco.totalBetAmount) - toNum(wco.totalWinAmount)),
        row(
          'Provider GGR',
          toNum(wco.totalBetAmount) - toNum(wco.totalWinAmount) - toNum(wco.commissionAmount),
        ),
        row('Commission', wco.commissionAmount),
        row('Total Bets', wco.totalBets),
        row('Total Win Amount', wco.totalWinAmount),
        row('Total Wins', wco.totalWins),
        {
          label: metricJyotishLabel('Net RTP'),
          value: Number.isFinite(toNum(wco.netRTP ?? wco.net_rtp ?? wco.netRtp))
            ? toNum(wco.netRTP ?? wco.net_rtp ?? wco.netRtp).toFixed(2)
            : '0.00',
        },
      ],
    },
    {
      id: 'satta',
      title: 'Shatabhisha Details',
      filters: ['Ashwini', 'Shatabhisha'],
      showOnVip: true,
      loading,
      activeCustomerCount: activeCount(active, 'sattaMatka', 'sattamatka', 'satta'),
      activeCustomerKey: 'sattamatka',
      state: dateState,
      rows: [
        row('Bet Amount', satta.sattaMatkaTotalBetAmount ?? summary.sattaMatkaTotalBetAmount),
        row('Bet Count', satta.sattaMatkaTotalBetCount ?? summary.sattaMatkaTotalBetCount),
        row(
          'Pending',
          satta.sattaMatkaTotalBetPendingAmount ?? summary.sattaMatkaTotalBetPendingAmount,
        ),
        row('Win Amount', satta.sattaMatkaTotalBetWinAmount ?? summary.sattaMatkaTotalBetWinAmount),
        row('GGR', satta.sattaMatkaGGR ?? summary.sattaMatkaGGR),
      ],
    },
    {
      id: 'sportBook',
      title: 'Shani Details',
      filters: ['Ashwini', 'Shani'],
      showOnVip: false,
      loading,
      rows: [
        row('Payin', sb.payin),
        row('Payout', sb.payout),
        row('Net P/L', sb.netpl ?? toNum(sb.payin) - toNum(sb.payout)),
        row('Commission', sb.commissionAmount),
        row('Profit', toNum(sb.commissionAmount) + toNum(sb.netpl)),
      ],
    },
    {
      id: 'ludo',
      title: 'Lagna Details',
      filters: ['Ashwini', 'Lagna'],
      showOnVip: false,
      loading,
      selectValue: selectedLudo,
      selectOptions: ludoOptions,
      selectStatsMap: bundle.ludoGameStatsMap,
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
      title: 'Jyeshtha Details',
      filters: ['Ashwini', 'Exaltation', 'Jyeshtha'],
      showOnVip: true,
      loading,
      href: '/falconRateManagement',
      search: rateSearch('jetfair'),
      state: rateState('jetfair'),
      activeCustomerCount: activeCount(active, 'jetfair'),
      activeCustomerKey: 'jetfair',
      activeCustomerLabel: 'Total Played Player',
      rows: [
        row('Payin', jetfair.payin),
        row('Payout', jetfair.payout),
        row('Net P/L', jetfair.netpl ?? toNum(jetfair.payin) - toNum(jetfair.payout)),
        row('Commission', jetfair.commissionAmount),
        row('Profit', toNum(jetfair.commissionAmount) + toNum(jetfair.netpl)),
      ],
    },
    {
      id: 'falcon',
      title: 'Phalguni Details',
      filters: ['Ashwini', 'Exaltation', 'Phalguni'],
      showOnVip: true,
      loading,
      href: '/falconRateManagement',
      search: rateSearch('falcon'),
      state: rateState('falcon'),
      activeCustomerCount: activeCount(active, 'falcon'),
      activeCustomerKey: 'falcon',
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
      title: 'Ascendant Details',
      filters: ['Ashwini', 'Exaltation', 'Ascendant'],
      showOnVip: true,
      loading,
      href: '/exchangeRateManagement',
      search: aaaSearch,
      state: dateState,
      activeCustomerCount: activeCount(active, 'exchange'),
      activeCustomerKey: 'exchange',
      activeCustomerLabel: 'Total Played Player',
      rows: [
        row('Total Bet Amount', aaa.totalVolume),
        row('Total Win', aaa.totalClientWin),
        row('Total Active Users', aaa.totalClient),
        row('GGR (Without commission)', aaa.totalWinLossWithoutCommission),
        row('Commission', aaa.totalCommission),
        row('Gross GGR', aaa.finalWinLoss),
      ],
    },
    {
      id: 'indianDiva',
      title: selectedDiva !== 'All' ? `Indu Details - ${selectedDiva}` : 'Indu Details',
      filters: ['Ashwini', 'Indu'],
      showOnVip: false,
      loading,
      selectValue: selectedDiva,
      selectOptions: divaOptions,
      onSelectChange: games?.onIndianDivaChange,
      rows: buildGameMetricRows(bundle.indianDiva, selectedDiva),
    },
    {
      id: 'plutus',
      title: selectedPlutus !== 'All' ? `Pushya Details - ${selectedPlutus}` : 'Pushya Details',
      filters: ['Ashwini', 'Pushya'],
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
