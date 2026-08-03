import { useMemo } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { DashboardFilterBar } from './DashboardFilterBar';
import { KpiStatGrid } from './KpiStatGrid';
import { ProviderMetricCard } from './ProviderMetricCard';
import type { KpiItem, ProviderCardModel } from './types';
import { floorNum, toNum } from './mergeMetrics';
import { useDashboardFilters } from './useDashboardFilters';
import { useRiskDashboardData } from './useRiskDashboardData';

function row(label: string, value: unknown) {
  return { label, value: floorNum(value) };
}

/**
 * Risk Analysis Dashboard — ported from admin-panel-domains RiskManagementDashobard.
 * Live Match nav tiles + Jetfair / Falcon / AAA / Master AAA cards.
 */
export function RiskAnalysisPage() {
  const filters = useDashboardFilters();
  const { bundle, loading, error, reload } = useRiskDashboardData(
    filters.applied,
  );

  const navCards = useMemo<KpiItem[]>(
    () => [
      {
        id: 'liveMatch',
        label: 'Live Match Total',
        value: '',
        headingOnly: true,
      },
      {
        id: 'liveMatchMaster',
        label: 'Live Match Total (Master)',
        value: '',
        headingOnly: true,
      },
      {
        id: 'liveMatchBoth',
        label: 'Live Match Total (Master & Laxmi)',
        value: '',
        headingOnly: true,
      },
      {
        id: 'liveMatchAaa',
        label: 'Live Match Total (AAA & Master AAA)',
        value: '',
        headingOnly: true,
      },
    ],
    [],
  );

  const platformCards = useMemo<ProviderCardModel[]>(() => {
    const jetfair = bundle?.jetfair ?? {};
    const falcon = bundle?.falcon ?? {};
    const aaa = bundle?.aaa ?? {};
    const masterAaa = bundle?.masterAaa ?? {};

    const jetfairNet = toNum(jetfair.netpl);
    const jetfairComm = toNum(jetfair.commissionAmount);

    return [
      {
        id: 'jetfair',
        title: 'Jetfair Platform Details',
        filters: ['All'],
        loading,
        rows: [
          row('Total Bet Amount', jetfair.payin),
          row('Total Bet Win', jetfair.payout),
          row('GGR', jetfair.netpl),
          row('Commission', jetfair.commissionAmount),
          row('Total Profit', jetfairNet + jetfairComm),
        ],
      },
      {
        id: 'falcon',
        title: 'Falcon Platform Details',
        filters: ['All'],
        loading,
        activeCustomerCount: 0,
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
        id: 'aaa',
        title: 'AAA Exch Details',
        filters: ['All'],
        loading,
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
        id: 'masterAaa',
        title: 'Master AAA Book',
        filters: ['All'],
        loading,
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
    ];
  }, [bundle, loading]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Risk Analysis
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Live match books and exchange risk metrics.
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
        onRefresh={() => void reload()}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <KpiStatGrid items={navCards} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 1.5,
          width: '100%',
          mb: 1.5,
        }}
      >
        {platformCards.slice(0, 3).map((card) => (
          <ProviderMetricCard key={card.id} card={card} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 1.5,
          width: '100%',
        }}
      >
        {platformCards.slice(3).map((card) => (
          <ProviderMetricCard key={card.id} card={card} />
        ))}
      </Box>
    </Box>
  );
}
