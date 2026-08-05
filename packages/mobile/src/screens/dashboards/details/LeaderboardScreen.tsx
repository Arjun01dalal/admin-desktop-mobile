/**
 * Leaderboard — caller leaderboard.
 * Port of desktop LeaderboardPage with the mobile screen structure:
 * date filter, city totals cards, DataTable with main columns and a
 * bottom sheet showing every column, pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type LeaderboardRow = {
  _id?: string;
  name?: string;
  email?: string;
  block?: boolean;
  customerCount?: number;
  activeUserCount?: number;
  customerDepositAmt?: number;
  city?: string;
  plainPassword?: string;
};

const CITY_TOTALS = ['nagpur', 'dubai', 'bangluru', 'pune', 'mysuru'] as const;

function asRows(raw: unknown): LeaderboardRow[] {
  if (Array.isArray(raw)) return raw as LeaderboardRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { payload?: unknown; data?: unknown };
    if (Array.isArray(obj.payload)) return obj.payload as LeaderboardRow[];
    if (Array.isArray(obj.data)) return obj.data as LeaderboardRow[];
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as { payload?: unknown };
      if (Array.isArray(nested.payload)) return nested.payload as LeaderboardRow[];
    }
  }
  return [];
}

function fmtINR(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '0';
}

/** Columns shown in the list; the bottom sheet shows all of them. */
const MAIN_KEYS = new Set(['rank', 'name', 'city', 'deposit']);

export function LeaderboardScreen() {
  const isFocused = useIsFocused();

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: LeaderboardRow; rank: number } | null>(null);
  const [cityEdit, setCityEdit] = useState<LeaderboardRow | null>(null);
  const [cityDraft, setCityDraft] = useState('');
  const [citySaving, setCitySaving] = useState(false);
  const [cityError, setCityError] = useState('');
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const res = await secureApi('leaderboard.list', { startDate, endDate });
      if (gen !== genRef.current) return; // stale response
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load leaderboard');
        setRows([]);
        return;
      }
      setRows(asRows(res.data));
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const cityTotals = useMemo(() => {
    const totals = new Map<string, number>(CITY_TOTALS.map((c) => [c, 0]));
    for (const row of rows) {
      const city = String(row.city || '').trim().toLowerCase();
      if (totals.has(city)) {
        totals.set(city, (totals.get(city) || 0) + Number(row.customerDepositAmt || 0));
      }
    }
    return CITY_TOTALS.map((c) => ({ city: c, total: totals.get(c) || 0 }));
  }, [rows]);

  type IndexedRow = LeaderboardRow & { __rank: number };
  const indexedRows = useMemo<IndexedRow[]>(
    () => rows.map((r, i) => ({ ...r, __rank: i + 1 })),
    [rows],
  );

  const openCityEdit = useCallback((row: LeaderboardRow) => {
    setCityEdit(row);
    setCityDraft(String(row.city || ''));
    setCityError('');
  }, []);

  const saveCity = useCallback(async () => {
    if (!cityEdit?._id) return;
    setCitySaving(true);
    try {
      const res = await secureApi('ops.updateCity', {
        _id: cityEdit._id,
        city: cityDraft.trim(),
      });
      if (!res.ok || res.success === false) {
        setCityError(res.message || 'Failed to update city');
        return;
      }
      setCityEdit(null);
      setSelected(null);
      void load();
    } finally {
      setCitySaving(false);
    }
  }, [cityEdit, cityDraft, load]);

  const columns = useMemo<DataTableColumn<IndexedRow>[]>(
    () => [
      { key: 'rank', label: 'Rank', width: 50, render: (r) => String(r.__rank) },
      { key: 'name', label: 'Caller Name', width: 140, render: (r) => String(r.name || '—') },
      {
        key: 'city',
        label: 'City ✎',
        width: 110,
        render: (r) => `${r.city || '—'} ✎`,
        onCellPress: (r) => openCityEdit(r),
      },
      { key: 'email', label: 'Email', width: 180, render: (r) => String(r.email || '—') },
      { key: 'password', label: 'Password', width: 120, render: (r) => String(r.plainPassword || '—') },
      {
        key: 'customerCount',
        label: 'Customer Count',
        width: 110,
        align: 'right',
        render: (r) => String(r.customerCount ?? 0),
      },
      {
        key: 'activeUserCount',
        label: "Today's Active",
        width: 110,
        align: 'right',
        render: (r) => String(r.activeUserCount ?? 0),
      },
      {
        key: 'deposit',
        label: 'Deposit Amt',
        width: 110,
        align: 'right',
        render: (r) => fmtINR(r.customerDepositAmt),
      },
      {
        key: 'status',
        label: 'Caller Status',
        width: 150,
        render: (r) => (r.block ? 'Caller is Blocked' : 'Caller is Not Blocked'),
        color: (r) => (r.block ? colors.destructive : colors.success),
      },
    ],
    [],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row to see all details
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

      {/* City deposit totals */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
        <View style={styles.cityRow}>
          {cityTotals.map(({ city, total }) => (
            <View key={city} style={styles.cityCard}>
              <Text style={styles.cityLabel}>{city.charAt(0).toUpperCase() + city.slice(1)}</Text>
              <Text style={styles.cityValue}>{fmtINR(total)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={indexedRows}
        keyFor={(r, i) => String(r._id || i)}
        emptyMessage={loading ? 'Loading…' : 'No Data Found'}
        onRowPress={(row) => setSelected({ row, rank: row.__rank })}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.row.name || 'Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render({ ...selected.row, __rank: selected.rank }, 0),
                color: c.color?.({ ...selected.row, __rank: selected.rank }),
              }))
            : []
        }
        onClose={() => setSelected(null)}
      />

      {/* City edit modal (desktop: pencil icon next to City) */}
      <Modal
        visible={cityEdit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCityEdit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit City — {cityEdit ? String(cityEdit.name || '') : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={cityDraft}
              onChangeText={setCityDraft}
              placeholder="City"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoFocus
            />
            {cityError ? <Text style={styles.modalError}>{cityError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setCityEdit(null)}
                disabled={citySaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, citySaving && { opacity: 0.6 }]}
                onPress={() => void saveCity()}
                disabled={citySaving || !cityDraft.trim()}
              >
                {citySaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  cityScroll: { marginBottom: spacing(3) },
  cityRow: { flexDirection: 'row', gap: spacing(2) },
  cityCard: {
    minWidth: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  cityLabel: { color: colors.muted, fontSize: 12 },
  cityValue: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(6),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
    gap: spacing(3),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.foreground,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  modalError: { color: colors.destructive, fontSize: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(2) },
  modalCancel: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  modalSave: {
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
