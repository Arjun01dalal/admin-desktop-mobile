/**
 * Caller Responsibility — port of desktop CallerResponsibilityPage with the
 * mobile screen structure: date/caller-head/location filters, Summary card,
 * By Office Location table and Caller Data table with a bottom detail sheet.
 * (Desktop's CSV validate + drill-down subpages are not ported yet.)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  FULL_ALLOTMENT_ROLE_IDS,
  OFFICE_LOCATIONS,
  RESP_TOTAL_DEPOSIT,
  type CallerRow,
} from '../../../auth/callerRoles';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type StoredCallerUser = {
  _id?: string;
  name?: string;
  Role_ID?: string;
  empCode?: string;
  Responsibilities?: string[];
};

function roleFlags(roleId?: string) {
  const id = String(roleId || '');
  const isCaller = CALLER_ROLE_IDS.has(id);
  const isCallerHead = CALLER_HEAD_ROLE_IDS.has(id);
  const isCallerOrHead = isCaller || isCallerHead;
  const isFullAllotment = FULL_ALLOTMENT_ROLE_IDS.has(id);
  return { isCaller, isCallerHead, isCallerOrHead, isFullAllotment };
}

function canSeeTotalDeposit(user: StoredCallerUser | null): boolean {
  const list = user?.Responsibilities;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(RESP_TOTAL_DEPOSIT);
}

function filterCallerRows(
  rows: CallerRow[],
  user: StoredCallerUser | null,
  isCaller: boolean,
  showCompany: boolean,
): CallerRow[] {
  return rows
    .filter((v) => (isCaller ? v.empCode === user?.empCode : !v.block))
    .filter((v) => (showCompany ? true : v.officeLocation !== 'Company'));
}

function roundAmt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-IN');
}

function cellText(value: unknown, empty = '-'): string {
  if (value === null || value === undefined || value === '') return empty;
  return String(value);
}

function pnl(deposit: unknown, withdrawApproved: unknown): string {
  const d = Number(deposit);
  const w = Number(withdrawApproved);
  if (!Number.isFinite(d) || !Number.isFinite(w)) return '-';
  return Math.round(d - w).toLocaleString('en-IN');
}

function displayName(value: unknown, empty = '-'): string {
  const s = String(value ?? '').trim();
  if (!s || s === 'not_assigned' || s === 'not assigned') return empty;
  return s;
}

function ecs(row: CallerRow): Record<string, unknown> {
  return (row.activePlayersECS || {}) as Record<string, unknown>;
}

/** Caller table columns shown in the list; the sheet shows all of them. */
const MAIN_KEYS = new Set(['sr', 'pseudo', 'deposit', 'pnl']);

export function CallerResponsibilityScreen() {
  const navigation = useNavigation();
  const user = getStoredUser<StoredCallerUser>();
  const { isCaller, isCallerHead, isCallerOrHead, isFullAllotment } = roleFlags(user?.Role_ID);
  const showTotalDeposit = canSeeTotalDeposit(user);
  const showCallerHead = !isCallerOrHead || isFullAllotment;
  const showLocation = !isCaller || isFullAllotment;

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [callerHead, setCallerHead] = useState('');
  const [office, setOffice] = useState('');
  const [heads, setHeads] = useState<CallerRow[]>([]);
  const [callerRows, setCallerRows] = useState<CallerRow[]>([]);
  const [locationRows, setLocationRows] = useState<CallerRow[]>([]);
  const [payload, setPayload] = useState<CallerRow>({});
  const [botCount, setBotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(null);
  const genRef = React.useRef(0);

  const openDepositList = useCallback(
    (row: CallerRow, type?: 'withdrawal' | 'uniquePending') => {
      const params: Record<string, unknown> = {
        list: row,
        empCode: row.empCode,
        startDate,
        endDate,
      };
      if (type) params.type = type;
      // Root-stack detail route (above the drawer) — push so Back always returns here.
      const parent = navigation.getParent() as
        | { push?: (name: string, params?: object) => void; navigate: (name: string, params?: object) => void }
        | undefined;
      const go = parent?.push ?? parent?.navigate ?? navigation.navigate.bind(navigation);
      go('/caller-responsibility/deposit-list', params);
      setSelected(null);
    },
    [navigation, startDate, endDate],
  );

  const loadHeads = useCallback(async () => {
    const res = await secureApi('caller.subadminsByRole', { filter: {} });
    if (!res.ok || res.success === false) return;
    const byRole = (res.data as { byRole?: Array<{ roleId?: string; subAdmins?: CallerRow[] }> })
      ?.byRole;
    const merged = (byRole ?? [])
      .filter((r) => CALLER_HEAD_ROLE_IDS.has(String(r.roleId)))
      .flatMap((r) => r.subAdmins ?? [])
      .filter((v) => !v.block);
    setHeads(merged);
  }, []);

  const loadMain = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        startDate,
        endDate,
        callerHead: isCallerHead ? user?.name || '' : callerHead,
      };
      if (office) body.officeLocation = office;

      const [depRes, botRes] = await Promise.all([
        secureApi('caller.depositByEmpcodeOffice', body),
        secureApi('caller.activeUsersFromCalls', { startDate, endDate }),
      ]);
      if (gen !== genRef.current) return; // stale response

      if (!depRes.ok || depRes.success === false) {
        setError(depRes.message || 'Failed to load caller data');
        setCallerRows([]);
        setLocationRows([]);
        setPayload({});
      } else {
        const data = (depRes.data || {}) as CallerRow;
        const byEmp = Array.isArray(data.byEmpCode) ? (data.byEmpCode as CallerRow[]) : [];
        setCallerRows(filterCallerRows(byEmp, user, isCaller, showTotalDeposit));
        setLocationRows(
          Array.isArray(data.byOfficeLocation) ? (data.byOfficeLocation as CallerRow[]) : [],
        );
        setPayload(data);
        setError('');
      }

      if (botRes.ok && botRes.success !== false) {
        const bot = botRes.data as { users?: CallerRow[]; total?: number } | undefined;
        setBotCount(Number(bot?.total ?? bot?.users?.length ?? 0));
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, callerHead, office, isCallerHead, isCaller, showTotalDeposit]);

  useEffect(() => {
    void loadHeads();
  }, [loadHeads]);

  // Reload only when filters change — not when returning from deposit/refund/unique lists.
  // Pull-to-refresh still calls loadMain() manually.
  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  const displayedBotCount = isCaller ? 0 : botCount;
  const summary = (payload.summary || {}) as CallerRow;

  const summaryItems = useMemo(() => {
    const items: { label: string; value: string }[] = [
      { label: "Total Employee (Caller's)", value: cellText(isCallerOrHead ? 0 : summary.totalEmpCodes) },
    ];
    if (showLocation) {
      items.push({
        label: 'Total Office Location',
        value: cellText(isCallerOrHead ? 0 : summary.totalOfficeLocations),
      });
    }
    items.push(
      { label: 'Total Transaction', value: cellText(isCallerOrHead ? 0 : summary.totalTransactions) },
      { label: 'Total Active Customers', value: cellText(isCallerOrHead ? 0 : payload.totalActiveUsers) },
      { label: 'Total Transaction Count', value: String(isCallerOrHead ? 0 : roundAmt(payload.totalDeposit)) },
      { label: 'Active Customers By Bot', value: String(displayedBotCount) },
    );
    return items;
  }, [isCallerOrHead, summary, payload, displayedBotCount, showLocation]);

  const locationColumns = useMemo<DataTableColumn<CallerRow>[]>(
    () => [
      { key: 'office', label: 'Office Location', width: 120, render: (r) => cellText(r.officeLocation) },
      { key: 'txn', label: 'Txn Count', width: 90, align: 'right', render: (r) => cellText(r.transactionCount) },
      { key: 'active', label: 'Active Customers', width: 110, align: 'right', render: (r) => cellText(r.activeUserCount) },
      { key: 'deposit', label: 'Total Deposit', width: 110, align: 'right', render: (r) => roundAmt(r.totalDeposit) },
      { key: 'wApp', label: 'Refund Approved Amt', width: 130, align: 'right', render: (r) => roundAmt(r.withdrawalApprovedAmount) },
      { key: 'pnl', label: 'PNL', width: 100, align: 'right', render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount) },
      { key: 'wPend', label: 'Refund Pending Amt', width: 130, align: 'right', render: (r) => roundAmt(r.withdrawalPendingAmount) },
      { key: 'wAppC', label: 'Refund Approved Count', width: 130, align: 'right', render: (r) => cellText(r.withdrawalApprovedCount) },
      { key: 'wPendC', label: 'Refund Pending Count', width: 130, align: 'right', render: (r) => cellText(r.withdrawalPendingCount) },
    ],
    [],
  );

  const callerColumns = useMemo<DataTableColumn<CallerRow>[]>(() => {
    const cols: DataTableColumn<CallerRow>[] = [
      { key: 'sr', label: 'SR. No', width: 60, render: (_r, i) => String(i + 1) },
      { key: 'pseudo', label: 'Pseudo Name', width: 130, render: (r) => String(r.subAdminName ?? 'Company') },
    ];
    // Callers must not see employee real names — Pseudo Name only.
    if (!isCaller) {
      cols.push({
        key: 'real',
        label: 'Real Name',
        width: 130,
        render: (r) => displayName(r.realName),
      });
    }
    if (showLocation) {
      cols.push({ key: 'office', label: 'Office Location', width: 110, render: (r) => cellText(r.officeLocation) });
    }
    cols.push(
      { key: 'deposit', label: 'Total Deposit', width: 110, align: 'right', render: (r) => roundAmt(r.totalDeposit) },
      { key: 'wAppAmt', label: 'Refund Approved Amt', width: 130, align: 'right', render: (r) => roundAmt(r.withdrawalApprovedAmount) },
      { key: 'pnl', label: 'PNL', width: 100, align: 'right', render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount) },
      { key: 'wPendAmt', label: 'Refund Pending Amt', width: 130, align: 'right', render: (r) => roundAmt(r.withdrawalPendingAmount) },
      { key: 'wAppCnt', label: 'Refund Approved Count', width: 130, align: 'right', render: (r) => cellText(r.withdrawalApprovedCount) },
      { key: 'wPendCnt', label: 'Refund Pending Count', width: 130, align: 'right', render: (r) => cellText(r.withdrawalPendingCount) },
      { key: 'activeCust', label: 'Active Customers', width: 110, align: 'right', render: (r) => cellText(r.transactionCount) },
    );
    if (!isCaller) {
      cols.push(
        { key: 'ex', label: 'E', width: 60, align: 'right', render: (r) => cellText(r.activeUserCount) },
        { key: 'casino', label: 'C', width: 60, align: 'right', render: (r) => cellText(ecs(r).E) },
        { key: 'matka', label: 'S', width: 60, align: 'right', render: (r) => cellText(ecs(r).C) },
      );
    }
    cols.push({ key: 'daily', label: 'Daily Deposit', width: 100, align: 'right', render: (r) => roundAmt(ecs(r).S) });
    if (!isCaller) {
      cols.push({ key: 'status', label: 'Status', width: 100, render: (r) => cellText(r.time) });
    }
    cols.push({ key: 'emp', label: 'Emp Code', width: 100, render: (r) => cellText(r.empCode) });
    if (!isCaller) {
      cols.push({ key: 'head', label: 'Caller Head', width: 130, render: (r) => displayName(r.callerHead) });
    }
    return cols;
  }, [isCaller, showLocation]);

  const applyAll = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }, [draftStart, draftEnd]);

  const listColumns = useMemo(
    () => callerColumns.filter((c) => MAIN_KEYS.has(c.key)),
    [callerColumns],
  );

  const onCallerPress = useCallback((row: CallerRow, index: number) => {
    setSelected({ row, index });
  }, []);

  const header = useMemo(
    () => (
    <View>
      <Text style={styles.title}>Caller Responsibility</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a caller row for details & view lists
      </Text>

      {!isCaller && (
        <>
          <DetailFilterBar
            startDate={draftStart}
            endDate={draftEnd}
            loading={loading}
            onStartDateChange={setDraftStart}
            onEndDateChange={setDraftEnd}
            onApply={applyAll}
          />

          {showCallerHead && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <View style={styles.chipRow}>
                <Text style={styles.chipRowLabel}>Caller Head</Text>
                <TouchableOpacity
                  style={[styles.chip, callerHead === '' && styles.chipActive]}
                  onPress={() => setCallerHead('')}
                >
                  <Text style={[styles.chipText, callerHead === '' && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {heads.map((h) => {
                  const name = String(h.name || '');
                  return (
                    <TouchableOpacity
                      key={String(h._id || name)}
                      style={[styles.chip, callerHead === name && styles.chipActive]}
                      onPress={() => setCallerHead(name)}
                    >
                      <Text style={[styles.chipText, callerHead === name && styles.chipTextActive]}>
                        {name || cellText(h.empCode)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {showLocation && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <View style={styles.chipRow}>
                <Text style={styles.chipRowLabel}>Location</Text>
                <TouchableOpacity
                  style={[styles.chip, office === '' && styles.chipActive]}
                  onPress={() => setOffice('')}
                >
                  <Text style={[styles.chipText, office === '' && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {OFFICE_LOCATIONS.map((o) => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.chip, office === o && styles.chipActive]}
                    onPress={() => setOffice(o)}
                  >
                    <Text style={[styles.chipText, office === o && styles.chipTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <Text style={styles.botLine}>
            Active Customer (By Bots): <Text style={styles.botCount}>{displayedBotCount}</Text>
          </Text>
        </>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading data…</Text>
        </View>
      ) : null}

      {!loading && showTotalDeposit && (
        <>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            {summaryItems.map((it) => (
              <View key={it.label} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{it.label}</Text>
                <Text style={styles.summaryValue}>{it.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!loading && showTotalDeposit && showLocation && (
        <>
          <Text style={styles.sectionTitle}>By Office Location</Text>
          <DataTable
            columns={locationColumns}
            rows={locationRows}
            keyFor={(r, i) => String(r.officeLocation || i)}
            emptyMessage={loading ? 'Loading…' : 'No office data'}
          />
        </>
      )}

      {!loading && (
        <>
          <Text style={styles.sectionTitle}>Caller Data</Text>
          <View style={styles.callerHeadRow}>
            {listColumns.map((c) => (
              <Text
                key={c.key}
                style={[
                  styles.callerHead,
                  { flex: c.key === 'sr' ? 0.5 : 1 },
                  c.align === 'right' && styles.callerRight,
                ]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
    ),
    [
      startDate,
      endDate,
      isCaller,
      draftStart,
      draftEnd,
      loading,
      applyAll,
      showCallerHead,
      callerHead,
      heads,
      showLocation,
      office,
      displayedBotCount,
      error,
      showTotalDeposit,
      summaryItems,
      locationColumns,
      locationRows,
      listColumns,
    ],
  );

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={loading ? [] : callerRows}
        keyExtractor={(r, i) => String(r.empCode || r._id || i)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void loadMain()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loading ? null : <Text style={styles.emptyList}>No caller data</Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => onCallerPress(item, index)}
            delayPressIn={0}
            unstable_pressDelay={0}
            style={({ pressed }) => [styles.callerRow, pressed && styles.callerRowPressed]}
          >
            {listColumns.map((c) => (
              <Text
                key={c.key}
                style={[
                  styles.callerCell,
                  { flex: c.key === 'sr' ? 0.5 : 1 },
                  c.align === 'right' && styles.callerRight,
                ]}
                numberOfLines={1}
              >
                {c.render(item, index)}
              </Text>
            ))}
          </Pressable>
        )}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={
          selected ? String(selected.row.subAdminName || selected.row.empCode || 'Details') : ''
        }
        fields={
          selected
            ? callerColumns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected.row, selected.index),
              }))
            : []
        }
        actions={
          selected
            ? [
                {
                  label: 'View Deposit',
                  tone: 'primary',
                  onPress: () => openDepositList(selected.row),
                },
                {
                  label: 'View Refund List',
                  onPress: () => openDepositList(selected.row, 'withdrawal'),
                },
                {
                  label: 'View Unique Pending',
                  onPress: () => openDepositList(selected.row, 'uniquePending'),
                },
              ]
            : undefined
        }
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  chipScroll: { marginTop: spacing(3) },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipRowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
  botLine: { color: colors.foreground, fontSize: 13, marginTop: spacing(3) },
  botCount: { fontWeight: '700', color: colors.primary },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing(4),
    marginBottom: spacing(2),
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginTop: spacing(1) },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  emptyList: { color: colors.muted, textAlign: 'center', marginTop: spacing(4) },
  callerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2),
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 1,
  },
  callerHead: { color: colors.primary, fontWeight: '700', fontSize: 12, paddingHorizontal: spacing(1) },
  callerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(2),
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  callerRowPressed: { backgroundColor: colors.surfaceAlt },
  callerCell: { color: colors.foreground, fontSize: 13, paddingHorizontal: spacing(1) },
  callerRight: { textAlign: 'right' },
});
