/**
 * Master Flow — AAA hierarchy list (Master / Super Master / Super Admin).
 * Port of desktop MasterFlowPage with the mobile screen structure:
 * type chips, date filter, DataTable main columns and a bottom sheet
 * showing every column, pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import type { SecureAction } from '../../../api/registry.generated';
import { hasPermission } from '../../../auth/permissions';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type ListType = 'Master' | 'Super Master' | 'Super Admin';

type MasterFlowPnl = {
  totalVolume?: number;
  totalClientWin?: number;
  totalClient?: number;
  totalCommission?: number;
  totalWinLossWithoutCommission?: number;
  finalWinLoss?: number;
};

type MasterFlowRow = {
  _id?: string;
  name?: string;
  mobile?: string | number;
  ownShare?: string | number;
  initialWalletBalance?: number;
  pnl?: MasterFlowPnl;
};

const LIST_OPTIONS: { label: ListType; action: SecureAction }[] = [
  { label: 'Master', action: 'masterFlow.masters' },
  { label: 'Super Master', action: 'masterFlow.superMasters' },
  { label: 'Super Admin', action: 'masterFlow.superAdmins' },
];

function actionFor(type: ListType): SecureAction {
  return LIST_OPTIONS.find((o) => o.label === type)?.action ?? 'masterFlow.masters';
}

function asRows(raw: unknown): MasterFlowRow[] {
  if (Array.isArray(raw)) return raw as MasterFlowRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { payload?: unknown; data?: unknown };
    if (Array.isArray(obj.payload)) return obj.payload as MasterFlowRow[];
    if (Array.isArray(obj.data)) return obj.data as MasterFlowRow[];
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as { payload?: unknown };
      if (Array.isArray(nested.payload)) return nested.payload as MasterFlowRow[];
    }
  }
  return [];
}

function fmt2(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

/** Columns shown in the list; the bottom sheet shows all of them. */
const MAIN_KEYS = new Set(['name', 'balance', 'finalWinLoss']);

export function MasterFlowScreen() {
  const isFocused = useIsFocused();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [selectType, setSelectType] = useState<ListType>('Master');
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [rows, setRows] = useState<MasterFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MasterFlowRow | null>(null);
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const res = await secureApi(actionFor(selectType), { startDate, endDate });
      if (gen !== genRef.current) return; // stale response — a newer request superseded it
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load master flow');
        setRows([]);
        return;
      }
      setRows(asRows(res.data));
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [selectType, startDate, endDate]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const columns = useMemo<DataTableColumn<MasterFlowRow>[]>(
    () => [
      { key: 'id', label: 'Id', width: 110, render: (r) => String(r._id || '—') },
      { key: 'name', label: 'Name', width: 140, render: (r) => String(r.name || '—') },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      { key: 'ownShare', label: 'OwnShare', width: 80, render: (r) => String(r.ownShare ?? '—') },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (r) => fmt2(r.initialWalletBalance),
      },
      { key: 'volume', label: 'Total Volume', width: 100, align: 'right', render: (r) => fmt2(r.pnl?.totalVolume) },
      { key: 'clientWin', label: 'Total Client Win', width: 110, align: 'right', render: (r) => fmt2(r.pnl?.totalClientWin) },
      { key: 'client', label: 'Total Client', width: 100, align: 'right', render: (r) => fmt2(r.pnl?.totalClient) },
      { key: 'commission', label: 'Total Commission', width: 120, align: 'right', render: (r) => fmt2(r.pnl?.totalCommission) },
      {
        key: 'winLossNoComm',
        label: 'Total WinLoss Without Commission',
        width: 180,
        align: 'right',
        render: (r) => fmt2(r.pnl?.totalWinLossWithoutCommission),
      },
      {
        key: 'finalWinLoss',
        label: 'Final WinLoss',
        width: 110,
        align: 'right',
        render: (r) => fmt2(r.pnl?.finalWinLoss),
        color: (r) => (Number(r.pnl?.finalWinLoss ?? 0) < 0 ? colors.destructive : colors.success),
      },
    ],
    [canShowMobile],
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
      <Text style={styles.title}>Master Flow</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row to see all details
      </Text>

      {/* List type chips (Master / Super Master / Super Admin) */}
      <View style={styles.typeRow}>
        {LIST_OPTIONS.map((opt) => {
          const active = selectType === opt.label;
          return (
            <TouchableOpacity
              key={opt.label}
              onPress={() => setSelectType(opt.label)}
              style={[styles.typeChip, active && styles.typeChipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        emptyMessage={loading ? 'Loading…' : 'No Data Found'}
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.name || 'Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected, 0),
                color: c.color?.(selected),
              }))
            : []
        }
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  typeRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3) },
  typeChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  typeChipTextActive: { color: '#fff' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
