import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import { DashboardFilterBar } from './ops/DashboardFilterBar';
import { ProviderMetricCard } from './ops/ProviderMetricCard';
import { floorNum, toNum } from './ops/mergeMetrics';
import { useDashboardFilters } from './ops/useDashboardFilters';
import type { ProviderCardModel } from './ops/types';

function row(label: string, value: unknown) {
  return { label, value: floorNum(value) };
}

type MetricValue = number | string | null;
type ProviderMetrics = {
  totalBetAmount?: MetricValue;
  totalWinAmount?: MetricValue;
  commissionAmount?: MetricValue;
  totalBets?: MetricValue;
  totalWins?: MetricValue;
  netRTP?: MetricValue;
  payin?: MetricValue;
  payout?: MetricValue;
  TotalGGR?: MetricValue;
  totalGGR?: MetricValue;
  CommissionAmount?: MetricValue;
  final_ggr?: MetricValue;
  finalGgr?: MetricValue;
  sattaMatkaTotalBetAmount?: MetricValue;
  sattaMatkaTotalBetCount?: MetricValue;
  sattaMatkaTotalBetPendingAmount?: MetricValue;
  sattaMatkaTotalBetWinAmount?: MetricValue;
  sattaMatkaGGR?: MetricValue;
  totalVolume?: MetricValue;
  totalClientWin?: MetricValue;
  totalClient?: MetricValue;
  totalWinLossWithoutCommission?: MetricValue;
  totalCommission?: MetricValue;
  finalWinLoss?: MetricValue;
};

type MasterResponse = ProviderMetrics | ProviderMetrics[];

type MasterBundle = {
  wco: ProviderMetrics;
  falcon: ProviderMetrics;
  satta: ProviderMetrics;
  masterAaa: ProviderMetrics;
};

/**
 * Master Dashboard — ported from laxminarayan MasterDashboard.
 * Opened from Dashboard "Master Data" KPI (`/masterDashboard`).
 */
export function MasterDashboardPage() {
  const navigate = useNavigate();
  const filters = useDashboardFilters();
  const [bundle, setBundle] = useState<MasterBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const base: { startDate: string; endDate: string; clientName?: string } = {
        startDate: filters.applied.startDate || todayIST(),
        endDate: filters.applied.endDate || todayIST(),
      };
      if (filters.applied.appClientName) {
        base.clientName = filters.applied.appClientName;
      }
      const datesOnly = {
        startDate: String(base.startDate),
        endDate: String(base.endDate),
      };

      const [wco, falcon, satta, masterAaa] = await Promise.all([
        secureApi<MasterResponse>('dashboard.masterWco', base),
        secureApi<MasterResponse>('dashboard.masterFalcon', base),
        secureApi<MasterResponse>('dashboard.masterSatta', base),
        secureApi<MasterResponse>('dashboard.masterAaaZehnPl', datesOnly),
      ]);

      if (!isCurrent(gen)) return;

      const failed = [wco, falcon, satta, masterAaa].find((r) => !r.ok);
      if (failed && !wco.ok && !falcon.ok && !satta.ok && !masterAaa.ok) {
        setError(failed.message || 'Failed to load master dashboard');
        setBundle(null);
        return;
      }

      setBundle({
        wco: Array.isArray(wco.data) ? (wco.data[0] ?? {}) : (wco.data ?? {}),
        falcon: Array.isArray(falcon.data) ? (falcon.data[0] ?? {}) : (falcon.data ?? {}),
        satta: Array.isArray(satta.data) ? (satta.data[0] ?? {}) : (satta.data ?? {}),
        masterAaa: Array.isArray(masterAaa.data)
          ? (masterAaa.data[0] ?? {})
          : (masterAaa.data ?? {}),
      });
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
      setBundle(null);
    } finally {
      if (isCurrent(gen)) {
        end();
        setLoading(false);
      }
    }
  }, [
    begin,
    end,
    filters.applied.appClientName,
    filters.applied.endDate,
    filters.applied.startDate,
    isCurrent,
    next,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const startDate = filters.applied.startDate || todayIST();
  const endDate = filters.applied.endDate || todayIST();
  const rateSearch = useCallback(
    (type: string) => `?${new URLSearchParams({ startDate, endDate, type }).toString()}`,
    [startDate, endDate],
  );
  const aaaSearch = `?${new URLSearchParams({ startDate, endDate }).toString()}`;

  const cards = useMemo<ProviderCardModel[]>(() => {
    const wco = bundle?.wco ?? {};
    const falcon = bundle?.falcon ?? {};
    const satta = bundle?.satta ?? {};
    const masterAaa = bundle?.masterAaa ?? {};
    const bet = toNum(wco.totalBetAmount);
    const win = toNum(wco.totalWinAmount);
    const commission = toNum(wco.commissionAmount);

    return [
      {
        id: 'wco',
        title: 'Vakra Details',
        filters: ['Ashwini'],
        loading,
        href: '/game-activity',
        state: { startDate, endDate, provider: 'wco' },
        rows: [
          row('Total Bet Amount', bet),
          row('Total GGR', bet - win),
          row('Provider GGR', bet - win - commission),
          row('Total commission Amount', commission),
          row('Total Bets', wco.totalBets),
          row('Total Win Amount', win),
          row('Total Wins', wco.totalWins),
          {
            label: 'Net RTP',
            value: Number.isFinite(toNum(wco.netRTP)) ? toNum(wco.netRTP).toFixed(2) : 0,
          },
        ],
      },
      {
        id: 'falcon',
        title: 'Phalguni Details',
        filters: ['Ashwini'],
        loading,
        href: '/falconRateManagement',
        search: rateSearch('falcon'),
        state: { startDate, endDate, type: 'falcon' },
        rows: [
          row('Total Bet Amount', falcon.payin),
          row('Total Win Amount', falcon.payout),
          row('GGR', falcon.TotalGGR ?? falcon.totalGGR),
          row('Commission', falcon.CommissionAmount),
          row('GGR - Upline + Commission', falcon.final_ggr ?? falcon.finalGgr),
        ],
      },
      {
        id: 'masterAaa',
        title: 'Ascendant Details',
        filters: ['Ashwini'],
        loading,
        href: '/exchangeRateManagement',
        search: aaaSearch,
        state: { startDate, endDate },
        rows: [
          row('Total Bet Amount', masterAaa.totalVolume),
          row('Total Win', masterAaa.totalClientWin),
          row('Total Active Users', masterAaa.totalClient),
          row('GGR (Without commission)', masterAaa.totalWinLossWithoutCommission),
          row('Commission', masterAaa.totalCommission),
          row('Gross GGR', masterAaa.finalWinLoss),
        ],
      },
      {
        id: 'satta',
        title: 'Shatabhisha Details',
        filters: ['Ashwini'],
        loading,
        href: '/falconRateManagement',
        search: rateSearch('falcon'),
        rows: [
          row('Total Bet Amount', satta.sattaMatkaTotalBetAmount),
          row('Total Bet Count', satta.sattaMatkaTotalBetCount),
          row('Total Bet Pending Amount', satta.sattaMatkaTotalBetPendingAmount),
          row('Total Win Amount', satta.sattaMatkaTotalBetWinAmount),
          row('GGR', satta.sattaMatkaGGR),
        ],
      },
    ];
  }, [aaaSearch, bundle, endDate, loading, rateSearch, startDate]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <DashboardFilterBar
        title="Master Dashboard"
        summary="Master / VIP exchange books (fairbets)."
        startDate={filters.startDate}
        endDate={filters.endDate}
        appClientName={filters.appClientName}
        filterBy={filters.filterBy}
        appOptions={CLIENT_NAMES}
        showProviderFilter={false}
        loading={loading}
        onStartDateChange={filters.setStartDate}
        onEndDateChange={filters.setEndDate}
        onAppChange={filters.setAppClientName}
        onFilterByChange={filters.setFilterBy}
        onApply={filters.apply}
        onAllData={filters.clearAll}
        onRefresh={() => void load()}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {cards.map((card) => (
          <ProviderMetricCard
            key={card.id}
            card={card}
            onClick={
              card.href
                ? () =>
                    navigate(
                      {
                        pathname: card.href!,
                        search: card.search || '',
                      },
                      { state: card.state },
                    )
                : undefined
            }
          />
        ))}
      </Box>
    </Box>
  );
}
