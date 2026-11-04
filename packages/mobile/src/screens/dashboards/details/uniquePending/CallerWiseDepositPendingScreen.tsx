/**
 * Caller Wise Deposit Pending — full screen (not modal).
 * Opened from Unique Deposit Pending with route params startDate/endDate.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  CALLER_WISE_HIGH_PENDING,
  buildCallerWiseUniquePending,
  buildUniquePendingSummaryPayload,
  extractUniquePendingList,
  filterCallerWisePendingItems,
  filterCallerWiseUniquePendingRows,
  sumCallerWiseUniquePendingTotals,
  type CallerWiseUniquePendingRow,
  type UniquePendingRow,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';
import { hasPermission, Permissions } from '../../../../auth/permissions';
import { ScreenFlatList } from '../../../../dashboards/ui/ScreenFlatList';
import { colors, spacing } from '../../../../theme';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../../utils/dates';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../../../utils/empCodeNameCache';
import { display } from '../../../../utils/display';
import { styles } from './CallerWiseDepositPendingScreen.styles';

function formatAmt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

type RouteParams = {
  startDate?: string;
  endDate?: string;
};

export function CallerWiseDepositPendingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as RouteParams;
  const startDate = String(params.startDate || '').trim() || todayIST();
  const endDate = String(params.endDate || '').trim() || todayIST();

  const canShowMobile = hasPermission(Permissions.show_mobile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CallerWiseUniquePendingRow[]>([]);
  const [pendingByEmpCode, setPendingByEmpCode] = useState<Record<string, UniquePendingRow[]>>({});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CallerWiseUniquePendingRow | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = buildUniquePendingSummaryPayload(startDate, endDate, {}, startDate);
      const [pendingRes, allRes, nameMap] = await Promise.all([
        secureApi<unknown>('uniquePending.amountSummary', payload),
        secureApi<unknown>('uniquePending.amountAllSummary', payload),
        getEmpCodeNameMap().catch(() => getCachedEmpCodeNameMap()),
      ]);
      if (!pendingRes.ok) {
        setError(pendingRes.message || 'Failed to load caller-wise pending');
        setRows([]);
        setPendingByEmpCode({});
        return;
      }
      if (!allRes.ok) {
        setError(allRes.message || 'Failed to load caller-wise summary');
        setRows([]);
        setPendingByEmpCode({});
        return;
      }
      const bundle = buildCallerWiseUniquePending(
        extractUniquePendingList(pendingRes.data),
        extractUniquePendingList(allRes.data),
        nameMap || {},
      );
      setRows(bundle.rows);
      setPendingByEmpCode(bundle.pendingByEmpCode);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => filterCallerWiseUniquePendingRows(rows, search),
    [rows, search],
  );
  const totals = useMemo(() => sumCallerWiseUniquePendingTotals(rows), [rows]);

  const selectedPending = selected ? pendingByEmpCode[selected.empCode] || [] : [];
  const filteredPending = useMemo(
    () =>
      filterCallerWisePendingItems(selectedPending, pendingSearch, {
        canShowMobile,
      }),
    [selectedPending, pendingSearch, canShowMobile],
  );
  const pendingAmountTotal = useMemo(
    () => filteredPending.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [filteredPending],
  );

  if (selected) {
    return (
      <View style={styles.screen}>
        <ScreenFlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={filteredPending}
          keyExtractor={(item, index) => String(item._id || item.orderId || index)}
          renderItem={({ item, index }: ListRenderItemInfo<UniquePendingRow>) => (
            <PendingCard item={item} index={index} canShowMobile={canShowMobile} />
          )}
          listHeader={
            <>
              <TouchableOpacity
                onPress={() => {
                  setSelected(null);
                  setPendingSearch('');
                }}
              >
                <Text style={styles.backLink}>‹ Back to Callers</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Pending Deposit List</Text>
              <Text style={styles.sub}>
                {selected.empCode}
                {selected.callerName ? ` · ${selected.callerName}` : ''} · {startDate} → {endDate}
              </Text>

              <TotalCards
                callers={1}
                totals={{
                  successful: selected.successful,
                  successfulAmount: selected.successfulAmount,
                  pending: selected.pending,
                  pendingAmount: selected.pendingAmount,
                  approved: selected.approved,
                  approvedAmount: selected.approvedAmount,
                }}
              />

              <Text style={styles.metaLine}>
                Records: {filteredPending.length.toLocaleString('en-IN')} · Amount: ₹
                {formatAmt(pendingAmountTotal)}
              </Text>
              <TextInput
                style={styles.search}
                value={pendingSearch}
                onChangeText={setPendingSearch}
                placeholder={
                  canShowMobile
                    ? 'Search user, mobile, order, gateway…'
                    : 'Search user, order, gateway…'
                }
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          }
          emptyMessage="No pending records"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={filteredRows}
        keyExtractor={(item, index) => `${item.empCode}-${index}`}
        renderItem={({ item, index }: ListRenderItemInfo<CallerWiseUniquePendingRow>) => (
          <CallerCard
            row={item}
            index={index}
            onOpenPending={() => {
              if (!item.pending) return;
              setSelected(item);
              setPendingSearch('');
            }}
          />
        )}
        listHeader={
          <>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backLink}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Caller Wise Deposit Pending</Text>
            <Text style={styles.sub}>
              {startDate} → {endDate}
            </Text>

            <TotalCards callers={rows.length} totals={totals} />

            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search emp code / caller"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing(4) }} />
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        loading={loading}
        emptyMessage="No caller deposit-pending data found"
        refreshing={loading}
        onRefresh={() => void load()}
      />
    </View>
  );
}

function TotalCards({
  callers,
  totals,
}: {
  callers: number;
  totals: ReturnType<typeof sumCallerWiseUniquePendingTotals>;
}) {
  return (
    <View style={styles.totalWrap}>
      <View style={[styles.totalCard, { borderLeftColor: '#60a5fa' }]}>
        <Text style={[styles.totalLabel, { color: '#60a5fa' }]}>Callers</Text>
        <Text style={styles.totalValue}>{callers.toLocaleString('en-IN')}</Text>
      </View>
      <View style={[styles.totalCard, { borderLeftColor: '#a78bfa' }]}>
        <Text style={[styles.totalLabel, { color: '#a78bfa' }]}>Successful</Text>
        <Text style={styles.totalValue}>
          {totals.successful.toLocaleString('en-IN')} · ₹{formatAmt(totals.successfulAmount)}
        </Text>
      </View>
      <View style={[styles.totalCard, { borderLeftColor: colors.primary }]}>
        <Text style={[styles.totalLabel, { color: colors.primary }]}>Pending</Text>
        <Text style={styles.totalValue}>
          {totals.pending.toLocaleString('en-IN')} · ₹{formatAmt(totals.pendingAmount)}
        </Text>
      </View>
      <View style={[styles.totalCard, { borderLeftColor: colors.success }]}>
        <Text style={[styles.totalLabel, { color: colors.success }]}>Approved</Text>
        <Text style={styles.totalValue}>
          {totals.approved.toLocaleString('en-IN')} · ₹{formatAmt(totals.approvedAmount)}
        </Text>
      </View>
    </View>
  );
}

type CallerCardProps = {
  row: CallerWiseUniquePendingRow;
  index: number;
  onOpenPending: () => void;
};

const CallerCard = memo(function CallerCard({ row, index, onOpenPending }: CallerCardProps) {
  const high = row.pending >= CALLER_WISE_HIGH_PENDING;
  return (
    <View style={[styles.card, styles.cardSpaced, high && styles.cardHigh]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.empCode}
        </Text>
        <Text style={styles.cardCaller} numberOfLines={1}>
          {row.callerName || '—'}
        </Text>
      </View>
      <Text style={styles.stat}>
        Succ {row.successful} · ₹{formatAmt(row.successfulAmount)}
      </Text>
      <TouchableOpacity
        style={[styles.pendingBtn, !row.pending && styles.pendingBtnDisabled]}
        disabled={!row.pending}
        onPress={onOpenPending}
      >
        <Text style={styles.pendingBtnText}>
          Pending {row.pending} · ₹{formatAmt(row.pendingAmount)}
        </Text>
      </TouchableOpacity>
      <Text style={styles.statStrong}>
        Appr {row.approved} · ₹{formatAmt(row.approvedAmount)}
      </Text>
    </View>
  );
});

type PendingCardProps = {
  item: UniquePendingRow;
  index: number;
  canShowMobile: boolean;
};

const PendingCard = memo(function PendingCard({ item, index, canShowMobile }: PendingCardProps) {
  const state = String(item.userState || item.state || '').trim();
  const city = String(item.userCity || item.city || '').trim();
  const gateway = String(item.paymentGatewayName || '').trim();
  const mid = item.mid != null && item.mid !== '' ? String(item.mid) : '';
  return (
    <View style={[styles.card, styles.cardSpaced]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(item.userName)}
        </Text>
        <Text style={styles.amount}>₹{formatAmt(item.amount)}</Text>
      </View>
      {canShowMobile ? (
        <Text style={styles.line}>Mobile: {display(item.userMobile || item.mobile)}</Text>
      ) : null}
      <Text style={styles.line}>
        {state || '—'}
        {city ? ` / ${city}` : ''}
      </Text>
      <Text style={styles.line}>Order: {display(item.orderId)}</Text>
      <Text style={styles.line}>App: {display(item.clientName)}</Text>
      <Text style={styles.line}>
        Gateway: {gateway || mid ? (mid ? `${gateway || '—'} · ${mid}` : gateway) : '—'}
      </Text>
      <Text style={styles.line}>
        Status: {display(item.status) === '—' ? 'Pending' : display(item.status)}
      </Text>
      <Text style={styles.line}>
        Created:{' '}
        {item.createdOn
          ? `${formatDisplayDate(item.createdOn)} · ${formatDisplayTime(item.createdOn)}`
          : '—'}
      </Text>
    </View>
  );
});
