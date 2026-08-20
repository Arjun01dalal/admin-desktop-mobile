/**
 * Provider-wise active players — port of laxminarayan ActiveUserData /
 * desktop ActiveUserDataPage.
 * Phone UI: compact cards (not a horizontal table).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { providerWiseActive, toNum } from '../../../dashboards/mergeMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  state?: string;
  city?: string;
  balance?: number;
  kyc?: boolean;
  [key: string]: unknown;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function ActiveUserDataScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const customerKey = String(params.customerKey || '').trim();
  const appClientName = String(params.appClientName || '');
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    if (!customerKey) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: 50,
        pageNo: page,
        activeUserStart: startDate,
        activeUserEnd: endDate,
        filter,
      };
      if (appClientName) {
        filter.clientName = appClientName;
        payload.app = [appClientName];
      }

      const res = await secureApi('dashboard.activeCustomersCategory', payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load active users');
        setRows([]);
        setTotalPages(1);
        return;
      }

      const providerWise = providerWiseActive(res.data);
      const keyLower = customerKey.toLowerCase();
      const entry =
        (providerWise[customerKey] as Record<string, unknown> | undefined) ||
        (Object.entries(providerWise).find(
          ([k]) => k.toLowerCase() === keyLower,
        )?.[1] as Record<string, unknown> | undefined) ||
        {};

      setRows(Array.isArray(entry.list) ? (entry.list as UserRow[]) : []);
      setTotalPages(Math.max(1, toNum(entry.totalPages) || 1));
    } finally {
      setLoading(false);
    }
  }, [appClientName, customerKey, endDate, page, startDate]);

  useEffect(() => {
    setPage(1);
  }, [customerKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return [
      { label: 'Name', value: display(selected.name) },
      { label: 'Mobile', value: display(selected.mobile) },
      { label: 'State', value: display(selected.state) },
      { label: 'City', value: display(selected.city) },
      { label: 'Balance', value: toNum(selected.balance).toFixed(2) },
      { label: 'KYC', value: selected.kyc ? 'Yes' : 'No' },
    ];
  }, [selected]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
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
      <Text style={styles.title}>{toDisplayText('Active User Data')}</Text>
      <Text style={styles.description}>
        {toDisplayText(customerKey || 'provider')} · {startDate} → {endDate}
      </Text>

      {!customerKey ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Open this screen from a provider card player count.
          </Text>
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
          setPage(1);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && rows.length === 0 && customerKey ? (
        <Text style={styles.emptyTextCenter}>No Data Found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSelected(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * 50 + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              <Text style={[styles.kycPill, row.kyc ? styles.kycYes : styles.kycNo]}>
                {row.kyc ? 'KYC' : 'No KYC'}
              </Text>
            </View>
            <View style={styles.cardGrid}>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.mobile)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Balance</Text>
                <Text style={[styles.cardValue, styles.cardAmount]} numberOfLines={1}>
                  ₹{toNum(row.balance).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>State</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.state)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>City</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.city)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardHint}>Tap for all details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={String(selected?.name || 'User Details')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />

      {totalPages > 1 ? (
        <View style={styles.pager}>
          <TouchableOpacity
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>
            Page {page} / {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page >= totalPages || loading}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  description: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 10,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingBox: { paddingVertical: spacing(8), alignItems: 'center' },
  emptyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  emptyTextCenter: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing(4),
  },
  list: { marginTop: spacing(2), gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  cardIndex: { color: colors.muted, fontSize: 11, fontWeight: '700', minWidth: 28 },
  cardTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700', flex: 1 },
  kycPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  kycYes: { color: colors.success, backgroundColor: 'rgba(34,197,94,0.12)' },
  kycNo: { color: colors.muted, backgroundColor: colors.surfaceAlt },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  cardCell: { width: '47%', flexGrow: 1, minWidth: '45%' },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', marginBottom: 2 },
  cardValue: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  cardAmount: { color: colors.primary, fontWeight: '700' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(2) },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    marginTop: spacing(4),
  },
  pageBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#1a1200', fontWeight: '700', fontSize: 13 },
  pageLabel: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
});
