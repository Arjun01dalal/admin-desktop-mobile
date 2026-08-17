/**
 * Caller Details — port of desktop CallerDetailsPage.
 * Opened when a caller row is tapped on Caller Responsibility.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type DetailRow = Record<string, unknown> & {
  _id?: string;
  userId?: string;
  name?: string;
  mobile?: string;
  userMobile?: string;
  status?: string;
  state?: string;
  app?: string;
  createdAt?: string;
};

type TabKey = 'Today' | 'Active' | 'Warning' | 'Inactive';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDaysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function unwrapToday(data: unknown): {
  users: DetailRow[];
  count: number;
  totalPages: number;
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const usersRaw = root.user ?? root.users ?? nested.user ?? nested.users;
  const users = Array.isArray(usersRaw) ? (usersRaw as DetailRow[]) : [];
  const count = Number(root.count ?? nested.count ?? users.length) || 0;
  const totalPages =
    Number(root.totalPages ?? nested.totalPages) ||
    Math.max(1, Math.ceil(count / Math.max(users.length, 1)) || 1);
  return { users, count, totalPages };
}

function unwrapWarn(data: unknown): { items: DetailRow[]; total: number } {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const itemsRaw = root.items ?? nested.items;
  const items = Array.isArray(itemsRaw) ? (itemsRaw as DetailRow[]) : [];
  const total = Number(root.total ?? nested.total ?? items.length) || 0;
  return { items, total };
}

function unwrapActiveInactive(data: unknown): {
  active: DetailRow[];
  inactive: DetailRow[];
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const activeRaw = root.active ?? nested.active;
  const inactiveRaw = root.inactive ?? nested.inactive;
  return {
    active: Array.isArray(activeRaw) ? (activeRaw as DetailRow[]) : [],
    inactive: Array.isArray(inactiveRaw) ? (inactiveRaw as DetailRow[]) : [],
  };
}

async function fetchAllTodayUsers(args: {
  empCode: string;
  startDate: string;
  endDate: string;
}): Promise<{ users: DetailRow[]; count: number }> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  let count = 0;
  const users: DetailRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi('caller.callerActiveToday', {
      empCode: args.empCode,
      filter: {},
      startDate: args.startDate,
      endDate: args.endDate,
      pageNo: page,
      itemsPerPage: pageSize,
    });
    const parsed = unwrapToday(res.data);
    if (page === 1) {
      count = parsed.count;
      totalPages = Math.max(
        1,
        Number(parsed.totalPages) || Math.ceil(parsed.count / pageSize) || 1,
      );
    }
    for (const row of parsed.users) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      users.push(row);
    }
    if (!parsed.users.length || parsed.users.length < pageSize) break;
    page += 1;
  } while (page <= totalPages && page <= 200);

  return { users, count: count || users.length };
}

async function fetchAllWarningUsers(args: {
  empCode: string;
  userId?: string;
}): Promise<{ items: DetailRow[]; total: number }> {
  const pageSize = 1000;
  let page = 1;
  let total = 0;
  const items: DetailRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi('caller.nonPerforming', {
      empCode: args.empCode,
      _id: args.userId,
      pageNo: page,
      itemPerPage: pageSize,
      filter: {},
    });
    const parsed = unwrapWarn(res.data);
    if (page === 1) total = parsed.total;
    for (const row of parsed.items) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      items.push(row);
    }
    if (!parsed.items.length || parsed.items.length < pageSize) break;
    if (total > 0 && items.length >= total) break;
    page += 1;
  } while (page <= 200);

  return { items, total: total || items.length };
}

export function CallerDetailsScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const empCode = String(params.empCode || '');
  const deposit = params.deposit;
  const ecs =
    params.activePlayersECS && typeof params.activePlayersECS === 'object'
      ? (params.activePlayersECS as Record<string, unknown>)
      : {};

  const user = getSessionUser() as { _id?: string } | null;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [tab, setTab] = useState<TabKey>('Today');
  const [searchName, setSearchName] = useState('');
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [counts, setCounts] = useState({
    Today: 0,
    Active: 0,
    Warning: 0,
    Inactive: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailRow | null>(null);

  const load = useCallback(async () => {
    if (!empCode) return;
    setLoading(true);
    setError(null);
    try {
      const [todayBundle, warning, aiRes] = await Promise.all([
        fetchAllTodayUsers({ empCode, startDate, endDate }),
        fetchAllWarningUsers({
          empCode,
          userId: user?._id ? String(user._id) : undefined,
        }),
        secureApi('caller.callerActiveInactive', {
          empCode,
          startDate: formatDaysAgoLocal(1),
          endDate: formatDaysAgoLocal(4),
          filter: {},
        }),
      ]);

      const { active, inactive } = unwrapActiveInactive(aiRes.data);
      const combined: DetailRow[] = [
        ...todayBundle.users.map((u) => ({ ...u, status: 'Today' })),
        ...active.map((u) => ({ ...u, status: 'Active' })),
        ...warning.items.map((u) => ({ ...u, status: 'Warning' })),
        ...inactive.map((u) => ({ ...u, status: 'Inactive' })),
      ];
      setRows(combined);
      setCounts({
        Today: todayBundle.count || todayBundle.users.length,
        Active: active.length,
        Warning: warning.total || warning.items.length,
        Inactive: inactive.length,
      });

      if (
        !aiRes.ok &&
        todayBundle.users.length === 0 &&
        warning.items.length === 0
      ) {
        setError('Failed to load caller details');
      }
    } finally {
      setLoading(false);
    }
  }, [empCode, startDate, endDate, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.status !== tab) return false;
      if (!q) return true;
      return String(row.name || '').toLowerCase().includes(q);
    });
  }, [rows, tab, searchName]);

  const columns = useMemo<DataTableColumn<DetailRow>[]>(
    () => [
      {
        key: 'name',
        label: 'Name',
        width: 140,
        render: (r) => display(r.name),
      },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => maskMobile(r.mobile || r.userMobile, canShowMobile),
      },
      {
        key: 'app',
        label: 'App',
        width: 100,
        render: (r) => display(r.app),
      },
      {
        key: 'state',
        label: 'State',
        width: 110,
        render: (r) => display(r.state),
      },
      {
        key: 'created',
        label: 'Created',
        width: 120,
        render: (r) => display(r.createdAt),
      },
    ],
    [canShowMobile],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return columns.map((column) => ({
      label: column.label,
      value: column.render(selected, 0),
    }));
  }, [columns, selected]);

  if (!empCode) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Caller Details</Text>
        <Text style={styles.sub}>No caller selected.</Text>
      </View>
    );
  }

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
      <Text style={styles.title}>Caller Details — {empCode}</Text>
      <Text style={styles.sub}>
        Deposit:{' '}
        {deposit != null && Number.isFinite(Number(deposit))
          ? Math.round(Number(deposit)).toLocaleString('en-IN')
          : '—'}
        {' · '}
        E:{display(ecs.E)} C:{display(ecs.C)} S:{display(ecs.S)}
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

      <TextInput
        style={styles.search}
        value={searchName}
        onChangeText={setSearchName}
        placeholder="Search by name"
        placeholderTextColor={colors.muted}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(['Today', 'Active', 'Warning', 'Inactive'] as const).map((key) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {key} ({counts[key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading…</Text>
        </View>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          keyFor={(row, index) => String(row._id || row.userId || index)}
          emptyMessage={`No ${tab.toLowerCase()} users`}
          onRowPress={setSelected}
          hint="Tap a user to see details"
        />
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={String(selected?.name || 'User Details')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    marginBottom: spacing(3),
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.primaryForeground },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loaderText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
