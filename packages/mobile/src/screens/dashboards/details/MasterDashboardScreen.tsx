/**
 * Master Dashboard — port of desktop MasterDashboardPage.
 * Parallel master/VIP exchange books; summary cards per provider.
 * Route params may include { startDate, endDate }.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { secureApi } from '../../../api/client';
import { floorNum, toNum } from '../../../dashboards/mergeMetrics';
import type { ProviderCardModel } from '../../../dashboards/types';
import { ProviderCard } from '../../../dashboards/ui/ProviderCard';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';

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

export function MasterDashboardScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [bundle, setBundle] = useState<MasterBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base: Record<string, unknown> = { startDate, endDate };
      const datesOnly = { startDate, endDate };

      const [wco, falcon, satta, masterAaa] = await Promise.all([
        secureApi('dashboard.masterWco', base),
        secureApi('dashboard.masterFalcon', base),
        secureApi('dashboard.masterSatta', base),
        secureApi('dashboard.masterAaaZehnPl', datesOnly),
      ]);

      if (!wco.ok && !falcon.ok && !satta.ok && !masterAaa.ok) {
        const failed = [wco, falcon, satta, masterAaa].find((r) => !r.ok);
        setError(failed?.message || 'Failed to load master dashboard');
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
      setError(err instanceof Error ? err.message : 'Failed to load');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

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
        title: 'WCO Platform Details',
        filters: ['Ashwini'],
        loading,
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
              ? Number(toNum(wco.netRTP).toFixed(2))
              : 0,
          },
        ],
      },
      {
        id: 'falcon',
        title: 'Falcon Platform Details',
        filters: ['Ashwini'],
        loading,
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
        title: 'AAA Exch Details',
        filters: ['Ashwini'],
        loading,
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
        title: 'Satta Matka Bets Today',
        filters: ['Ashwini'],
        loading,
        rows: [
          row('Total Bet Amount', satta.sattaMatkaTotalBetAmount),
          row('Total Bet Count', satta.sattaMatkaTotalBetCount),
          row('Total Bet Pending Amount', satta.sattaMatkaTotalBetPendingAmount),
          row('Total Win Amount', satta.sattaMatkaTotalBetWinAmount),
          row('GGR', satta.sattaMatkaGGR),
        ],
      },
    ];
  }, [bundle, loading]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Master Dashboard')}</Text>
      <Text style={styles.description}>Master / VIP exchange books (fairbets).</Text>
      <Text style={styles.dates}>
        {startDate} → {endDate}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {cards.map((card) => (
        <ProviderCard key={card.id} card={card} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 13, marginTop: spacing(1) },
  dates: { color: colors.muted, fontSize: 13, marginBottom: spacing(3) },
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
