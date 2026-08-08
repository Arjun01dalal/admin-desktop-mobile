import { useMemo, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { todayIST } from '@/utils/dates';
import { ActiveExchangePanel } from './ActiveExchangePanel';
import { buildKpiItems } from './buildKpiItems';
import { buildProviderCards } from './buildProviderCards';
import { VIP_CLIENT_NAMES } from './constants';
import { DashboardFilterBar } from './DashboardFilterBar';
import { KpiStatGrid } from './KpiStatGrid';
import {
  LudoDetailsModal,
  type LudoModalAction,
} from './LudoDetailsModal';
import { ProviderCardGrid } from './ProviderCardGrid';
import type { DashboardMode } from './types';
import { useDashboardFilters } from './useDashboardFilters';
import { useOpsDashboardData } from './useOpsDashboardData';

const TITLES: Record<DashboardMode, { title: string; description: string }> = {
  main: {
    title: 'Dashboard',
    description: 'Ops KPIs and provider GGR for the selected date range.',
  },
  vip: {
    title: 'VIP Dashboard',
    description: 'VIP provider performance (Fairbets VIP apps).',
  },
  combined: {
    title: 'Combined Dashboard',
    description: 'Aggregated provider metrics across platforms.',
  },
};

type Props = {
  mode: DashboardMode;
};

/**
 * Shared shell for Dashboard / VIP Dashboard / Combined Dashboard.
 * Mode only changes title, app list, KPI visibility, and provider card subset.
 */
export function OpsDashboardPage({ mode }: Props) {
  const meta = TITLES[mode];
  const filters = useDashboardFilters();
  const {
    bundle,
    loading,
    error,
    reload,
    reloadLudo,
    reloadActiveExchange,
  } = useOpsDashboardData(mode, filters.applied);

  const [selectedLudoGame, setSelectedLudoGame] = useState('All');
  const [selectedIndianDiva, setSelectedIndianDiva] = useState('All');
  const [selectedPlutus, setSelectedPlutus] = useState('All');
  const [ludoModalOpen, setLudoModalOpen] = useState(false);
  const [ludoModalAction, setLudoModalAction] =
    useState<LudoModalAction>(null);

  const appOptions =
    mode === 'vip' ? VIP_CLIENT_NAMES : (CLIENT_NAMES as readonly string[]);

  const ludoGameIds = useMemo(
    () => (bundle?.ludoGameOptions || []).map((o) => o.value),
    [bundle?.ludoGameOptions],
  );

  const kpiItems = useMemo(
    () =>
      buildKpiItems(
        mode,
        bundle,
        filters.applied.startDate,
        filters.applied.endDate,
        todayIST(),
      ),
    [mode, bundle, filters.applied.startDate, filters.applied.endDate],
  );

  const providerCards = useMemo(
    () =>
      buildProviderCards(
        mode,
        bundle,
        loading,
        {
          selectedLudoGame,
          selectedIndianDiva,
          selectedPlutus,
          onLudoGameChange: (value) => {
            setSelectedLudoGame(value);
            void reloadLudo(value);
          },
          onIndianDivaChange: setSelectedIndianDiva,
          onPlutusChange: setSelectedPlutus,
          onLudoUpdate: () => {
            setLudoModalAction('update');
            setLudoModalOpen(true);
          },
          onLudoUpdateRtp: () => {
            setLudoModalAction('rtp');
            setLudoModalOpen(true);
          },
        },
        {
          startDate: filters.applied.startDate,
          endDate: filters.applied.endDate,
          appClientName: filters.applied.appClientName,
        },
      ),
    [
      mode,
      bundle,
      loading,
      selectedLudoGame,
      selectedIndianDiva,
      selectedPlutus,
      reloadLudo,
      filters.applied.startDate,
      filters.applied.endDate,
      filters.applied.appClientName,
    ],
  );

  const activeExchangeName = String(
    bundle?.activeExchange?.activeExchange ?? '',
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        {meta.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {meta.description}
      </Typography>

      <DashboardFilterBar
        startDate={filters.startDate}
        endDate={filters.endDate}
        appClientName={filters.appClientName}
        filterBy={filters.filterBy}
        appOptions={appOptions}
        showProviderFilter
        loading={loading}
        onStartDateChange={filters.setStartDate}
        onEndDateChange={filters.setEndDate}
        onAppChange={filters.setAppClientName}
        onFilterByChange={filters.setFilterBy}
        onApply={filters.apply}
        onRefresh={() => {
          setSelectedLudoGame('All');
          setSelectedIndianDiva('All');
          setSelectedPlutus('All');
          void reload();
        }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <KpiStatGrid items={kpiItems} />

      <ActiveExchangePanel
        activeExchangeName={activeExchangeName}
        onUpdated={() => void reloadActiveExchange()}
      />

      <ProviderCardGrid cards={providerCards} filterBy={filters.filterBy} />

      <LudoDetailsModal
        open={ludoModalOpen}
        action={ludoModalAction}
        existingGameIds={ludoGameIds}
        onClose={() => {
          setLudoModalOpen(false);
          setLudoModalAction(null);
        }}
        onGameIdsUpdated={() => void reload()}
      />
    </Box>
  );
}
