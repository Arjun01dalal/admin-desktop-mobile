import { useMemo } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { DashboardFilterBar } from './DashboardFilterBar';
import { KpiStatGrid } from './KpiStatGrid';
import { ProviderMetricCard } from './ProviderMetricCard';
import type { KpiItem, ProviderCardModel } from './types';
import { floorNum, toNum } from './mergeMetrics';
import { useDashboardFilters } from './useDashboardFilters';
import { useRiskDashboardData } from './useRiskDashboardData';
import {
  RISK_CARD_TITLES,
  RISK_NAV_MAP,
  metricJyotishLabel,
} from './jyotishMapping';

function row(label: string, value: unknown) {
  return { label: metricJyotishLabel(label), value: floorNum(value) };
}

/**
 * Risk Analysis Dashboard — ported from admin-panel-domains RiskManagementDashobard.
 * Gochar nav tiles + Jyeshtha / Phalguni / Ascendant cards.
 */
export function RiskAnalysisPage() {
  const navigate = useNavigate();
  const filters = useDashboardFilters();
  const { bundle, loading, error, reload } = useRiskDashboardData(
    filters.applied,
  );

  const dateQuery = useMemo(() => {
    const q = new URLSearchParams({
      startDate: filters.applied.startDate,
      endDate: filters.applied.endDate,
    });
    return q.toString();
  }, [filters.applied.endDate, filters.applied.startDate]);

  const dateState = useMemo(
    () => ({
      startDate: filters.applied.startDate,
      endDate: filters.applied.endDate,
    }),
    [filters.applied.endDate, filters.applied.startDate],
  );

  const navCards = useMemo<KpiItem[]>(
    () =>
      RISK_NAV_MAP.map((item) => ({
        id: item.id,
        label: item.jyotish,
        value: '',
        headingOnly: true,
        href: item.href,
        state: dateState,
      })),
    [dateState],
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
        title: 'Jyeshtha Details',
        filters: ['Ashwini'],
        loading,
        href: '/falconRateManagement',
        search: `?${dateQuery}&type=jetfair`,
        state: { ...dateState, type: 'jetfair' },
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
        title: 'Phalguni Details',
        filters: ['Ashwini'],
        loading,
        href: '/falconRateManagement',
        search: `?${dateQuery}&type=falcon`,
        state: { ...dateState, type: 'falcon' },
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
        title: 'Ascendant Details',
        filters: ['Ashwini'],
        loading,
        href: '/exchangeRateManagement',
        search: `?${dateQuery}`,
        rows: [
          row('Total Bet Amount', aaa.totalVolume),
          row('Total Win', aaa.totalClientWin),
          row('Total Active Users', aaa.totalClient),
          row(
            'GGR (Without commission)',
            aaa.totalWinLossWithoutCommission,
          ),
          row('Commission', aaa.totalCommission),
          row('Gross GGR', aaa.finalWinLoss),
        ],
      },
      {
        id: 'masterAaa',
        title: RISK_CARD_TITLES.masterAaaBook.jyotish,
        filters: ['Ashwini'],
        loading,
        href: '/masterDashboard',
        state: dateState,
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
  }, [bundle, dateQuery, dateState, loading]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Risk Analysis
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Gochar books and Exaltation risk metrics.
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
