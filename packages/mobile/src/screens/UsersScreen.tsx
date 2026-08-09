/**
 * Users — mobile port of desktop UsersPage.
 * All user types (User / Sub_Admin / Todays_Active / Active_User /
 * Non_Performing_User / In_Active_Deposit / Non_Performing_Active_User /
 * LAXMI_999_Users) with the desktop action + payload mapping, server search,
 * pagination, row detail sheet, OTP-gated block/unblock and Create User.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../dashboards/ui/DataTable';
import { pickLastActivity } from '../dashboards/userRowUtils';
import { secureApi } from '../api/client';
import { getSessionUser, hasPermission } from '../auth/permissions';
import { formatDisplayDate, todayIST } from '../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './dashboards/details/DetailFilterBar';
import { RowDetailSheet, type SheetField } from './dashboards/details/RowDetailSheet';
import { CreateUserScreen } from './CreateUserScreen';

/* ---------------------------------- types --------------------------------- */

const USER_TYPES = [
  'User',
  'Sub_Admin',
  'Todays_Active',
  'Active_User',
  'Non_Performing_User',
  'In_Active_Deposit',
  'Non_Performing_Active_User',
  'LAXMI_999_Users',
] as const;
type UserType = (typeof USER_TYPES)[number];

/** Callers: hide Todays_Active / Active_User / LAXMI_999 (desktop parity). */
const CALLER_HIDDEN: UserType[] = ['Todays_Active', 'Active_User', 'LAXMI_999_Users'];

const TYPE_ACTION: Record<UserType, string> = {
  User: 'users.getAll',
  Sub_Admin: 'users.getSubAdmins',
  Todays_Active: 'ops.activeCustomers',
  Active_User: 'users.getActiveUsers',
  Non_Performing_User: 'ops.nonPerformingUser',
  In_Active_Deposit: 'users.inactiveDeposit',
  Non_Performing_Active_User: 'users.nonPerformingActive',
  LAXMI_999_Users: 'users.laxmi999',
};

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  played?: string;
  kyc?: unknown;
  empCode?: string;
  email?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  balance?: number;
  totalDeposit?: number;
  totalWithdrawal?: number;
  createdOn?: string;
  blockUser?: boolean;
  block?: boolean;
  blockUserReason?: string;
  Role_Name?: string;
  telegramUsername?: string;
  activeDays?: number;
  [key: string]: unknown;
};

/* -------------------------- block OTP target rules ------------------------- */
/** Desktop users/constants: OTP goes to SuperAdmin unless self-allowlisted. */
const BLOCK_OTP_DEFAULT_MOBILE = '9373114572';
const BLOCK_OTP_SELF_MOBILES = new Set(['9608010101', '9561139951']);

function resolveBlockOtpMobile(loginMobile?: string): string {
  const mobile = String(loginMobile || '').trim();
  if (BLOCK_OTP_SELF_MOBILES.has(mobile)) return mobile;
  return BLOCK_OTP_DEFAULT_MOBILE;
}

/* --------------------------------- helpers -------------------------------- */

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}
function isBlocked(r: Row): boolean {
  return Boolean(r.blockUser ?? r.block);
}

function searchFieldsFor(type: UserType, hideContact: boolean): readonly SearchFieldOption[] {
  if (type === 'Sub_Admin') {
    return [
      { key: 'name', label: 'Name' },
      { key: 'mobile', label: 'Mobile' },
    ];
  }
  const fields: SearchFieldOption[] = [
    { key: 'name', label: 'Name' },
    { key: '_id', label: 'Dp Id' },
  ];
  if (!hideContact) {
    fields.push(
      { key: 'mobile', label: 'Mobile' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'aadhaarNumber', label: 'Aadhar' },
      { key: 'email', label: 'Email' },
    );
  }
  fields.push({ key: 'city', label: 'City' }, { key: 'state', label: 'State' });
  if (type === 'User' || type === 'Non_Performing_User') {
    fields.push({ key: 'empCode', label: 'Emp Code' }, { key: 'played', label: 'In (E/C/S)' });
  }
  return fields;
}

/* ------------------------------ block modal ------------------------------- */

function BlockUserModal({
  row,
  onClose,
  onDone,
}: {
  row: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'reason' | 'otp'>('reason');
  const [busy, setBusy] = useState(false);
  const target = resolveBlockOtpMobile(getSessionUser()?.mobile);

  useEffect(() => {
    setReason('');
    setOtp('');
    setStep('reason');
    setBusy(false);
  }, [row]);

  if (!row) return null;
  const blocking = !isBlocked(row);

  const sendOtp = async () => {
    if (!reason.trim()) {
      Alert.alert('Remark is required');
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi<unknown>('users.sendBlockOtp', { mobile: target });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to send OTP');
        return;
      }
      setStep('otp');
    } finally {
      setBusy(false);
    }
  };

  const verifyAndApply = async () => {
    if (!/^\d{4}$/.test(otp.trim())) {
      Alert.alert('OTP must be 4 digits');
      return;
    }
    setBusy(true);
    try {
      const v = await secureApi<unknown>('users.verifyBlockOtp', {
        mobile: target,
        otp: Number(otp.trim()),
      });
      if (!v.ok) {
        Alert.alert(v.message || 'Invalid OTP');
        return;
      }
      const res = await secureApi<unknown>('users.blockUnblock', {
        _id: row._id,
        blockUser: blocking,
        blockUserReason: reason.trim(),
      });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to update user');
        return;
      }
      Alert.alert(res.message || (blocking ? 'User blocked' : 'User unblocked'));
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {blocking ? 'Block' : 'Unblock'} {display(row.name)}
          </Text>
          {step === 'reason' ? (
            <>
              <Text style={styles.modalSub}>Remark (required)</Text>
              <TextInput
                style={styles.modalInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason…"
                placeholderTextColor={colors.muted}
                multiline
              />
            </>
          ) : (
            <>
              <Text style={styles.modalSub}>4-digit OTP sent for verification</Text>
              <TextInput
                style={[styles.modalInput, styles.otpInput]}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={4}
              />
            </>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={onClose} disabled={busy}>
              <Text style={styles.mBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary, busy && styles.disabled]}
              onPress={() => void (step === 'reason' ? sendOtp() : verifyAndApply())}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.mBtnPrimaryText}>
                  {step === 'reason' ? 'Send OTP' : blocking ? 'Verify & Block' : 'Verify & Unblock'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------------- screen --------------------------------- */

const PAGE_SIZE = 25;
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'appName', 'balance', 'blocked', 'role']);

export function UsersScreen() {
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');
  const isCaller = !hasPermission('View_Subadmin_User') && hasPermission('contact_visibility_none');
  const canCreate = hasPermission('create_new_user');

  const typeOptions = useMemo(
    () =>
      USER_TYPES.filter((t) => {
        if (t === 'Sub_Admin' && !hasPermission('View_Subadmin_User')) return false;
        if (isCaller && CALLER_HIDDEN.includes(t)) return false;
        return true;
      }),
    [isCaller],
  );

  const [userType, setUserType] = useState<UserType>('User');
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [dates, setDates] = useState<{ start: string; end: string } | null>(null);
  const [appClientName, setAppClientName] = useState('');
  const [blockFilter, setBlockFilter] = useState<'' | 'block' | 'unblock'>('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [blockRow, setBlockRow] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (appliedSearch.text.trim()) filter[appliedSearch.field] = appliedSearch.text.trim();
      if (blockFilter && userType === 'User') filter.blockUser = blockFilter === 'block';

      let payload: Record<string, unknown>;
      switch (userType) {
        case 'Sub_Admin':
          payload = { pageNo: page, itemPerPage: pageSize, filter };
          break;
        case 'Non_Performing_User':
          payload = { pageNo: page, itemPerPage: pageSize, filter };
          break;
        case 'Non_Performing_Active_User':
          payload = { filter };
          break;
        case 'LAXMI_999_Users':
          payload = { pageNo: page, itemsPerPage: pageSize, filter };
          break;
        case 'Active_User':
          payload = {
            pageNo: page,
            itemsPerPage: pageSize,
            filter,
            ...(dates ? { activeUserStartDate: dates.start, activeUserEndDate: dates.end } : {}),
          };
          break;
        default:
          payload = {
            pageNo: page,
            itemsPerPage: pageSize,
            filter,
            ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
            ...(userType === 'User' ? { activeUserStart: '', activeUserEnd: '' } : {}),
          };
      }
      const res = await secureApi(TYPE_ACTION[userType], payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      const raw = (res.data ?? {}) as Record<string, unknown>;
      const list = (raw.items ?? raw.users ?? raw.user ?? raw.data ?? []) as Row[];
      setSelected(null);
      setRows(Array.isArray(list) ? list : []);
      setTotalPages(Math.max(1, Number(raw.totalPages ?? 1) || 1));
      setTotal(Number(raw.total ?? raw.count ?? (Array.isArray(list) ? list.length : 0)) || 0);
    } finally {
      setLoading(false);
    }
  }, [appClientName, appliedSearch, blockFilter, dates, page, pageSize, userType]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
    ];
    if (userType === 'Sub_Admin') {
      cols.push(
        {
          key: 'mobile',
          label: 'Mobile',
          width: 110,
          render: (r) => maskMobile(r.mobile, canShowMobile),
        },
        { key: 'role', label: 'Role', width: 120, render: (r) => display(r.Role_Name) },
        { key: 'telegram', label: 'Telegram', width: 120, render: (r) => display(r.telegramUsername) },
        { key: 'email', label: 'Email', width: 160, render: (r) => display(r.email) },
        { key: 'lastActivity', label: 'Last Activity', width: 150, render: (r) => pickLastActivity(r) },
      );
      return cols;
    }
    cols.push({ key: 'dpId', label: 'Dp Id', width: 150, render: (r) => display(r._id) });
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      });
    }
    cols.push(
      { key: 'appName', label: 'App Code', width: 70, render: (r) => appCodeForName(r.clientName) },
      { key: 'empCode', label: 'Emp Code', width: 70, render: (r) => display(r.empCode) },
      { key: 'playIn', label: 'In', width: 60, render: (r) => display(r.played) },
      { key: 'kyc', label: 'Kyc', width: 60, render: (r) => (r.kyc ? 'Yes' : 'No') },
    );
    if (!hideContact) {
      cols.push({
        key: 'email',
        label: 'Email',
        width: 160,
        render: (r) => (canShowMobile ? display(r.email) : '**********'),
      });
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'balance',
        label: 'Balance',
        width: 80,
        align: 'right',
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'totalDeposit',
        label: 'Total Deposit',
        width: 100,
        align: 'right',
        render: (r) => floorNum(r.totalDeposit ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'blocked',
        label: 'Status',
        width: 80,
        render: (r) => (isBlocked(r) ? 'Blocked' : 'Active'),
        color: (r) => (isBlocked(r) ? colors.destructive : undefined),
      },
      {
        key: 'created',
        label: 'Created',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
    );
    return cols;
  }, [page, pageSize, userType, hideContact, canShowMobile]);

  const showBlockAction = userType !== 'Sub_Admin' && !isCaller;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>
        </View>
        {canCreate ? (
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createBtnText}>＋ Create</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {typeOptions.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, userType === t && styles.chipActive]}
            onPress={() => {
              setUserType(t);
              setPage(1);
              setSearchField('name');
              setSearchDraft('');
              setAppliedSearch({ field: 'name', text: '' });
            }}
          >
            <Text style={[styles.chipText, userType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {userType === 'User' ? (
        <View style={styles.chipRowPlain}>
          {(
            [
              ['', 'All'],
              ['block', 'Blocked'],
              ['unblock', 'Unblocked'],
            ] as const
          ).map(([v, label]) => (
            <TouchableOpacity
              key={label}
              style={[styles.chip, blockFilter === v && styles.chipActive]}
              onPress={() => {
                setBlockFilter(v);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, blockFilter === v && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setDates({ start: draftStart, end: draftEnd });
          setPage(1);
        }}
        appClientName={appClientName}
        onAppChange={(v) => {
          setAppClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        searchFields={searchFieldsFor(userType, hideContact)}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setAppliedSearch({ field: searchField, text: searchDraft });
          setPage(1);
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
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No users found"
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
        actions={
          showBlockAction && selected
            ? [
                {
                  label: isBlocked(selected) ? 'Unblock User' : 'Block User',
                  tone: isBlocked(selected) ? ('primary' as const) : ('warning' as const),
                  onPress: () => {
                    const row = selected;
                    setSelected(null);
                    setBlockRow(row);
                  },
                },
              ]
            : undefined
        }
      />

      <BlockUserModal row={blockRow} onClose={() => setBlockRow(null)} onDone={() => void load()} />

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.createWrap}>
          <View style={styles.createHead}>
            <Text style={styles.createTitle}>Create User</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)} hitSlop={8}>
              <Text style={styles.createClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <CreateUserScreen />
        </View>
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
  headRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  createBtnText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 13 },
  chipRow: { gap: spacing(2), paddingVertical: spacing(3) },
  chipRowPlain: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12 },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '700' },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(5),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalSub: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    marginTop: spacing(2),
    minHeight: 44,
  },
  otpInput: { textAlign: 'center', letterSpacing: 4, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(4) },
  mBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  mBtnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  mBtnGhostText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  mBtnPrimary: { backgroundColor: colors.primary },
  mBtnPrimaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  createWrap: { flex: 1, backgroundColor: colors.background },
  createHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
    paddingTop: spacing(12),
    paddingBottom: spacing(2),
  },
  createTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  createClose: { color: colors.muted, fontSize: 20 },
});
