/**
 * Risk Analysis — port of desktop RiskAnalysisPage.
 * Jetfair / Falcon / AAA / Master AAA books for the selected date range.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CLIENT_NAMES } from '@astro/shared';
import { colors, spacing } from '../../theme';
import { floorNum, toNum } from '../../dashboards/mergeMetrics';
import type { KpiItem, ProviderCardModel, ProviderFilter } from '../../dashboards/types';
import {
  metricJyotishLabel,
  RISK_CARD_TITLES,
  RISK_NAV_MAP,
} from '../../dashboards/jyotish/jyotishMapping';
import { useRiskDashboardData, type RiskFilters } from '../../dashboards/useRiskDashboardData';
import { FilterBar } from '../../dashboards/ui/FilterBar';
import { KpiGrid } from '../../dashboards/ui/KpiGrid';
import { ProviderCard } from '../../dashboards/ui/ProviderCard';
import { canOpenPanelPath, openPanelTarget } from '../../navigation/panelDetail';
import { todayIST } from '../../utils/dates';

function row(label: string, value: unknown) {
  return { label: metricJyotishLabel(label), value: floorNum(value) };
}

export function RiskAnalysisScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();
  const t = todayIST();
  const [startDate, setStartDate] = useState(t);
  const [endDate, setEndDate] = useState(t);
  const [appClientName, setAppClientName] = useState('');
  const [filterBy, setFilterBy] = useState<ProviderFilter>('Ashwini');
  const [applied, setApplied] = useState<RiskFilters>({
    startDate: t,
    endDate: t,
    appClientName: '',
  });

  const apply = useCallback(
    () => setApplied({ startDate, endDate, appClientName }),
    [startDate, endDate, appClientName],
  );
  const clearAll = useCallback(() => {
    const d = todayIST();
    setStartDate(d);
    setEndDate(d);
    setAppClientName('');
    setApplied({ startDate: d, endDate: d, appClientName: '' });
  }, []);

  const { bundle, loading, error, reload } = useRiskDashboardData(applied);

  const dateState = useMemo(
    () => ({ startDate: applied.startDate, endDate: applied.endDate }),
    [applied.startDate, applied.endDate],
  );
  const dateQuery = useMemo(
    () =>
      new URLSearchParams({
        startDate: applied.startDate,
        endDate: applied.endDate,
      }).toString(),
    [applied.startDate, applied.endDate],
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
        rows: [
          row('Total Bet Amount', falcon.payin),
          row('Total Win Amount', falcon.payout),
          row('GGR', falcon.TotalGGR ?? falcon.totalGGR),
          row('Commission', falcon.CommissionAmount),
          row('GGR - Upline + Commission', falcon.final_ggr ?? falcon.finalGgr),
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
          row('GGR (Without commission)', aaa.totalWinLossWithoutCommission),
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
          row('GGR (Without commission)', masterAaa.totalWinLossWithoutCommission),
          row('Commission', masterAaa.totalCommission),
          row('Gross GGR', masterAaa.finalWinLoss),
        ],
      },
    ];
  }, [bundle, loading, dateQuery, dateState]);

  return (
    <ScrollView
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
      <Text style={styles.title}>Risk Analysis</Text>
      <Text style={styles.description}>
        Gochar books and Exaltation risk metrics.
      </Text>

      <FilterBar
        startDate={startDate}
        endDate={endDate}
        appClientName={appClientName}
        filterBy={filterBy}
        appOptions={CLIENT_NAMES as readonly string[]}
        showProviderFilter={false}
        loading={loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onAppChange={setAppClientName}
        onFilterByChange={setFilterBy}
        onApply={apply}
        onAllData={clearAll}
        onRefresh={() => void reload()}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <KpiGrid
        items={navCards}
        isItemTappable={(item) => canOpenPanelPath(item.href)}
        onItemPress={(item) =>
          openPanelTarget(navigation, { href: item.href, state: item.state })
        }
      />

      {platformCards.map((card) => (
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
        />
      ))}
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
});
