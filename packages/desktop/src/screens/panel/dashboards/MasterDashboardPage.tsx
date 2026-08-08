import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Typography } from '@mui/material';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import { DashboardFilterBar } from './ops/DashboardFilterBar';
import { ProviderMetricCard } from './ops/ProviderMetricCard';
import { floorNum, toNum } from './ops/mergeMetrics';
import { useDashboardFilters } from './ops/useDashboardFilters';
import type { ProviderCardModel } from './ops/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstRow(value: unknown): Record<string, unknown> {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  return asRecord(value);
}

function row(label: string, value: unknown) {
  return { label, value: floorNum(value) };
}

type MasterBundle = {
  wco: Record<string, unknown>;
  falcon: Record<string, unknown>;
  satta: Record<string, unknown>;
  masterAaa: Record<string, unknown>;
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
      const base: Record<string, unknown> = {
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
        secureApi('dashboard.masterWco', base),
        secureApi('dashboard.masterFalcon', base),
        secureApi('dashboard.masterSatta', base),
        secureApi('dashboard.masterAaaZehnPl', datesOnly),
      ]);

      if (!isCurrent(gen)) return;

      const failed = [wco, falcon, satta, masterAaa].find((r) => !r.ok);
      if (failed && !wco.ok && !falcon.ok && !satta.ok && !masterAaa.ok) {
        setError(failed.message || 'Failed to load master dashboard');
        setBundle(null);
        return;
      }

      setBundle({
        wco: firstRow(wco.ok ? wco.data : null),
        falcon: asRecord(falcon.ok ? falcon.data : null),
        satta: asRecord(satta.ok ? satta.data : null),
        masterAaa: asRecord(masterAaa.ok ? masterAaa.data : null),
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
  const rateSearch = (type: string) =>
    `?${new URLSearchParams({ startDate, endDate, type }).toString()}`;
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
            value: Number.isFinite(toNum(wco.netRTP))
              ? toNum(wco.netRTP).toFixed(2)
              : 0,
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
          row(
            'GGR - Upline + Commission',
            falcon.final_ggr ?? falcon.finalGgr,
          ),
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
          row(
            'GGR (Without commission)',
            masterAaa.totalWinLossWithoutCommission,
          ),
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
          row(
            'Total Bet Pending Amount',
            satta.sattaMatkaTotalBetPendingAmount,
          ),
          row('Total Win Amount', satta.sattaMatkaTotalBetWinAmount),
          row('GGR', satta.sattaMatkaGGR),
        ],
      },
    ];
  }, [aaaSearch, bundle, endDate, loading, startDate]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Master Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Master / VIP exchange books (fairbets).
      </Typography>

      <DashboardFilterBar
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
