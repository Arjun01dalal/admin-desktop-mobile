/**
 * Provider-wise active players — port of laxminarayan ActiveUserData /
 * desktop ActiveUserDataPage.
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
import {
  providerWiseActive,
  toNum,
} from '../../../dashboards/mergeMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';

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

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      {
        key: 'name',
        label: 'Name',
        width: 140,
        render: (r) => String(r.name || '—'),
      },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => String(r.mobile || '—'),
      },
      {
        key: 'state',
        label: 'State',
        width: 110,
        render: (r) => String(r.state || '—'),
      },
      {
        key: 'city',
        label: 'City',
        width: 110,
        render: (r) => String(r.city || '—'),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 100,
        align: 'right',
        render: (r) => toNum(r.balance).toFixed(2),
      },
      {
        key: 'kyc',
        label: 'KYC',
        width: 70,
        render: (r) => (r.kyc ? 'Yes' : 'No'),
      },
    ],
    [],
  );

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
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyFor={(r, i) => String(r._id || i)}
          emptyMessage="No Data Found"
        />
      )}

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
            style={[
              styles.pageBtn,
              page >= totalPages && styles.pageBtnDisabled,
            ]}
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
