/**
 * Caller deposit / refund / unique-pending list — port of desktop
 * CallerDepositListPage. Opened from Caller Responsibility row actions.
 *
 * - Deposit: uses `list.deposits` from the parent caller row (no extra API).
 * - Refund: `caller.withdrawalByEmpcode`
 * - Unique Pending: `caller.uniquePendingDeposits`
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { appCodeForName, CLIENT_NAMES } from '@astro/shared';
import { secureApi } from '../../../api/client';
import {
  CALLER_ROLE_IDS,
  RESP_SHOW_MOBILE,
  type CallerRow,
} from '../../../auth/callerRoles';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { singleCallToDialer } from '../../../utils/externalDialer';
import { colors, radius, spacing } from '../../../theme';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type ListParams = {
  list?: CallerRow;
  type?: 'withdrawal' | 'uniquePending' | string;
  empCode?: string;
  startDate?: string;
  endDate?: string;
};

type StatusTotal = { count?: number; amount?: number };

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatAmount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-IN');
}

function pickItems(data: unknown): CallerRow[] {
  if (Array.isArray(data)) return data as CallerRow[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as CallerRow;
  if (Array.isArray(obj.items)) return obj.items as CallerRow[];
  if (Array.isArray(obj.data)) return obj.data as CallerRow[];
  if (obj.payload && typeof obj.payload === 'object') {
    const inner = obj.payload as CallerRow;
    if (Array.isArray(inner.items)) return inner.items as CallerRow[];
    if (Array.isArray(obj.payload)) return obj.payload as CallerRow[];
  }
  return [];
}

function pickTotalPages(data: unknown): number {
  if (!data || typeof data !== 'object') return 1;
  const obj = data as CallerRow;
  const nested =
    obj.payload && typeof obj.payload === 'object' ? (obj.payload as CallerRow) : null;
  return Number(obj.totalPages ?? nested?.totalPages ?? 1) || 1;
}

function pickWithdrawalTotals(data: unknown): {
  all: StatusTotal;
  approved: StatusTotal;
  cancel: StatusTotal;
  pending: StatusTotal;
} {
  const empty = { count: 0, amount: 0 };
  if (!data || typeof data !== 'object') {
    return { all: empty, approved: empty, cancel: empty, pending: empty };
  }
  const obj = data as CallerRow;
  const totals = (
    obj.totals && typeof obj.totals === 'object'
      ? obj.totals
      : (obj.payload as CallerRow | undefined)?.totals &&
          typeof (obj.payload as CallerRow).totals === 'object'
        ? (obj.payload as CallerRow).totals
        : null
  ) as
    | {
        all?: StatusTotal;
        byStatus?: {
          Approved?: StatusTotal;
          Cancel?: StatusTotal;
          Pending?: StatusTotal;
        };
      }
    | null;

  return {
    all: totals?.all ?? empty,
    approved: totals?.byStatus?.Approved ?? empty,
    cancel: totals?.byStatus?.Cancel ?? empty,
    pending: totals?.byStatus?.Pending ?? empty,
  };
}

function formatCheckBy(value: unknown): string {
  if (!value || typeof value !== 'object') return display(value);
  const info = value as { name?: string; city?: string; state?: string; date?: string };
  const date = formatDisplayDate(info.date) || display(info.date);
  return `Name: ${display(info.name)} · City: ${display(info.city)} · State: ${display(info.state)} · Date: ${date}`;
}

const STATUS_CHIPS = ['', 'Approved', 'Pending', 'Cancel'] as const;
const CHECKED_CHIPS: { value: 'all' | 'yes' | 'no'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Checked' },
  { value: 'no', label: 'Unchecked' },
];

export function CallerDepositListScreen() {
  const navigation = useNavigation();
  const params = (useRoute().params ?? {}) as ListParams;
  const list = params.list;
  const type = params.type;
  const isWithdrawal = type === 'withdrawal';
  const isUniquePending = type === 'uniquePending';
  const empCode = String(params.empCode || list?.empCode || '');
  const parentStart = params.startDate;
  const parentEnd = params.endDate;

  const user = getStoredUser<{
    Role_ID?: string;
    _id?: string;
    name?: string;
    clientName?: string | string[];
    allotedApps?: string | string[];
    extensionId?: string[] | string;
    serverId?: unknown;
  }>();
  const isCaller = CALLER_ROLE_IDS.has(String(user?.Role_ID || ''));
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, getSessionUser());

  const appOptions = useMemo(() => {
    const allotted = user?.clientName || user?.allotedApps;
    if (Array.isArray(allotted) && allotted.length) return allotted.map(String);
    if (typeof allotted === 'string' && allotted) return [allotted];
    return [...CLIENT_NAMES];
  }, [user?.clientName, user?.allotedApps]);

  const [startDate, setStartDate] = useState(() => parentStart || todayIST());
  const [endDate, setEndDate] = useState(() => parentEnd || todayIST());
  const [draftStart, setDraftStart] = useState(() => parentStart || todayIST());
  const [draftEnd, setDraftEnd] = useState(() => parentEnd || todayIST());
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<unknown>({});
  const [mobile, setMobile] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState('');
  const [name, setName] = useState('');
  const [checkedFilter, setCheckedFilter] = useState<'all' | 'yes' | 'no'>('yes');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(null);
  const [calling, setCalling] = useState(false);
  const textFiltersRef = React.useRef({ name: '', minAmount: '', maxAmount: '' });
  textFiltersRef.current = { name, minAmount, maxAmount };

  const title = isWithdrawal ? 'Refund List' : isUniquePending ? 'Unique Pending' : 'Deposit List';
  const callerLabel = String(list?.subAdminName || empCode || '');

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerBackVisible: false,
      headerLeft: () => null,
    });
  }, [navigation, title]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const addToDialer = useCallback(
    (row: CallerRow) => {
      const rawMobile = String(row.userMobile || row.mobile || '');
      if (!rawMobile) {
        Alert.alert('No mobile number for this user');
        return;
      }
      void (async () => {
        setCalling(true);
        try {
          const res = await singleCallToDialer({
            lead: {
              _id: String(row._id || row.userId || ''),
              name: String(row.userName || row.name || ''),
              mobile: rawMobile,
              city: String(row.city || row.userCity || ''),
              state: String(row.state || row.userState || ''),
              clientName: String(row.clientName || ''),
            },
            extensionId: user?.extensionId,
            adminName: typeof user?.name === 'string' ? user.name : 'ADMIN',
            serverId: user?.serverId,
          });
          Alert.alert(res.ok ? 'Dialer' : 'Dialer failed', res.message);
        } finally {
          setCalling(false);
        }
      })();
    },
    [user?.extensionId, user?.name, user?.serverId],
  );

  const rows = useMemo(() => {
    let next: CallerRow[];
    if (isWithdrawal || isUniquePending) next = pickItems(payload);
    else {
      const deposits = list?.deposits;
      next = Array.isArray(deposits) ? (deposits as CallerRow[]) : [];
    }
    if (!isWithdrawal) return next;
    const min = Number(minAmount);
    const max = Number(maxAmount);
    return next.filter((r) => {
      const amt = Number(r.amount ?? r.Amount);
      if (minAmount.trim() && Number.isFinite(min) && Number.isFinite(amt) && amt < min) return false;
      if (maxAmount.trim() && Number.isFinite(max) && Number.isFinite(amt) && amt > max) return false;
      if (checkedFilter !== 'all') {
        const checked = !!(r.checkBy || r.checkedBy);
        if (checkedFilter === 'yes' && !checked) return false;
        if (checkedFilter === 'no' && checked) return false;
      }
      return true;
    });
  }, [isWithdrawal, isUniquePending, payload, list, minAmount, maxAmount, checkedFilter]);

  const totalPages = pickTotalPages(payload);
  const withdrawalTotals = useMemo(() => pickWithdrawalTotals(payload), [payload]);

  const loadRemote = useCallback(async () => {
    if (!isWithdrawal && !isUniquePending) return;
    if (!empCode) {
      setError('Employee code missing for this caller');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isWithdrawal) {
        // Laxmi CallerDepositList: amountGte / amountLte / checked
        const body: Record<string, unknown> = {
          empCode,
          pageNo: page,
          itemPerPage: itemsPerPage,
          startDate,
          endDate,
        };
        if (checkedFilter === 'yes') body.checked = true;
        if (checkedFilter === 'no') body.checked = false;
        if (status) body.status = status;
        const tf = textFiltersRef.current;
        if (tf.name.trim()) body.name = tf.name.trim();
        if (tf.minAmount.trim()) body.amountGte = tf.minAmount.trim();
        if (tf.maxAmount.trim()) body.amountLte = tf.maxAmount.trim();
        const res = await secureApi('caller.withdrawalByEmpcode', body);
        if (!res.ok) {
          setError(res.message || 'Failed to load refunds');
          setPayload({});
          return;
        }
        setPayload(res.data ?? {});
      } else {
        const filter: Record<string, unknown> = {};
        if (mobile.trim()) filter.mobile = mobile.trim();
        if (clientName.trim()) filter.clientName = clientName.trim();
        const res = await secureApi('caller.uniquePendingDeposits', {
          empCode,
          startDate: parentStart || startDate,
          endDate: parentEnd || endDate,
          pageNo: page,
          itemsPerPage,
          filter,
        });
        if (!res.ok) {
          setError(res.message || 'Failed to load unique pending');
          setPayload({});
          return;
        }
        setPayload(res.data ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, [
    empCode,
    isWithdrawal,
    isUniquePending,
    status,
    page,
    itemsPerPage,
    startDate,
    endDate,
    mobile,
    clientName,
    parentStart,
    parentEnd,
    checkedFilter,
  ]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  const columns = useMemo<DataTableColumn<CallerRow>[]>(() => {
    const sr: DataTableColumn<CallerRow> = {
      key: 'sr',
      label: 'SR.No',
      width: 56,
      render: (_r, i) => String(i + 1),
    };
    const nameCol: DataTableColumn<CallerRow> = {
      key: 'name',
      label: 'Name',
      width: 130,
      render: (r) => display(r.userName || r.name),
    };
    const dpCol: DataTableColumn<CallerRow> = {
      key: 'dp',
      label: 'DP ID',
      width: 140,
      render: (r) =>
        display(
          isWithdrawal
            ? r.dp_id || r.Dp_ID || r.userId
            : r.userId || r.dp_id || r.Dp_ID,
        ),
    };
    const appCol: DataTableColumn<CallerRow> = {
      key: 'app',
      label: 'App Code',
      width: 88,
      render: (r) =>
        display(
          appCodeForName(
            r.clientName || r.appName || r.app_name || r.AppName || r.subDomain,
          ),
        ),
    };
    const mobileCol: DataTableColumn<CallerRow> = {
      key: 'mobile',
      label: 'Mobile',
      width: 120,
      render: (r) =>
        maskMobile(
          isWithdrawal ? r.mobile || r.userMobile : r.userMobile || r.mobile,
          canShowMobile,
        ),
    };
    const createdCol: DataTableColumn<CallerRow> = {
      key: 'created',
      label: 'Created At',
      width: 120,
      render: (r) =>
        formatDisplayDate(r.createdOn || r.createdAt || r.created_at) ||
        display(r.createdOn || r.createdAt),
    };
    const amountCol: DataTableColumn<CallerRow> = {
      key: 'amount',
      label: 'Amount',
      width: 100,
      align: 'right',
      render: (r) => formatAmount(r.amount || r.Amount),
    };
    const orderCol: DataTableColumn<CallerRow> = {
      key: 'order',
      label: 'Order ID',
      width: 120,
      render: (r) => display(r.orderId || r.order_id),
    };
    const statusCol: DataTableColumn<CallerRow> = {
      key: 'status',
      label: 'Status',
      width: 100,
      render: (r) => display(r.status),
    };
    const ptypeCol: DataTableColumn<CallerRow> = {
      key: 'ptype',
      label: 'Payment Type',
      width: 110,
      render: (r) => display(r.paymentType || r.type),
    };

    if (isWithdrawal) {
      const cols: DataTableColumn<CallerRow>[] = [sr, nameCol, dpCol, appCol];
      if (!isCaller) {
        cols.push(
          { key: 'ubank', label: 'User Bank', width: 120, render: (r) => display(r.userBankName) },
          {
            key: 'acc',
            label: 'Account No',
            width: 120,
            render: (r) => display(r.accountNo || r.accountNumber),
          },
          { key: 'bank', label: 'Bank Name', width: 120, render: (r) => display(r.bankName) },
        );
      }
      cols.push(
        { key: 'bonus', label: 'Bonus Laps', width: 100, align: 'right', render: (r) => formatAmount(r.bonusLaps) },
        {
          key: 'comm',
          label: 'Commission',
          width: 110,
          align: 'right',
          render: (r) => formatAmount(r.commissionAmount),
        },
      );
      if (!isCaller) {
        cols.push(
          {
            key: 'check',
            label: 'Check By',
            width: 160,
            render: (r) => formatCheckBy(r.checkBy ?? r.checkedBy),
          },
          {
            key: 'cross',
            label: 'Cross Check By',
            width: 160,
            render: (r) => formatCheckBy(r.crossCheckBy ?? r.crossCheckedBy),
          },
          mobileCol,
        );
      }
      cols.push(createdCol, amountCol);
      if (!isCaller) cols.push(orderCol);
      cols.push(statusCol);
      return cols;
    }

    // Deposit + Unique Pending share most detail columns.
    const cols: DataTableColumn<CallerRow>[] = [sr, nameCol, dpCol, appCol];
    if (!isCaller) cols.push(mobileCol);
    cols.push(createdCol, amountCol);
    if (!isCaller) {
      cols.push(orderCol, {
        key: 'gateway',
        label: 'Payment Gateway',
        width: 140,
        render: (r) => display(r.paymentGatewayName || r.gateway),
      });
    }
    if (!(isCaller && isUniquePending)) cols.push(ptypeCol);
    if (isUniquePending) {
      cols.push(
        { key: 'state', label: 'State', width: 100, render: (r) => display(r.state || r.userState) },
        { key: 'city', label: 'City', width: 100, render: (r) => display(r.city || r.userCity) },
        { key: 'emp', label: 'Emp Code', width: 100, render: (r) => display(r.empCode) },
      );
      if (!isCaller) {
        cols.push({ key: 'mid', label: 'Mid', width: 100, render: (r) => display(r.mid) });
      }
    }
    cols.push(statusCol);
    if (isUniquePending) {
      cols.push({
        key: 'call',
        label: 'Call',
        width: 72,
        render: () => 'Call',
        onCellPress: (r) => addToDialer(r),
      });
    }
    return cols;
  }, [isWithdrawal, isUniquePending, isCaller, canShowMobile, addToDialer]);

  /** Compact table columns — full set stays in the row detail sheet. */
  const mainColumns = useMemo<DataTableColumn<CallerRow>[]>(() => {
    if (isWithdrawal) {
      return columns.filter((c) =>
        ['sr', 'name', 'dp', 'app', 'amount', 'status'].includes(c.key),
      );
    }
    if (isUniquePending) {
      return columns.filter((c) =>
        ['sr', 'name', 'amount', 'status', 'call'].includes(c.key),
      );
    }
    return columns.filter((c) =>
      ['sr', 'name', 'amount', 'status'].includes(c.key),
    );
  }, [columns, isWithdrawal, isUniquePending]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return columns
      .filter((c) => c.key !== 'call')
      .map((c) => ({
        label: c.label,
        value: c.render(selected.row, selected.index),
      }));
  }, [columns, selected]);

  const sheetActions = useMemo<SheetAction[] | undefined>(() => {
    if (!selected || !isUniquePending) return undefined;
    const hasMobile = Boolean(selected.row.userMobile || selected.row.mobile);
    return [
      {
        label: calling ? 'Calling…' : 'Call',
        tone: 'primary',
        disabled: !hasMobile || calling,
        onPress: () => addToDialer(selected.row),
      },
    ];
  }, [selected, isUniquePending, addToDialer, calling]);

  if (!list && !empCode) {
    return (
      <View style={styles.emptyWrap}>
        <TouchableOpacity style={styles.backRow} onPress={goBack} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>No caller selected.</Text>
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
          onRefresh={() => void loadRemote()}
          tintColor={colors.primary}
        />
      }
    >
      <TouchableOpacity style={styles.backRow} onPress={goBack} accessibilityLabel="Go back">
        <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>
        {title}
        {callerLabel ? ` — ${callerLabel}` : ''}
      </Text>

      {isWithdrawal ? (
        <>
          <DetailFilterBar
            startDate={draftStart}
            endDate={draftEnd}
            loading={loading}
            onStartDateChange={setDraftStart}
            onEndDateChange={setDraftEnd}
            pageSize={itemsPerPage}
            onPageSizeChange={(n) => {
              setItemsPerPage(n);
              setPage(1);
            }}
            onApply={() => {
              setStartDate(draftStart);
              setEndDate(draftEnd);
              setPage(1);
              void loadRemote();
            }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusChipScroll}>
            <View style={styles.chipRow}>
              <Text style={styles.chipLabel}>Status</Text>
              {STATUS_CHIPS.map((s) => (
                <TouchableOpacity
                  key={s || 'all'}
                  style={[styles.chip, status === s && styles.chipActive]}
                  onPress={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                    {s || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              <Text style={styles.chipLabel}>Is Checked</Text>
              {CHECKED_CHIPS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.chip, checkedFilter === c.value && styles.chipActive]}
                  onPress={() => {
                    setCheckedFilter(c.value);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.chipText, checkedFilter === c.value && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={minAmount}
              onChangeText={(t) => setMinAmount(t.replace(/[^\d.]/g, ''))}
              placeholder="Min amount"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={maxAmount}
              onChangeText={(t) => setMaxAmount(t.replace(/[^\d.]/g, ''))}
              placeholder="Max amount"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
          </View>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Filter by name"
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setPage(1);
              void loadRemote();
            }}
            disabled={loading}
          >
            <Text style={styles.applyBtnText}>{loading ? 'Loading…' : 'Apply'}</Text>
          </TouchableOpacity>
          <View style={styles.totalsCard}>
            <Text style={styles.totalLine}>
              Total User ({withdrawalTotals.all.count ?? 0}):{' '}
              {formatAmount(withdrawalTotals.all.amount)}
            </Text>
            <Text style={styles.totalLine}>
              Approved ({withdrawalTotals.approved.count ?? 0}):{' '}
              {formatAmount(withdrawalTotals.approved.amount)}
            </Text>
            <Text style={styles.totalLine}>
              Canceled ({withdrawalTotals.cancel.count ?? 0}):{' '}
              {formatAmount(withdrawalTotals.cancel.amount)}
            </Text>
            <Text style={styles.totalLine}>
              Pending ({withdrawalTotals.pending.count ?? 0}):{' '}
              {formatAmount(withdrawalTotals.pending.amount)}
            </Text>
          </View>
        </>
      ) : null}

      {isUniquePending ? (
        <>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="Filter by mobile"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              <Text style={styles.chipLabel}>App</Text>
              <TouchableOpacity
                style={[styles.chip, clientName === '' && styles.chipActive]}
                onPress={() => {
                  setClientName('');
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, clientName === '' && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {appOptions.map((app) => (
                <TouchableOpacity
                  key={app}
                  style={[styles.chip, clientName === app && styles.chipActive]}
                  onPress={() => {
                    setClientName(app);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.chipText, clientName === app && styles.chipTextActive]}>
                    {appCodeForName(app) || app}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setPage(1);
              void loadRemote();
            }}
            disabled={loading}
          >
            <Text style={styles.applyBtnText}>{loading ? 'Loading…' : 'Apply'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <DataTable
          columns={mainColumns}
          rows={rows}
          keyFor={(r, i) => String(r._id || r.orderId || i)}
          emptyMessage="No records"
          onRowPress={(row, index) => setSelected({ row, index })}
          hint="Tap a row for full details"
        />
      )}

      {(isWithdrawal || isUniquePending) && totalPages > 1 ? (
        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>
            {page} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
            disabled={page >= totalPages || loading}
            onPress={() => setPage((p) => p + 1)}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.row.userName || selected.row.name || 'Details') : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  emptyWrap: { flex: 1, padding: spacing(4) },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    alignSelf: 'flex-start',
    marginBottom: spacing(2),
    paddingVertical: spacing(1),
  },
  backText: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: spacing(3) },
  muted: { color: colors.muted, fontSize: 13 },
  chipScroll: { marginBottom: spacing(2) },
  statusChipScroll: { marginTop: spacing(3), marginBottom: spacing(2) },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    marginBottom: spacing(2),
  },
  amountRow: { flexDirection: 'row', gap: spacing(2) },
  amountInput: { flex: 1 },
  applyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(3),
  },
  applyBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  totalsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1),
    marginBottom: spacing(3),
  },
  totalLine: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingBox: { paddingVertical: spacing(10), alignItems: 'center' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    marginTop: spacing(3),
  },
  pageBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
  pageLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
