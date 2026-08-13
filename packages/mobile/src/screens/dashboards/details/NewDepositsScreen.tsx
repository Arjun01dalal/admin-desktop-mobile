/**
 * New Deposits — port of desktop NewDepositsPage.
 * ops.newDeposits { itemsPerPage, pageNo, startDate, endDate, filter:{ name?, mobile? } }.
 * Date + per-page filter bar; name/mobile search modal; paged table. Row tap opens a
 * detail sheet with every desktop column. Mobile/email masked unless show_mobile.
 * accessibleStates (from stored user) filters rows client-side, mirroring desktop.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { pickPageSizes } from '@astro/shared';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  encryptedUserName?: string;
  previousCaller?: { name?: string; Dp_ID?: string; DP_ID?: string };
  previousCallerName?: string;
  previousCallerDpId?: string;
  currentCaller?: { name?: string };
  referredCode?: string;
  referredReferralCode?: string;
  referralCodeUser?: string;
  referralCode?: string;
  deviceType?: string;
  subDomain?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  balance?: number;
  createdOn?: string;
  updatedAt?: string;
  bonusWalletBalance?: number;
  [key: string]: unknown;
};

type Filters = { name: string; mobile: string };

const EMPTY_FILTERS: Filters = { name: '', mobile: '' };
const PAGE_SIZE_OPTIONS = pickPageSizes([10, 25, 50, 100, 200]);
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'balance']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === undefined || value === null || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function formatAmount(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Tolerant paged unpack: list under items/users/docs/payload(.items), count from total/count. */
function asPaged<T>(data: unknown): { list: T[]; total: number } {
  if (Array.isArray(data)) return { list: data as T[], total: (data as T[]).length };
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    let list: T[] = [];
    for (const key of ['items', 'users', 'docs', 'data']) {
      const v = nested[key] ?? obj[key];
      if (Array.isArray(v)) {
        list = v as T[];
        break;
      }
    }
    const total =
      Number(nested.total ?? nested.count ?? obj.total ?? obj.count ?? 0) || list.length;
    return { list, total };
  }
  return { list: [], total: 0 };
}

export function NewDepositsScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();
  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Search modal.
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const genRef = useRef(0);

  const canShowMobile = hasPermission('show_mobile');

  const accessibleStates = useMemo(() => {
    const user = getStoredUser<{ accessibleStates?: unknown }>();
    const raw = user?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (applied.name.trim()) filter.name = applied.name.trim();
      if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
      const res = await secureApi<unknown>('ops.newDeposits', {
        itemsPerPage: pageSize,
        pageNo: page,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load new deposits');
        setRawRows([]);
        setTotal(0);
        return;
      }
      const { list, total: count } = asPaged<Row>(res.data);
      setSheetRow(null);
      setRawRows(list);
      setTotal(count);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, applied, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (accessibleStates.length === 0) return rawRows;
    return rawRows.filter((row) =>
      accessibleStates.includes(String(row.state || '').toLowerCase()),
    );
  }, [rawRows, accessibleStates]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      {
        key: 'idx',
        label: 'Sr.No',
        width: 60,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      {
        key: 'name',
        label: 'Name',
        width: 140,
        render: (r) => display(r.name),
        onCellPress: (r) => {
          if (!r._id) return;
          navigation.navigate('/user-report', {
            userId: String(r._id),
            userName: String(r.name || ''),
          });
        },
      },
      {
        key: 'mobile',
        label: 'Mobile Phone',
        width: 130,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      { key: 'userBankName', label: 'User Bank Name', width: 150, render: (r) => display(r.userBankName) },
      {
        key: 'encryptedDpId',
        label: 'User Encrypted Dp ID',
        width: 170,
        render: (r) => display(r.encryptedUserName),
      },
      { key: 'account', label: 'Account No', width: 140, render: (r) => display(r.accountNumber) },
      { key: 'aadhar', label: 'Aadhar No', width: 140, render: (r) => display(r.aadhaarNumber) },
      {
        key: 'email',
        label: 'Email',
        width: 170,
        render: (r) => (canShowMobile ? display(r.email) : '**********'),
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'previousCallerName',
        label: 'Previous Caller Name',
        width: 160,
        render: (r) => display(r.previousCaller?.name ?? r.previousCallerName),
      },
      {
        key: 'previousCallerDpId',
        label: 'Previous Caller DP ID',
        width: 160,
        render: (r) =>
          display(
            r.previousCaller?.Dp_ID ?? r.previousCaller?.DP_ID ?? r.previousCallerDpId,
          ),
      },
      {
        key: 'currentCaller',
        label: 'Current Caller',
        width: 140,
        render: (r) => display(r.currentCaller?.name),
      },
      {
        key: 'referredCode',
        label: 'Referred Referral Code',
        width: 170,
        render: (r) => display(r.referredCode ?? r.referredReferralCode),
      },
      {
        key: 'referralCode',
        label: 'Referral Code',
        width: 140,
        render: (r) => display(r.referralCodeUser ?? r.referralCode),
      },
      { key: 'device', label: 'Device Type', width: 120, render: (r) => display(r.deviceType) },
      { key: 'platform', label: 'Platform', width: 120, render: (r) => display(r.subDomain) },
      {
        key: 'currentAppVersion',
        label: 'Current App Version',
        width: 150,
        render: (r) => display(r.currentAppVersion),
      },
      {
        key: 'updatedAppVersion',
        label: 'Updated App Version',
        width: 150,
        render: (r) => display(r.updatedAppVersion),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 110,
        render: (r) => formatAmount(r.balance ?? 0),
      },
      {
        key: 'created',
        label: 'Created',
        width: 120,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 110,
        render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
      },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 180,
        render: (r) =>
          r.updatedAt
            ? `${formatDisplayDate(r.updatedAt)} | ${formatDisplayTime(r.updatedAt)}`
            : '—',
      },
      {
        key: 'bonusBalance',
        label: 'Bonus Balance',
        width: 130,
        render: (r) => formatAmount(r.bonusWalletBalance ?? 0),
      },
    ],
    [page, pageSize, canShowMobile, navigation],
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>New Deposits</Text>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            setDraft(applied);
            setSearchOpen(true);
          }}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

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
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {applied.name || applied.mobile ? (
        <View style={styles.chipsRow}>
          <Text style={styles.chipsLabel}>Filters:</Text>
          {applied.name ? <Text style={styles.activeChip}>Name: {applied.name}</Text> : null}
          {applied.mobile ? <Text style={styles.activeChip}>Mobile: {applied.mobile}</Text> : null}
          <TouchableOpacity
            onPress={() => {
              setApplied(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            <Text style={styles.clearChip}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No new deposits found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        onClose={() => setSheetRow(null)}
      />

      {/* Search modal */}
      <Modal
        visible={searchOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setSearchOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Search New Deposits
              </Text>
              <TouchableOpacity
                onPress={() => setSearchOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={draft.name}
              onChangeText={(v) => setDraft((prev) => ({ ...prev, name: v }))}
              placeholder="Search by name"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Mobile</Text>
            <TextInput
              style={styles.modalInput}
              value={draft.mobile}
              onChangeText={(v) => setDraft((prev) => ({ ...prev, mobile: v }))}
              placeholder="Search by mobile"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => {
                setApplied(draft);
                setPage(1);
                setSearchOpen(false);
              }}
            >
              <Text style={styles.submitBtnText}>Apply Search</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipsLabel: { color: colors.muted, fontSize: 12 },
  activeChip: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2.5),
    overflow: 'hidden',
  },
  clearChip: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(3), marginBottom: spacing(1) },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
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
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
});
