/**
 * Shared shell for Dashboard / VIP Dashboard / Combined Dashboard.
 * Port of desktop OpsDashboardPage — mode changes title, app list,
 * KPI visibility, and provider card subset.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CLIENT_NAMES } from '@astro/shared';
import { colors, spacing } from '../../theme';
import { buildKpiItems } from '../../dashboards/buildKpiItems';
import { buildProviderCards } from '../../dashboards/buildProviderCards';
import { VIP_CLIENT_NAMES } from '../../dashboards/constants';
import type { DashboardFilters, DashboardMode, ProviderFilter } from '../../dashboards/types';
import { useOpsDashboardData } from '../../dashboards/useOpsDashboardData';
import { ActiveExchangePanel } from '../../dashboards/ui/ActiveExchangePanel';
import { FilterBar } from '../../dashboards/ui/FilterBar';
import { KpiGrid } from '../../dashboards/ui/KpiGrid';
import {
  LudoDetailsModal,
  type LudoModalAction,
} from '../../dashboards/ui/LudoDetailsModal';
import { ProviderCard } from '../../dashboards/ui/ProviderCard';
import { todayIST } from '../../utils/dates';
import { useNavigation } from '@react-navigation/native';
import { canOpenPanelPath, openPanelTarget } from '../../navigation/panelDetail';

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

export function OpsDashboardScreen({ mode }: { mode: DashboardMode }) {
  const meta = TITLES[mode];
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();

  const t = todayIST();
  const [startDate, setStartDate] = useState(t);
  const [endDate, setEndDate] = useState(t);
  const [appClientName, setAppClientName] = useState('');
  const [filterBy, setFilterBy] = useState<ProviderFilter>('Ashwini');
  const [applied, setApplied] = useState<DashboardFilters>({
    startDate: t,
    endDate: t,
    appClientName: '',
    filterBy: 'Ashwini',
  });

  const apply = useCallback(
    () => setApplied({ startDate, endDate, appClientName, filterBy }),
    [startDate, endDate, appClientName, filterBy],
  );

  const { bundle, loading, error, reload, reloadLudo, reloadActiveExchange } =
    useOpsDashboardData(mode, applied);

  const [selectedLudoGame, setSelectedLudoGame] = useState('All');
  const [selectedIndianDiva, setSelectedIndianDiva] = useState('All');
  const [selectedPlutus, setSelectedPlutus] = useState('All');
  const [ludoModalOpen, setLudoModalOpen] = useState(false);
  const [ludoModalAction, setLudoModalAction] = useState<LudoModalAction>(null);

  const ludoGameIds = useMemo(
    () => (bundle?.ludoGameOptions || []).map((o) => o.value),
    [bundle?.ludoGameOptions],
  );

  const appOptions =
    mode === 'vip' ? VIP_CLIENT_NAMES : (CLIENT_NAMES as readonly string[]);

  const kpiItems = useMemo(
    () => buildKpiItems(mode, bundle, applied.startDate, applied.endDate, todayIST()),
    [mode, bundle, applied.startDate, applied.endDate],
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
          onLudoGgrDetails: () => {
            const gameOptions = bundle?.ludoGameOptions ?? [];
            // Backend requires a concrete gameId — fall back to first game when All.
            const gameId =
              selectedLudoGame && selectedLudoGame !== 'All'
                ? selectedLudoGame
                : gameOptions[0]?.value || '';
            const ggrValue =
              bundle?.ludoGameStatsMap?.[gameId || selectedLudoGame]?.ggr ??
              bundle?.ludoGameStatsMap?.All?.ggr ??
              0;
            openPanelTarget(navigation, {
              href: '/ludo-user-ggr-by-round',
              state: {
                date: applied.startDate,
                gameId,
                ggr: ggrValue < 0 ? 'minus' : 'plus',
                gameOptions,
              },
            });
          },
          onLudoGameGgrDetails: (gameId, ggrValue) => {
            openPanelTarget(navigation, {
              href: '/ludo-user-ggr-by-round',
              state: {
                date: applied.startDate,
                gameId: gameId === 'All' ? '' : gameId,
                ggr: ggrValue < 0 ? 'minus' : 'plus',
                gameOptions: bundle?.ludoGameOptions ?? [],
              },
            });
          },
        },
        {
          startDate: applied.startDate,
          endDate: applied.endDate,
          appClientName: applied.appClientName,
        },
      ),
    [
      mode,
      bundle,
      loading,
      navigation,
      selectedLudoGame,
      selectedIndianDiva,
      selectedPlutus,
      reloadLudo,
      applied.startDate,
      applied.endDate,
      applied.appClientName,
    ],
  );

  const visibleCards = useMemo(
    () =>
      providerCards.filter((card) => {
        if (applied.filterBy !== 'Ashwini' && !card.filters.includes(applied.filterBy)) {
          return false;
        }
        if (mode === 'vip' && card.showOnVip === false) return false;
        return true;
      }),
    [providerCards, applied.filterBy, mode],
  );

  const activeExchangeName = String(bundle?.activeExchange?.activeExchange ?? '');

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void reload()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.description}>{meta.description}</Text>

      <FilterBar
        startDate={startDate}
        endDate={endDate}
        appClientName={appClientName}
        filterBy={filterBy}
        appOptions={appOptions}
        showProviderFilter
        loading={loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onAppChange={setAppClientName}
        onFilterByChange={setFilterBy}
        onApply={apply}
        onRefresh={() => void reload()}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {mode === 'main' ? (
        <ActiveExchangePanel
          activeExchangeName={activeExchangeName}
          onUpdated={() => void reloadActiveExchange()}
        />
      ) : null}

      <KpiGrid
        items={kpiItems}
        isItemTappable={(item) => canOpenPanelPath(item.href)}
        onItemPress={(item) =>
          openPanelTarget(navigation, { href: item.href, state: item.state })
        }
      />

      {visibleCards.map((card) => (
        <ProviderCard
          key={card.id}
          card={card}
          onPress={
            canOpenPanelPath(card.href)
              ? () =>
                  openPanelTarget(navigation, {
                    href: card.href,
                    state: card.state,
                    search: card.search,
                  })
              : undefined
          }
          onActiveCustomersPress={
            card.activeCustomerKey
              ? () =>
                  openPanelTarget(navigation, {
                    href: '/activeUserData',
                    state: {
                      startDate:
                        card.state?.startDate || applied.startDate,
                      endDate: card.state?.endDate || applied.endDate,
                      customerKey: card.activeCustomerKey,
                      appClientName:
                        card.state?.appClientName ||
                        applied.appClientName ||
                        '',
                    },
                  })
              : undefined
          }
        />
      ))}

      {!loading && bundle && visibleCards.length === 0 ? (
        <Text style={styles.empty}>No providers match the current filter.</Text>
      ) : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 10,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
});
