/**
 * Withdrawal Bifurcation — full page (details + 3D/stacked chart + CSV export).
 * Route: /withdrawal-bifurcation
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  BIFURCATION_STATUS_META,
  bifurcationResultToCsv,
  formatBifurcationAmount,
  formatPlayedLabel,
} from '@astro/shared/withdrawalBifurcation';

import { Bifurcation3DBarChart, type ChartMode } from '../features/withdrawal/Bifurcation3DBarChart';
import type { WithdrawalBifurcationParams } from '../features/withdrawal/bifurcationTypes';
import { useWithdrawalBifurcation } from '../features/withdrawal/useWithdrawalBifurcation';
import { styles } from '../features/withdrawal/WithdrawalBifurcationScreen.styles';
import { shareCsvFile } from '../utils/shareCsv';
import { colors } from '../theme';
import {
  getSessionUser,
  hasPermission,
  isFullAccessNavRole,
  Permissions,
} from '../auth/permissions';


type Tone = 'ok' | 'warn' | 'danger' | 'mute';

const STATUS_TONE: Record<string, Tone> = {
  approved: 'ok',
  pending: 'warn',
  inProgress: 'warn',
  rejected: 'danger',
  cancelled: 'mute',
  failed: 'danger',
  onHold: 'warn',
  reverse: 'mute',
};

function toneStyle(tone: Tone) {
  if (tone === 'ok') return styles.toneOk;
  if (tone === 'warn') return styles.toneWarn;
  if (tone === 'danger') return styles.toneDanger;
  return styles.toneMute;
}

function StatusAmount({
  status,
  tone,
}: {
  status?: { amount?: number; count?: number };
  tone: Tone;
}) {
  const amount = Number(status?.amount) || 0;
  const count = Number(status?.count) || 0;
  return (
    <>
      <Text style={[styles.statusAmount, toneStyle(tone), { opacity: amount || count ? 1 : 0.45 }]}>
        {formatBifurcationAmount(amount)}
      </Text>
      <Text style={styles.statusCount}>{count} txn</Text>
    </>
  );
}

function BifurcationSkeleton() {
  return (
    <View accessibilityLabel="Loading bifurcation skeleton">
      <View style={styles.summaryGrid}>
        <View style={[styles.skeletonCard, { flexBasis: '30%', flexGrow: 1 }]} />
        <View style={[styles.skeletonCard, { flexBasis: '30%', flexGrow: 1 }]} />
        <View style={[styles.skeletonCard, { flexBasis: '30%', flexGrow: 1 }]} />
      </View>
      <View style={styles.skeletonChart} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </View>
  );
}

type BifurcationRoute = RouteProp<
  { '/withdrawal-bifurcation': WithdrawalBifurcationParams },
  '/withdrawal-bifurcation'
>;

export function WithdrawalBifurcationScreen() {
  const route = useRoute<BifurcationRoute>();
  const canSee =
    hasPermission(Permissions.see_withdrawal_bifurcation, getSessionUser()) ||
    isFullAccessNavRole(getSessionUser());

  const model = useWithdrawalBifurcation(route.params ?? {});
  const [metric, setMetric] = useState<'amount' | 'count'>('amount');
  const [chartMode, setChartMode] = useState<ChartMode>('total');
  const [exporting, setExporting] = useState(false);

  const onExport = useCallback(async () => {
    if (!model.hasData) {
      Alert.alert('Nothing to export');
      return;
    }
    setExporting(true);
    try {
      const csv = bifurcationResultToCsv(model.rows, model.statusTotals);
      const name = `withdrawal-bifurcation_${model.startDate}_${model.endDate}.csv`;
      await shareCsvFile(name, csv);
    } finally {
      setExporting(false);
    }
  }, [model.endDate, model.hasData, model.rows, model.startDate, model.statusTotals]);

  if (!canSee) {
    return (
      <View style={styles.root} accessibilityLabel="Permission denied">
        <Text style={styles.errorText}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={model.refreshing && model.hasData}
            onRefresh={() => void model.refresh()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title} accessibilityRole="header">
            Withdrawal Bifurcation
          </Text>
          <Text
            style={styles.subtitle}
            accessibilityLabel={`Date range ${model.startDate || 'none'} to ${model.endDate || 'none'}`}
          >
            {model.startDate || '—'} → {model.endDate || '—'}
            {model.clientName && model.clientName !== 'All'
              ? ` · ${model.clientName}`
              : ' · ALL apps'}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={model.refreshing || model.isDateError}
              onPress={() => void model.refresh()}
              accessibilityRole="button"
              accessibilityLabel="Refresh bifurcation"
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                {model.refreshing ? 'Loading…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              disabled={!model.hasData || exporting}
              onPress={() => void onExport()}
              accessibilityRole="button"
              accessibilityLabel="Export bifurcation CSV"
            >
              <Text style={styles.actionBtnText}>{exporting ? 'Exporting…' : 'Export CSV'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {model.loading && !model.hasData ? <BifurcationSkeleton /> : null}

        {model.errorMessage && !model.loading ? (
          <View
            style={styles.errorWrap}
            accessibilityRole="alert"
            accessibilityLabel={model.errorMessage}
          >
            <Text style={styles.errorText}>
              {model.isDateError ? 'Invalid date range' : 'Could not load data'}
            </Text>
            <Text style={styles.emptyBody}>{model.errorMessage}</Text>
            {!model.isDateError ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => void model.refresh()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading bifurcation"
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {model.isEmpty ? (
          <View style={styles.emptyWrap} accessibilityLabel="No bifurcation data">
            <Text style={styles.emptyTitle}>No data for this range</Text>
            <Text style={styles.emptyBody}>
              Try another From/To date on Withdrawal, then open Bifurcation again.
            </Text>
          </View>
        ) : null}

        {model.hasData ? (
          <>
            <View style={styles.summaryGrid} accessibilityLabel="Bifurcation summary">
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Played groups</Text>
                <Text style={styles.summaryValue}>{model.rows.length}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total count</Text>
                <Text style={styles.summaryValue}>{model.summary.totalCount}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Grand total</Text>
                <Text style={styles.summaryValue}>
                  {formatBifurcationAmount(model.summary.totalAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chart</Text>
              <Text style={styles.sectionHint}>3D total or stacked by status · tap bar for details</Text>
              <View style={styles.metricToggle} accessibilityRole="tablist">
                {(['amount', 'count'] as const).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.metricChip, metric === key && styles.metricChipActive]}
                    onPress={() => setMetric(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: metric === key }}
                    accessibilityLabel={`Metric ${key}`}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        metric === key && styles.metricChipTextActive,
                      ]}
                    >
                      {key === 'amount' ? 'Amount' : 'Count'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {(['total', 'stacked'] as const).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.metricChip, chartMode === key && styles.metricChipActive]}
                    onPress={() => setChartMode(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: chartMode === key }}
                    accessibilityLabel={`Chart mode ${key}`}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        chartMode === key && styles.metricChipTextActive,
                      ]}
                    >
                      {key === 'total' ? '3D' : 'Stacked'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Bifurcation3DBarChart data={model.chartData} metric={metric} mode={chartMode} />
            </View>

            {model.statusTotals ? (
              <View style={styles.section} accessibilityLabel="Status totals">
                <Text style={styles.sectionTitle}>Status totals</Text>
                <Text style={styles.sectionHint}>Across all played groups</Text>
                <View style={styles.statusGrid}>
                  {BIFURCATION_STATUS_META.map(({ key, label }) => (
                    <View key={key} style={styles.statusCard}>
                      <Text style={styles.statusLabel}>{label}</Text>
                      <StatusAmount
                        status={model.statusTotals?.[key]}
                        tone={STATUS_TONE[key]}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section} accessibilityLabel="Played wise breakup">
              <Text style={styles.sectionTitle}>Played wise breakup</Text>
              <Text style={styles.sectionHint}>E = Exchange · C = Casino · S = Satta Matka</Text>
              {model.rows.map((row, index) => (
                <View
                  key={`${row.played}-${index}`}
                  style={styles.playedCard}
                  accessibilityLabel={`${formatPlayedLabel(row.played)}, ${formatBifurcationAmount(row.totalAmount)}, ${row.totalCount} transactions`}
                >
                  <View style={styles.playedHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playedTitle}>
                        {index + 1}. {formatPlayedLabel(row.played)}
                      </Text>
                      {row.played ? <Text style={styles.playedCode}>{row.played}</Text> : null}
                    </View>
                    <View>
                      <Text style={styles.playedTotal}>
                        {formatBifurcationAmount(row.totalAmount)}
                      </Text>
                      <Text style={styles.playedTxn}>{row.totalCount} txn</Text>
                    </View>
                  </View>
                  <View style={styles.playedStatusRow}>
                    {BIFURCATION_STATUS_META.map(({ key, label }) => {
                      const status = row[key];
                      const amount = Number(status?.amount) || 0;
                      const count = Number(status?.count) || 0;
                      return (
                        <View key={key} style={styles.playedStatusPill}>
                          <Text style={styles.playedStatusLabel}>{label}</Text>
                          <Text
                            style={[
                              styles.playedStatusValue,
                              toneStyle(STATUS_TONE[key]),
                              { opacity: amount || count ? 1 : 0.4 },
                            ]}
                          >
                            {formatBifurcationAmount(amount)}
                          </Text>
                          <Text style={styles.statusCount}>{count} txn</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
