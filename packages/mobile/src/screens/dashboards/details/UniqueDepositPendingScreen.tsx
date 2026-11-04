/**
 * Unique Deposit Pending — dual-summary admin-panel/desktop parity port of
 * desktop's UniqueDepositPendingPage. Loads uniquePending.amountSummary +
 * uniquePending.amountAllSummary in parallel, assembles the full row/bucket/
 * gateway/region/byState view via @astro/shared's assembleUniquePendingSummary,
 * then filters (gateway/region, client-only) + paginates for display.
 *
 * Silently polls every UNIQUE_PENDING_POLL_MS via a ref so the interval never
 * flips `loading` or closes the open detail sheet.
 *
 * Row tap opens the detail sheet with:
 *   - Comment: add a note (uniquePending.message) when the row has none yet,
 *   - WhatsApp: open a state-aware WhatsApp message to the user (whatsapp_icon),
 *   - Change Status: submit a remark (uniquePending.statusChange) (change_status),
 *   - C2C Call / User Report.
 * The header "Download Data" runs the OTP flow (users.sendBlockOtp /
 * users.verifyBlockOtp + reports.sheetDownloadAuditCreate) gated by
 * show_download_botton, then exports the full filtered display list (not just
 * the current page) via the share sheet.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  appCodeForName,
  assembleUniquePendingSummary,
  buildDepositWhatsAppMessage,
  buildUniquePendingSummaryPayload,
  filterUniquePendingDisplay,
  paginateUniquePendingRows,
  parseDistinctMidOptions,
  sanitizeGtelPhone,
  uniquePendingPaymentMethod,
  uniquePendingStatusColor,
  UNIQUE_PENDING_POLL_MS,
  type UniquePendingBucket,
  type UniquePendingByStateRow,
  type UniquePendingRegion,
  type UniquePendingRow,
} from '@astro/shared';
import { colors } from '../../../theme';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import {
  canShowUniqueDepositEmpCode,
  getSessionUser,
  hasPermission,
  Permissions,
} from '../../../auth/permissions';
import {
  canShowGtelC2c,
  GtelClick2CallModal,
  type GtelC2cTarget,
} from '../../../components/GtelClick2CallModal';
import { GtelC2cCallButton } from '../../../components/GtelC2cCallButton';
import { SheetDownloadOtpModal } from '../../../components/SheetDownloadOtpModal';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display, maskMobile } from '../../../utils/display';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../../utils/empCodeNameCache';
import { shareCsvFile } from '../../../utils/shareCsv';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './UniqueDepositPendingScreen.styles';

function rowMobile(row: UniquePendingRow): string {
  return String(row.userMobile || row.mobile || '').trim();
}

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  return lines.join('\r\n');
}

/** One filter field editable via the shared DetailFilterBar search box; `empCode` is client-only. */
type ColumnFilters = {
  userId: string;
  amount: string;
  city: string;
  state: string;
  empCode: string;
};

const EMPTY_FILTERS: ColumnFilters = { userId: '', amount: '', city: '', state: '', empCode: '' };

/** Shared pill look for region / gateway / MID toggles. */
function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Compact Total / Pending / Approved card — Req · Amt · Cust. */
function SummaryCard({
  label,
  bucket,
  accent,
}: {
  label: string;
  bucket: UniquePendingBucket;
  accent: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryCardAccent, { backgroundColor: accent }]} />
      <Text style={[styles.summaryCardLabel, { color: accent }]}>{label.toUpperCase()}</Text>
      <View style={styles.summaryStatsRow}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Req</Text>
          <Text style={styles.summaryStatValue}>{bucket.uniqueRequestCount}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Amt</Text>
          <Text style={styles.summaryStatValue}>{formatIN(bucket.totalAmount)}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Cust</Text>
          <Text style={styles.summaryStatValue}>{bucket.uniqueCustomerCount}</Text>
        </View>
      </View>
    </View>
  );
}

/** One row inside the "By State" modal — Total / Pending / Approved groups. */
function ByStateRow({
  row,
  active,
  onPress,
}: {
  row: UniquePendingByStateRow;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.byStateRow, active && styles.byStateRowActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.byStateRowTitle, active && styles.byStateRowTitleActive]}>
        {row.state}
      </Text>
      <View style={styles.byStateGroupsRow}>
        <View style={styles.byStateGroup}>
          <Text style={[styles.byStateGroupLabel, { color: '#60a5fa' }]}>Total</Text>
          <Text style={styles.byStateGroupValue}>
            {row.allUniqueRequestCount} · {formatIN(row.allTotalAmount)} ·{' '}
            {row.allUniqueCustomerCount}
          </Text>
        </View>
        <View style={styles.byStateGroup}>
          <Text style={[styles.byStateGroupLabel, { color: colors.primary }]}>Pending</Text>
          <Text style={styles.byStateGroupValue}>
            {row.uniqueRequestCount} · {formatIN(row.totalAmount)} · {row.uniqueCustomerCount}
          </Text>
        </View>
        <View style={styles.byStateGroup}>
          <Text style={[styles.byStateGroupLabel, { color: colors.success }]}>Approved</Text>
          <Text style={styles.byStateGroupValue}>
            {row.approvedTxnCount} · {formatIN(row.approvedTotalAmount)} ·{' '}
            {row.approvedCustomerCount}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function UniqueDepositPendingScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const insets = useSafeAreaInsets();
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(
    () =>
      getSessionUser() as {
        _id?: string;
        name?: string;
        mobile?: string;
        accessibleStates?: string[];
      } | null,
    [],
  );
  const canChangeStatus = hasPermission('change_status');
  const canDownload = hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canShowMobile = hasPermission('show_mobile');
  const canShowEmpCode = canShowUniqueDepositEmpCode(admin);
  const canCallerWise = hasPermission(Permissions.show_caller_wise_unique_pending);
  const canShowC2c = canShowGtelC2c(admin);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  const openC2cCall = useCallback((row: UniquePendingRow) => {
    const mobile = rowMobile(row);
    if (!sanitizeGtelPhone(mobile)) return;
    setC2cTarget({
      phoneNumber: mobile,
      userId: String(row.userId || row._id || ''),
      userName: String(row.userName || ''),
      appName: String(row.clientName || ''),
      source: 'Manual',
    });
  }, []);

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [clientName, setClientName] = useState('');
  const [midOptions, setMidOptions] = useState<string[]>([]);
  const [midFilter, setMidFilter] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [searchField, setSearchField] = useState<keyof ColumnFilters>('userId');
  const [appliedFilters, setAppliedFilters] = useState<ColumnFilters>(EMPTY_FILTERS);

  const [gatewayFilter, setGatewayFilter] = useState('');
  const [region, setRegion] = useState<UniquePendingRegion>('');
  const [byStateOpen, setByStateOpen] = useState(false);

  const [pendingSummaryData, setPendingSummaryData] = useState<unknown>(null);
  const [allSummaryData, setAllSummaryData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<UniquePendingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const genRef = useRef(0);

  // Remark/comment input modal.
  const [inputOpen, setInputOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'comment' | 'status'>('comment');
  const [inputRow, setInputRow] = useState<UniquePendingRow | null>(null);
  const [inputText, setInputText] = useState('');

  // OTP download modal.
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    if (!canShowEmpCode) return;
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, [canShowEmpCode]);

  // Load distinct MIDs once (client-side select options for the MID filter).
  useEffect(() => {
    let active = true;
    void secureApi<unknown>('uniquePending.mids', {}).then((res) => {
      if (!active || !res.ok) return;
      setMidOptions(parseDistinctMidOptions(res.data));
    });
    return () => {
      active = false;
    };
  }, []);

  const searchFields = useMemo(
    () => [
      { key: 'userId', label: 'DP Id' },
      { key: 'amount', label: 'Amount' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      ...(canShowEmpCode ? [{ key: 'empCode', label: 'Emp Code' }] : []),
    ],
    [canShowEmpCode],
  );

  const formatEmpCode = useCallback(
    (row: UniquePendingRow) => {
      const code = String(row.empCode || '').trim();
      const name = code ? empCodeNameMap[code] : '';
      return name ? `${code || '—'} (${name})` : display(row.empCode);
    },
    [empCodeNameMap],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      const gen = ++genRef.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const payload = buildUniquePendingSummaryPayload(
          startDate,
          endDate,
          {
            userId: appliedFilters.userId,
            amount: appliedFilters.amount,
            city: appliedFilters.city,
            state: appliedFilters.state,
            clientName,
            mid: midFilter,
          },
          todayIST(),
        );
        const [pendingRes, allRes] = await Promise.all([
          secureApi<unknown>('uniquePending.amountSummary', payload),
          secureApi<unknown>('uniquePending.amountAllSummary', payload),
        ]);
        if (gen !== genRef.current) return;
        if (!pendingRes.ok) {
          if (!silent) setError(pendingRes.message || 'Failed to load unique pending deposits');
          return;
        }
        if (!allRes.ok) {
          if (!silent) setError(allRes.message || 'Failed to load unique pending deposits');
          return;
        }
        if (!silent) setSheetRow(null);
        setPendingSummaryData(pendingRes.data);
        setAllSummaryData(allRes.data);
      } finally {
        if (gen === genRef.current && !silent) setLoading(false);
      }
    },
    [startDate, endDate, clientName, midFilter, appliedFilters],
  );

  /** Keep a ref to the latest load() so the silent poll interval never closes over stale state. */
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setPage(1);
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadRef.current({ silent: true });
    }, UNIQUE_PENDING_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(
    () =>
      assembleUniquePendingSummary({
        pendingData: pendingSummaryData,
        allData: allSummaryData,
        accessibleStates: admin?.accessibleStates,
        empCode: canShowEmpCode ? appliedFilters.empCode : '',
      }),
    [
      pendingSummaryData,
      allSummaryData,
      admin?.accessibleStates,
      canShowEmpCode,
      appliedFilters.empCode,
    ],
  );

  const displayRows = useMemo(
    () => filterUniquePendingDisplay(summary.rows, { gatewayName: gatewayFilter, region }),
    [summary.rows, gatewayFilter, region],
  );

  const { pageRows, totalPages, total, safePage } = useMemo(
    () => paginateUniquePendingRows(displayRows, page, pageSize),
    [displayRows, page, pageSize],
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  }, [draftStart, draftEnd]);

  const search = useCallback(() => {
    setAppliedFilters((prev) => ({ ...prev, [searchField]: draftSearch }));
    setPage(1);
  }, [searchField, draftSearch]);

  const toggleMid = useCallback((name: string) => {
    setMidFilter((prev) => (prev === name ? '' : name));
    setPage(1);
  }, []);

  const toggleGateway = useCallback((name: string) => {
    setGatewayFilter((prev) => (prev === name ? '' : name));
    setPage(1);
  }, []);

  const clearGateway = useCallback(() => {
    setGatewayFilter('');
    setPage(1);
  }, []);

  /** Region is a broader client filter than a single state — clear any active state filter. */
  const toggleRegion = useCallback((next: UniquePendingRegion) => {
    setRegion((prev) => (prev === next ? '' : next));
    setAppliedFilters((prev) => (prev.state ? { ...prev, state: '' } : prev));
    setPage(1);
  }, []);

  /** Tapping a state in the "By State" modal applies/toggles the server state filter. */
  const applyStateFilter = useCallback((state: string) => {
    setAppliedFilters((prev) => ({
      ...prev,
      state: prev.state.trim().toLowerCase() === state.trim().toLowerCase() ? '' : state,
    }));
    setByStateOpen(false);
    setPage(1);
  }, []);

  const isActiveState = useCallback(
    (state: string) => {
      const active = appliedFilters.state.trim();
      return Boolean(active) && active.toLowerCase() === state.trim().toLowerCase();
    },
    [appliedFilters.state],
  );

  const openInput = useCallback((mode: 'comment' | 'status', row: UniquePendingRow) => {
    if (!row.orderId) {
      setError('Missing order id');
      return;
    }
    setInputMode(mode);
    setInputRow(row);
    setInputText('');
    setSheetRow(null);
    setInputOpen(true);
  }, []);

  const submitInput = useCallback(async () => {
    const row = inputRow;
    const reason = inputText.trim();
    if (!row?.orderId) return;
    if (!reason) {
      Alert.alert(inputMode === 'comment' ? 'Enter a comment' : 'Remark is required');
      return;
    }
    setBusy(true);
    try {
      const action =
        inputMode === 'comment' ? 'uniquePending.message' : 'uniquePending.statusChange';
      const res = await secureApi<unknown>(action, {
        orderId: row.orderId,
        uniquePendingReason: {
          name: admin?.name || '',
          _id: admin?._id || '',
          reason,
        },
      });
      if (!res.ok) {
        setError(res.message || 'Request failed');
        return;
      }
      setInputOpen(false);
      setInputRow(null);
      setInputText('');
      void load();
    } finally {
      setBusy(false);
    }
  }, [inputRow, inputText, inputMode, admin, load]);

  const openWhatsApp = useCallback((row: UniquePendingRow) => {
    const rawMobile = row.userMobile || row.mobile;
    if (!rawMobile) {
      Alert.alert('No mobile number for this user');
      return;
    }
    let formatted = String(rawMobile).replace(/\D/g, '');
    if (formatted.length === 10) formatted = `91${formatted}`;
    const encoded = encodeURIComponent(buildDepositWhatsAppMessage(row));
    const appUrl = `whatsapp://send?phone=${formatted}&text=${encoded}`;
    const webUrl = `https://wa.me/${formatted}?text=${encoded}`;
    void Linking.openURL(appUrl).catch(() => {
      void Linking.openURL(webUrl).catch(() => Alert.alert('Unable to open WhatsApp'));
    });
  }, []);

  const downloadCsv = useCallback(async () => {
    if (!displayRows.length) {
      Alert.alert('No data to export');
      return false;
    }
    const exportRows = displayRows.map((row) => ({
      UserName: row.userName || '',
      AppCode: appCodeForName(row.clientName),
      DPId: row.userId || '',
      Mobile: row.userMobile || row.mobile || '',
      Amount: row.amount ?? '',
      State: row.userState || row.state || '',
      City: row.userCity || row.city || '',
      TransactionId: row.orderId || row.transactionId || '',
      PaymentMethod: uniquePendingPaymentMethod(row.paymentGatewayName, row.mid),
      Date: formatDisplayDate(row.createdOn) || '',
      Time: formatDisplayTime(row.createdOn) || '',
      Status: row.status || '',
      Comment: row.uniquePendingReason?.reason || '',
      ...(canShowEmpCode ? { EmpCode: row.empCode || '' } : {}),
    }));
    return shareCsvFile(`unique_pending_data_${Date.now()}.csv`, toCsv(exportRows));
  }, [displayRows, canShowEmpCode]);

  const openUserReport = useCallback(
    (row: UniquePendingRow) => {
      if (!row.userId) return;
      setSheetRow(null);
      navigation.navigate('/user-report', {
        userId: String(row.userId),
        userName: String(row.userName || ''),
      });
    },
    [navigation],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'User Name', value: display(sheetRow.userName) },
      { label: 'Mobile No', value: maskMobile(rowMobile(sheetRow), canShowMobile) },
      { label: 'App Code', value: appCodeForName(sheetRow.clientName) },
      { label: 'DP ID', value: display(sheetRow.userId) },
      ...(canShowEmpCode ? [{ label: 'Emp Code', value: formatEmpCode(sheetRow) }] : []),
      { label: 'Amount', value: formatIN(sheetRow.amount) },
      { label: 'State', value: display(sheetRow.userState || sheetRow.state) },
      { label: 'City', value: display(sheetRow.userCity || sheetRow.city) },
      {
        label: 'Transaction Id',
        value: display(sheetRow.orderId || sheetRow.transactionId),
        multiline: true,
      },
      {
        label: 'Payment Method',
        value: uniquePendingPaymentMethod(sheetRow.paymentGatewayName, sheetRow.mid),
      },
      { label: 'Date', value: formatDisplayDate(sheetRow.createdOn) || '—' },
      { label: 'Time', value: formatDisplayTime(sheetRow.createdOn) || '—' },
      {
        label: 'Status',
        value: display(sheetRow.status),
        badgeColor: uniquePendingStatusColor(sheetRow.status),
      },
      {
        label: 'Comment',
        value: display(sheetRow.uniquePendingReason?.reason),
        multiline: true,
      },
    ];
  }, [sheetRow, canShowMobile, canShowEmpCode, formatEmpCode]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const acts: SheetAction[] = [];
    if (canShowC2c && sanitizeGtelPhone(rowMobile(sheetRow))) {
      acts.push({
        label: 'C2C Call',
        tone: 'primary',
        onPress: () => {
          const row = sheetRow;
          setSheetRow(null);
          openC2cCall(row);
        },
      });
    }
    if (sheetRow.userId) {
      acts.push({
        label: 'User Report',
        tone: 'primary',
        onPress: () => openUserReport(sheetRow),
      });
    }
    const isPending = String(sheetRow.status || '').toLowerCase() === 'pending';
    if (!sheetRow.uniquePendingReason?.reason) {
      acts.push({
        label: 'Add Comment',
        tone: 'default',
        onPress: () => openInput('comment', sheetRow),
      });
    }
    if (canWhatsApp && isPending) {
      acts.push({ label: 'WhatsApp', tone: 'primary', onPress: () => openWhatsApp(sheetRow) });
    }
    if (canChangeStatus) {
      acts.push({
        label: 'Change Status',
        tone: 'warning',
        onPress: () => openInput('status', sheetRow),
      });
    }
    return acts;
  }, [
    sheetRow,
    canShowC2c,
    canWhatsApp,
    canChangeStatus,
    busy,
    openInput,
    openWhatsApp,
    openUserReport,
    openC2cCall,
  ]);

  const keyExtractor = useCallback(
    (row: UniquePendingRow, index: number) =>
      `row-${index}-${String(row._id || row.orderId || '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<UniquePendingRow>) => (
      <UniquePendingCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={canShowMobile}
        canShowC2c={canShowC2c}
        canShowEmpCode={canShowEmpCode}
        empCodeLabel={canShowEmpCode ? formatEmpCode(row) : ''}
        onOpenSheet={() => setSheetRow(row)}
        onOpenReport={() => openUserReport(row)}
        onC2cCall={() => openC2cCall(row)}
      />
    ),
    [page, pageSize, canShowMobile, canShowC2c, canShowEmpCode, formatEmpCode, openUserReport, openC2cCall],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Unique Deposit Pending User</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total: {total.toLocaleString('en-IN')}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={applyDates}
        appClientName={clientName}
        onAppChange={(v) => {
          setClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={searchFields}
        searchField={searchField}
        onSearchFieldChange={(v) => setSearchField(v as keyof ColumnFilters)}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      >
        {midOptions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.midScrollContent}
          >
            <Text style={styles.rowLabel}>MID</Text>
            <FilterChip label="All" active={!midFilter} onPress={() => setMidFilter('')} />
            {midOptions.map((m) => (
              <FilterChip key={m} label={m} active={midFilter === m} onPress={() => toggleMid(m)} />
            ))}
          </ScrollView>
        ) : null}
      </DetailFilterBar>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryScroll}
        contentContainerStyle={styles.summaryScrollContent}
      >
        <SummaryCard label="Total" bucket={summary.all} accent="#60a5fa" />
        <SummaryCard label="Pending" bucket={summary.pending} accent={colors.primary} />
        <SummaryCard label="Approved" bucket={summary.approved} accent={colors.success} />
      </ScrollView>

      <View style={styles.regionRow}>
        <FilterChip
          label={`South (${summary.regionCounts.south})`}
          active={region === 'south'}
          onPress={() => toggleRegion('south')}
        />
        <FilterChip
          label={`North (${summary.regionCounts.north})`}
          active={region === 'north'}
          onPress={() => toggleRegion('north')}
        />
      </View>

      {summary.gatewayCounts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gatewayScroll}
          contentContainerStyle={styles.gatewayScrollContent}
        >
          {summary.gatewayCounts.map((g) => (
            <FilterChip
              key={g.name}
              label={`${g.name} (${g.count})`}
              active={gatewayFilter === g.name}
              onPress={() => toggleGateway(g.name)}
            />
          ))}
          {gatewayFilter ? (
            <TouchableOpacity style={styles.clearChip} onPress={clearGateway}>
              <Text style={styles.clearChipText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.utilityRow}>
        <TouchableOpacity style={styles.byStateBtn} onPress={() => setByStateOpen(true)}>
          <Text style={styles.byStateBtnText}>By State</Text>
        </TouchableOpacity>
        {canCallerWise ? (
          <TouchableOpacity
            style={styles.byStateBtn}
            onPress={() =>
              navigation.navigate('/unique_deposit_pending/caller-wise', {
                startDate,
                endDate,
              })
            }
          >
            <Text style={styles.byStateBtnText}>Caller Wise Deposit Pending</Text>
          </TouchableOpacity>
        ) : null}
        {canDownload ? (
          <TouchableOpacity style={styles.downloadChip} onPress={() => setDownloadOpen(true)}>
            <Text style={styles.downloadChipText}>⬇ Download Data</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  const listFooter = (
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
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={pageRows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No unique pending deposits found"
        refreshing={loading}
        onRefresh={() => {
          void load();
        }}
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.userName) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <GtelClick2CallModal
        target={c2cTarget}
        onClose={() => setC2cTarget(null)}
        canShowMobile={!!canShowMobile}
      />

      {/* "By State" — state rows with Total / Pending / Approved groups. */}
      <Modal
        visible={byStateOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setByStateOpen(false)}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => setByStateOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.byStateModalSheet}>
            <View style={styles.byStateModalHeader}>
              <Text style={styles.byStateModalTitle}>By State</Text>
              <TouchableOpacity
                onPress={() => setByStateOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.byStateScroll}
              contentContainerStyle={[
                styles.byStateList,
                { paddingBottom: Math.max(48, insets.bottom + 24) },
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {summary.byState.length === 0 ? (
                <Text style={styles.byStateEmpty}>No state-wise data</Text>
              ) : (
                summary.byState.map((row) => (
                  <ByStateRow
                    key={row.state}
                    row={row}
                    active={isActiveState(row.state)}
                    onPress={() => applyStateFilter(row.state)}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comment / Change-status input modal */}
      <Modal
        visible={inputOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInputOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setInputOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {inputMode === 'comment' ? 'Add Comment' : 'Change Status'}
              </Text>
              <TouchableOpacity
                onPress={() => setInputOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>{inputMode === 'comment' ? 'Comment' : 'Remark'}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={inputMode === 'comment' ? 'Enter comment' : 'Enter remark'}
              placeholderTextColor={colors.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void submitInput()}
            >
              <Text style={styles.submitBtnText}>{busy ? 'Submitting…' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SheetDownloadOtpModal
        visible={downloadOpen}
        filter={{ mid: 'All', type: 'Unique Pending Deposit' }}
        onClose={() => setDownloadOpen(false)}
        onVerified={() => downloadCsv()}
      />
    </>
  );
}

type UniquePendingCardProps = {
  row: UniquePendingRow;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  canShowC2c: boolean;
  canShowEmpCode: boolean;
  empCodeLabel: string;
  onOpenSheet: () => void;
  onOpenReport: () => void;
  onC2cCall: () => void;
};

const UniquePendingCard = memo(function UniquePendingCard({
  row,
  index,
  page,
  pageSize,
  canShowMobile,
  canShowC2c,
  canShowEmpCode,
  empCodeLabel,
  onOpenSheet,
  onOpenReport,
  onC2cCall,
}: UniquePendingCardProps) {
  const badge = uniquePendingStatusColor(row.status);
  return (
    <TouchableOpacity style={[styles.card, styles.cardSpaced]} activeOpacity={0.75} onPress={onOpenSheet}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.userName)}
        </Text>
        {row.userId ? (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={onOpenReport}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.reportBtnText}>User Report</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Mobile</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.cardValue} numberOfLines={1}>
            {maskMobile(rowMobile(row), canShowMobile)}
          </Text>
          {canShowC2c && sanitizeGtelPhone(rowMobile(row)) ? (
            <View style={{ marginTop: 6 }}>
              <GtelC2cCallButton onPress={onC2cCall} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Amount</Text>
        <Text style={styles.cardValue}>{formatIN(row.amount)}</Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          App Code: {appCodeForName(row.clientName)}
        </Text>
        <Text style={[styles.cardSplitRight, badge ? { color: badge } : null]} numberOfLines={1}>
          Status: {display(row.status)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>DP ID</Text>
        <Text style={styles.cardValue} numberOfLines={1}>
          {display(row.userId)}
        </Text>
      </View>
      {canShowEmpCode ? (
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Emp Code</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {empCodeLabel}
          </Text>
        </View>
      ) : null}
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Date</Text>
        <Text style={styles.cardValue}>
          {[formatDisplayDate(row.createdOn), formatDisplayTime(row.createdOn)]
            .filter(Boolean)
            .join(' ') || '—'}
        </Text>
      </View>
      <Text style={styles.cardHint}>Tap card for details & actions</Text>
    </TouchableOpacity>
  );
});
