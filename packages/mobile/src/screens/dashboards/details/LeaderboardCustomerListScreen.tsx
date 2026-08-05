/**
 * Leaderboard → caller customer list — mobile port of desktop
 * LeaderboardCustomerCountPage. Loads leaderboard.callerUsers with
 * { _id, itemsPerPage, pageNo, clientName }, paginated, with an app
 * (client name) filter and a local name search over the loaded page.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { appCodeForName, CLIENT_NAMES } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { colors, radius, spacing } from '../../../theme';
import { hasPermission } from '../../../auth/permissions';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type CustomerRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  email?: string;
  city?: string;
  state?: string;
  clientName?: string;
  kyc?: boolean;
};

/** Mirrors desktop PER_PAGE_OPTIONS, trimmed for mobile. */
const PER_PAGE_OPTIONS = [50, 100, 250, 500] as const;

/** Columns kept in the list; everything shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'name', 'clientName', 'kyc']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function unpackPlayers(raw: unknown): { items: CustomerRow[]; totalPages: number } {
  if (!raw || typeof raw !== 'object') return { items: [], totalPages: 1 };
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  const players = nested.players ?? nested.items ?? obj.players;
  const items = Array.isArray(players) ? (players as CustomerRow[]) : [];
  return {
    items,
    totalPages: Math.max(1, Number(nested.totalPages ?? obj.totalPages) || 1),
  };
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function LeaderboardCustomerListScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const callerId = typeof params.id === 'string' ? params.id : '';
  const callerName = typeof params.name === 'string' ? params.name : '';

  const hideContact = hasPermission('contact_visibility_none');
  const canShowMobile = hasPermission('show_mobile');

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(100);
  const [clientName, setClientName] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    if (!callerId) return;
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const res = await secureApi('leaderboard.callerUsers', {
        _id: callerId,
        itemsPerPage,
        pageNo: page,
        clientName,
      });
      if (gen !== genRef.current) return; // stale response
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load customers');
        setRows([]);
        return;
      }
      const packed = unpackPlayers(res.data);
      setSelected(null);
      setRows(packed.items);
      setTotalPages(packed.totalPages);
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [callerId, itemsPerPage, page, clientName]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Local name search over the loaded page (desktop offers only server-side client-name filtering). */
  const visibleRows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.name || '').toLowerCase().includes(q));
  }, [rows, nameQuery]);

  const columns = useMemo<DataTableColumn<CustomerRow>[]>(() => {
    const cols: DataTableColumn<CustomerRow>[] = [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (r) => {
          const i = rows.indexOf(r);
          return String((page - 1) * itemsPerPage + (i < 0 ? 0 : i) + 1);
        },
      },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
      { key: 'email', label: 'Email', width: 170, render: (r) => display(r.email) },
    ];
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      });
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'clientName',
        label: 'Client Name',
        width: 90,
        render: (r) => appCodeForName(r.clientName),
      },
      {
        key: 'kyc',
        label: 'Kyc',
        width: 110,
        render: (r) => (r.kyc ? 'Completed' : 'Not Completed'),
        color: (r) => (r.kyc ? colors.success : colors.destructive),
      },
    );
    return cols;
  }, [rows, page, itemsPerPage, hideContact, canShowMobile]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{callerName ? `${callerName} — Customers` : 'Caller Customers'}</Text>
      <Text style={styles.sub}>Tap a row to see all details</Text>

      {!callerId ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>No caller selected. Open this page from the Leaderboard.</Text>
        </View>
      ) : (
        <>
          <View style={styles.filterCard}>
            <TextInput
              style={styles.searchInput}
              value={nameQuery}
              onChangeText={setNameQuery}
              placeholder="Search by name…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="All Apps" active={!clientName} onPress={() => { setClientName(''); setPage(1); }} />
              {CLIENT_NAMES.map((name) => (
                <Chip
                  key={name}
                  label={appCodeForName(name)}
                  active={clientName === name}
                  onPress={() => {
                    setClientName(name);
                    setPage(1);
                  }}
                />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Text style={styles.rowLabel}>Per page</Text>
              {PER_PAGE_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  active={itemsPerPage === n}
                  onPress={() => {
                    setItemsPerPage(n);
                    setPage(1);
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <DataTable
            columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
            rows={visibleRows}
            keyFor={(r, i) => String(r._id || i)}
            loading={loading}
            emptyMessage={loading ? 'Loading…' : 'No Data Found'}
            onRowPress={(row) => setSelected(row)}
            hint="Tap a row to see all details"
          />

          <RowDetailSheet
            visible={selected !== null}
            title={selected ? display(selected.name) : ''}
            fields={
              selected
                ? columns
                    .filter((c) => c.key !== 'idx')
                    .map<SheetField>((c) => ({
                      label: c.label,
                      value: c.render(selected, 0),
                      color: c.color?.(selected),
                    }))
                : []
            }
            onClose={() => setSelected(null)}
          />

          <View style={styles.pager}>
            <Text
              style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
              onPress={() => page > 1 && setPage((p) => p - 1)}
            >
              ‹ Prev
            </Text>
            <Text style={styles.pagerLabel}>
              Page {page} / {totalPages}
            </Text>
            <Text
              style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
              onPress={() => page < totalPages && setPage((p) => p + 1)}
            >
              Next ›
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginTop: spacing(3),
  },
  searchInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
