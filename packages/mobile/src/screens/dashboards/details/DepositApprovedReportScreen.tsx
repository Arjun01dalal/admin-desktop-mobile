/**
 * Deposit Approved Report — port of desktop DepositApprovedReportPage
 * (/DepositApprovedReport). Payment-type selector (Automatic / Scanner data);
 * Automatic paginates depositApproved.transactions (status Approved), Scanner
 * loads depositApproved.scannerData. Date filter, app-code chips, gateway chips
 * and per-column search (userName, DP ID, amount, state, city, account, aadhaar,
 * txn id, payment method). The gateway selection drives the "Total Approved Sum"
 * chip (depositApproved.approvedSum). Row tap opens the full detail sheet.
 *
 * Skipped: desktop's "Download ExcelData" (browser file download) — not ported.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { pickPageSizes, appCodeForName, asList, asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar, type SearchFieldOption } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { SheetDownloadOtpModal } from '../../../components/SheetDownloadOtpModal';
import { shareCsvFile } from '../../../utils/shareCsv';

type RequestType = 'automaticDeposit' | 'scannerDeposit';

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'userName', label: 'User Name' },
  { key: 'userId', label: 'DP ID' },
  { key: 'amount', label: 'Amount' },
  { key: 'userState', label: 'State' },
  { key: 'userCity', label: 'City' },
  { key: 'accountNumber', label: 'Acc No' },
  { key: 'aadhaarNumber', label: 'Aadhar No' },
  { key: 'orderId', label: 'Txn ID' },
  { key: 'paymentGatewayName', label: 'Payment Method' },
];

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

type DepositRow = {
  _id: string;
  userId?: string;
  userName?: string;
  clientName?: string;
  amount?: number | string;
  userState?: string;
  userCity?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  orderId?: string;
  paymentGatewayName?: string;
  mid?: string | number;
  createdOn?: string;
  status?: string;
  kyc?: boolean;
  reason?: string;
};

type ScannerRow = {
  _id: string;
  userId?: string;
  userName?: string;
  clientName?: string;
  balance?: number | string;
  state?: string;
  city?: string;
  updatedBy?: { name?: string } | string;
  reason?: string;
  mid?: string | number;
  remakr?: string;
  remark?: string;
  utr?: string;
  createdOn?: string;
  updatedOn?: string;
};

type GatewayOption = { _id: string; name?: string; mid?: string | number };

const PAGE_SIZE_OPTIONS = pickPageSizes([25, 50, 100, 200]);

const TYPE_OPTIONS: { key: RequestType; label: string }[] = [
  { key: 'automaticDeposit', label: 'Automatic' },
  { key: 'scannerDeposit', label: 'Scanner data' },
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function paymentMethod(gw: unknown, mid: unknown): string {
  const g = gw === null || gw === undefined || gw === '' ? '' : String(gw);
  const m = mid != null && mid !== '' ? String(mid) : '';
  if (!g && !m) return '—';
  return m ? `${g} - ${m}` : g;
}

export function DepositApprovedReportScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [requestType, setRequestType] = useState<RequestType>('automaticDeposit');
  const [clientName, setClientName] = useState('');
  const [gatewayId, setGatewayId] = useState('');
  const [searchField, setSearchField] = useState<string>('userName');
  const [draftSearch, setDraftSearch] = useState('');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'userName',
    text: '',
  });

  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [scannerRows, setScannerRows] = useState<ScannerRow[]>([]);
  const [approvedSum, setApprovedSum] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositSheet, setDepositSheet] = useState<DepositRow | null>(null);
  const [scannerSheet, setScannerSheet] = useState<ScannerRow | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const genRef = useRef(0);
  const sumGenRef = useRef(0);

  const isScanner = requestType === 'scannerDeposit';

  const downloadExcel = useCallback(async () => {
    const source = isScanner ? scannerRows : rows;
    if (!source.length) {
      Alert.alert('No data to export');
      return false;
    }
    return shareCsvFile(
      `deposit_data_${Date.now()}.csv`,
      toCsv(source as unknown as Record<string, unknown>[]),
    );
  }, [isScanner, scannerRows, rows]);
  const selectedGateway = useMemo(
    () => gateways.find((g) => g._id === gatewayId) || null,
    [gateways, gatewayId],
  );

  const loadGateways = useCallback(async () => {
    const res = await secureApi<unknown>('depositApproved.gatewayNames', {});
    if (!res.ok) return;
    const body = unpackPayload(res.data);
    const list = Array.isArray(res.data)
      ? (res.data as GatewayOption[])
      : Array.isArray(body.items)
        ? (body.items as GatewayOption[])
        : asList<GatewayOption>(res.data);
    setGateways(
      list
        .filter((g) => g && g._id)
        .map((g) => ({ _id: String(g._id), name: g.name, mid: g.mid })),
    );
  }, []);

  const loadAutomatic = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = { status: 'Approved' };
      const text = applied.text.trim();
      if (text && applied.field) {
        // Map search chip → API filter key (desktop column filters parity).
        if (applied.field === 'paymentGatewayName') {
          filter.paymentGatewayName = text;
        } else {
          filter[applied.field] = text;
        }
      }
      if (clientName) filter.clientName = clientName;
      const gateway = gateways.find((g) => g._id === gatewayId);
      if (gateway) {
        // Gateway chip wins over typed payment-method search when both set.
        if (gateway.name) filter.paymentGatewayName = gateway.name;
        if (gateway.mid != null && gateway.mid !== '') filter.mid = gateway.mid;
      }
      const payload: Record<string, unknown> = {
        type: 'deposit',
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      payload.startDate = startDate || todayIST();
      payload.endDate = endDate || todayIST();
      const res = await secureApi<unknown>('depositApproved.transactions', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load deposit approved report');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<DepositRow>(res.data);
      setDepositSheet(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [applied, clientName, gateways, gatewayId, pageSize, page, startDate, endDate]);

  const loadScanner = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const gateway = gateways.find((g) => g._id === gatewayId) || selectedGateway;
      const payload: Record<string, unknown> = {};
      if (gateway?.name) payload.paymentGatewayName = gateway.name;
      if (gateway?.mid != null && gateway.mid !== '') payload.mid = gateway.mid;
      payload.startDate = startDate || todayIST();
      payload.endDate = endDate || todayIST();
      if (clientName) payload.clientName = clientName;
      const res = await secureApi<unknown>('depositApproved.scannerData', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load scanner data');
        setScannerRows([]);
        return;
      }
      const body = unpackPayload(res.data);
      const coinData =
        body.coinData && typeof body.coinData === 'object'
          ? (body.coinData as Record<string, unknown>)
          : body;
      const items = Array.isArray(coinData.items)
        ? (coinData.items as ScannerRow[])
        : asList<ScannerRow>(res.data);
      setScannerSheet(null);
      setScannerRows(items.filter((r) => r && (r._id || r.userId)));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [gateways, gatewayId, selectedGateway, startDate, endDate, clientName]);

  const loadApprovedSum = useCallback(async () => {
    const gen = ++sumGenRef.current;
    const gateway = gateways.find((g) => g._id === gatewayId) || selectedGateway;
    const mid = gateway?.mid;
    if (mid == null || mid === '') {
      setApprovedSum(0);
      return;
    }
    try {
      const start = startDate || todayIST();
      const end = endDate || todayIST();
      const res = await secureApi<unknown>('depositApproved.approvedSum', {
        depositType: requestType,
        mid,
        startDate: start,
        endDate: end,
      });
      if (gen !== sumGenRef.current) return;
      if (!res.ok) {
        setApprovedSum(0);
        return;
      }
      const body = unpackPayload(res.data);
      setApprovedSum(Number(body.totalAmt ?? body.total ?? 0) || 0);
    } catch {
      /* ignore */
    }
  }, [gateways, gatewayId, selectedGateway, startDate, endDate, requestType]);

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    if (isScanner) void loadScanner();
    else void loadAutomatic();
  }, [isScanner, loadScanner, loadAutomatic]);

  useEffect(() => {
    void loadApprovedSum();
  }, [loadApprovedSum]);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  }, [draftStart, draftEnd]);

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [navigation],
  );

  const search = useCallback(() => {
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

  /** Scanner list has no server-side column filters — apply local match. */
  const visibleScannerRows = useMemo(() => {
    const text = applied.text.trim().toLowerCase();
    if (!text) return scannerRows;
    return scannerRows.filter((row) => {
      const hay = [
        row.userName,
        row.userId,
        row.clientName,
        row.state,
        row.city,
        row.reason,
        row.utr,
        row.mid,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      return hay.includes(text);
    });
  }, [scannerRows, applied]);

  // Fit main columns to phone width.
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  const dw = { userName: fit(3.5, 8), amount: fit(2.2, 8), status: fit(2.3, 8) };
  const sw = { userName: fit(3, 8), balance: fit(2, 8), reason: fit(3, 8) };

  const depositColumns = useMemo<DataTableColumn<DepositRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      {
        key: 'userName',
        label: 'User Name',
        width: dw.userName,
        render: (r) => display(r.userName),
        onCellPress: (r) => openUserReport(r.userId, r.userName),
      },
      { key: 'userId', label: 'DP Id', width: 180, render: (r) => display(r.userId) },
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'amount', label: 'Amount', width: dw.amount, align: 'right', render: (r) => formatIN(r.amount) },
      { key: 'userState', label: 'State', width: 130, render: (r) => display(r.userState) },
      { key: 'userCity', label: 'City', width: 120, render: (r) => display(r.userCity) },
      { key: 'bank', label: 'Bank', width: 130, render: (r) => display(r.userBankName) },
      { key: 'account', label: 'Account #', width: 150, render: (r) => display(r.accountNumber) },
      { key: 'aadhaar', label: 'Aadhaar', width: 140, render: (r) => display(r.aadhaarNumber) },
      { key: 'orderId', label: 'Transaction Id', width: 200, render: (r) => display(r.orderId) },
      { key: 'paymentMethod', label: 'Payment Method', width: 180, render: (r) => paymentMethod(r.paymentGatewayName, r.mid) },
      { key: 'date', label: 'Date', width: 110, render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { key: 'time', label: 'Time', width: 100, render: (r) => formatDisplayTime(r.createdOn) || '—' },
      { key: 'status', label: 'Status', width: dw.status, render: (r) => display(r.status) },
      { key: 'kyc', label: 'Kyc', width: 110, render: (r) => (r.kyc === false ? 'Kyc not done' : '—') },
      { key: 'reason', label: 'Rejected Reason', width: 150, render: (r) => display(r.reason) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, availableWidth, openUserReport],
  );

  const scannerColumns = useMemo<DataTableColumn<ScannerRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      {
        key: 'userName',
        label: 'User Name',
        width: sw.userName,
        render: (r) => display(r.userName),
        onCellPress: (r) => openUserReport(r.userId, r.userName),
      },
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'balance', label: 'Balance', width: sw.balance, align: 'right', render: (r) => formatIN(r.balance) },
      { key: 'state', label: 'State', width: 130, render: (r) => display(r.state) },
      { key: 'city', label: 'City', width: 120, render: (r) => display(r.city) },
      {
        key: 'givenBy',
        label: 'Given By',
        width: 150,
        render: (r) => display(typeof r.updatedBy === 'object' ? r.updatedBy?.name : r.updatedBy),
      },
      { key: 'reason', label: 'Reason', width: sw.reason, render: (r) => display(r.reason) },
      { key: 'mid', label: 'Mid', width: 120, render: (r) => display(r.mid) },
      { key: 'remark', label: 'Remark', width: 200, render: (r) => display(r.remark ?? r.remakr) },
      { key: 'userId', label: 'User Id', width: 180, render: (r) => display(r.userId) },
      { key: 'utr', label: 'UTR', width: 160, render: (r) => display(r.utr) },
      { key: 'date', label: 'Date', width: 110, render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { key: 'time', label: 'Time', width: 100, render: (r) => formatDisplayTime(r.createdOn) || '—' },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 180,
        render: (r) => {
          if (!r.updatedOn) return '—';
          const d = formatDisplayDate(r.updatedOn);
          const t = formatDisplayTime(r.updatedOn);
          return d && t ? `${d} | ${t}` : d || t || '—';
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth, openUserReport],
  );

  const depositSheetFields = useMemo<SheetField[]>(() => {
    if (!depositSheet) return [];
    return depositColumns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(depositSheet, 0),
        multiline: c.key === 'orderId' || c.key === 'reason',
      }));
  }, [depositSheet, depositColumns]);

  const scannerSheetFields = useMemo<SheetField[]>(() => {
    if (!scannerSheet) return [];
    return scannerColumns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(scannerSheet, 0),
        multiline: c.key === 'remark' || c.key === 'reason' || c.key === 'utr',
      }));
  }, [scannerSheet, scannerColumns]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            if (isScanner) void loadScanner();
            else void loadAutomatic();
            void loadApprovedSum();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Deposit Approved Report</Text>
      <Text style={styles.sub}>
        {`${startDate} → ${endDate}`} · Total:{' '}
        {(isScanner ? visibleScannerRows.length : total).toLocaleString('en-IN')}
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
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Text style={styles.chipsLabel}>Type</Text>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, requestType === t.key && styles.chipActive]}
            onPress={() => {
              setRequestType(t.key);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, requestType === t.key && styles.chipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Text style={styles.chipsLabel}>Gateway</Text>
        <TouchableOpacity
          style={[styles.chip, !gatewayId && styles.chipActive]}
          onPress={() => {
            setGatewayId('');
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, !gatewayId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {gateways.map((g, gi) => (
          <TouchableOpacity
            key={`gw-${gi}-${String(g._id ?? '')}`}
            style={[styles.chip, gatewayId === g._id && styles.chipActive]}
            onPress={() => {
              setGatewayId(g._id);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, gatewayId === g._id && styles.chipTextActive]}>
              {g.name || '—'}-{g.mid ?? ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryText}>
            {selectedGateway?.mid
              ? `Total Approved Sum: ${formatIN(approvedSum)}`
              : 'Total Approved Sum: select gateway'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.downloadBtn, loading && styles.downloadBtnDisabled]}
          disabled={loading}
          onPress={() => setDownloadOpen(true)}
        >
          <Text style={styles.downloadBtnText}>Download Excel Data</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isScanner ? (
        <>
          {loading && visibleScannerRows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
          {!loading && visibleScannerRows.length === 0 ? (
            <Text style={styles.hint}>No scanner data found</Text>
          ) : null}
          <View style={styles.list}>
            {visibleScannerRows.map((row, index) => (
              <TouchableOpacity
                key={`row-${index}-${String(row._id || row.userId || '')}`}
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => setScannerSheet(row)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>#{index + 1}</Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {display(row.userName)}
                  </Text>
                  {row.userId ? (
                    <TouchableOpacity
                      style={styles.reportBtn}
                      onPress={() => openUserReport(row.userId, row.userName)}
                    >
                      <Text style={styles.reportBtnText}>User Report</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    App Code: {appCodeForName(row.clientName)}
                  </Text>
                  <Text style={styles.cardSplitRight} numberOfLines={1}>
                    Balance: {formatIN(row.balance)}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Reason</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>{display(row.reason)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>DP ID</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>{display(row.userId)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Date</Text>
                  <Text style={styles.cardValue}>
                    {[formatDisplayDate(row.createdOn), formatDisplayTime(row.createdOn)]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </Text>
                </View>
                <Text style={styles.cardHint}>Tap card for full details</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
          {!loading && rows.length === 0 ? (
            <Text style={styles.hint}>No approved deposits found</Text>
          ) : null}
          <View style={styles.list}>
            {rows.map((row, index) => (
              <TouchableOpacity
                key={`row-${index}-${String(row._id || row.orderId || '')}`}
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => setDepositSheet(row)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {display(row.userName)}
                  </Text>
                  {row.userId ? (
                    <TouchableOpacity
                      style={styles.reportBtn}
                      onPress={() => openUserReport(row.userId, row.userName)}
                    >
                      <Text style={styles.reportBtnText}>User Report</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Amount</Text>
                  <Text style={styles.cardValue}>{formatIN(row.amount)}</Text>
                </View>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    App Code: {appCodeForName(row.clientName)}
                  </Text>
                  <Text style={[styles.cardSplitRight, styles.approvedText]} numberOfLines={1}>
                    Status: {display(row.status)}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>DP ID</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>{display(row.userId)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Date</Text>
                  <Text style={styles.cardValue}>
                    {[formatDisplayDate(row.createdOn), formatDisplayTime(row.createdOn)]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </Text>
                </View>
                <Text style={styles.cardHint}>Tap card for full details</Text>
              </TouchableOpacity>
            ))}
          </View>
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

      <RowDetailSheet
        visible={depositSheet !== null}
        title={depositSheet ? display(depositSheet.userName) : ''}
        fields={depositSheetFields}
        onClose={() => setDepositSheet(null)}
        actions={
          depositSheet?.userId
            ? [
                {
                  label: 'User Report',
                  onPress: () => {
                    const id = depositSheet.userId;
                    const name = depositSheet.userName;
                    setDepositSheet(null);
                    openUserReport(id, name);
                  },
                },
              ]
            : undefined
        }
      />
      <RowDetailSheet
        visible={scannerSheet !== null}
        title={scannerSheet ? display(scannerSheet.userName) : ''}
        fields={scannerSheetFields}
        onClose={() => setScannerSheet(null)}
        actions={
          scannerSheet?.userId
            ? [
                {
                  label: 'User Report',
                  onPress: () => {
                    const id = scannerSheet.userId;
                    const name = scannerSheet.userName;
                    setScannerSheet(null);
                    openUserReport(id, name);
                  },
                },
              ]
            : undefined
        }
      />
      <SheetDownloadOtpModal
        visible={downloadOpen}
        filter={{
          mid:
            selectedGateway?.mid != null && selectedGateway.mid !== ''
              ? String(selectedGateway.mid)
              : 'All',
          type: isScanner ? 'Scanner Deposit Approved Report' : 'Deposit Approved Report',
        }}
        onClose={() => setDownloadOpen(false)}
        onVerified={() => downloadExcel()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  downloadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chipsRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center', marginTop: spacing(3) },
  chipsLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
  summaryChip: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  summaryText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  reportBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  reportBtnText: { color: colors.primaryForeground, fontSize: 10, fontWeight: '700' },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  approvedText: { color: '#16a34a' },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
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
