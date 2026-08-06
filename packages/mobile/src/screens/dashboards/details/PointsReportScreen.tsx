/**
 * Points Report — port of desktop PointsReportPage + PointsReportDetailsPage + UpdateCoinDialog.
 * reports.subadminCoinReport { startDate, endDate }; tap a row to see its coin documents
 * (desktop's /coin-reports/report drill-down) and update the coin limit (reports.addCoin).
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
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Doc = {
  _id?: string;
  userName?: string;
  userBankName?: string;
  userId?: string;
  clientName?: string;
  userMobile?: string;
  balance?: number | string;
  tag?: string;
  reason?: string;
  mid?: string;
  remakr?: string;
  remark?: string;
  createdOn?: string;
  [key: string]: unknown;
};

type Row = {
  _id?: string;
  subadminName?: string;
  realName?: string;
  subadminMobile?: string;
  creditCount?: number;
  totalBalanceGiven?: number;
  debitCount?: number;
  totalBalanceRemove?: number;
  documents?: Doc[];
  [key: string]: unknown;
};

const MAIN_KEYS = new Set(['subadminName', 'realName', 'mobile', 'creditCount', 'totalGiven', 'debitCount', 'totalRemove']);
const DOC_MAIN_KEYS = new Set(['idx', 'userName', 'userBankName', 'userId', 'appCode', 'mobile', 'balance', 'tag', 'reason', 'mid', 'remark', 'time']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function PointsReportScreen() {
  const canShowMobile = hasPermission('show_mobile');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);

  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  // Drill-down: selected sub-admin (desktop navigates to /coin-reports/report).
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  // Edit coin limit.
  const [coinDraft, setCoinDraft] = useState('');
  const [coinMsg, setCoinMsg] = useState('');
  const [savingCoin, setSavingCoin] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('reports.subadminCoinReport', {
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load points report');
        setRows([]);
        return;
      }
      const raw = res.data;
      const list = Array.isArray(raw)
        ? (raw as Row[])
        : Array.isArray((raw as { payload?: Row[] })?.payload)
          ? ((raw as { payload?: Row[] }).payload as Row[])
          : [];
      setDetailRow(null);
      setSelectedDoc(null);
      setRows(list);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCoin = useCallback(async () => {
    if (!detailRow?._id || !coinDraft.trim()) return;
    setSavingCoin(true);
    setCoinMsg('');
    try {
      const res = await secureApi<unknown>('reports.addCoin', {
        _id: detailRow._id,
        coin: coinDraft.trim(),
        updatedBy: { _id: admin?._id, name: admin?.name, coin: coinDraft.trim() },
      });
      if (res.ok) {
        setCoinMsg('Coin Limits is Updated');
        setCoinDraft('');
        void load();
      } else {
        setCoinMsg(res.message || 'Failed to update coin limit');
      }
    } finally {
      setSavingCoin(false);
    }
  }, [detailRow, coinDraft, admin, load]);

  const totalGiven = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.totalBalanceGiven) || 0), 0),
    [rows],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'subadminName', label: 'Pseudo Name', width: 130, render: (r) => display(r.subadminName) },
      { key: 'realName', label: 'Real-Name', width: 130, render: (r) => display(r.realName) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) =>
          canShowMobile ? display(r.subadminMobile) : r.subadminMobile ? '**********' : '—',
      },
      { key: 'creditCount', label: 'Credit Count', width: 90, align: 'right', render: (r) => String(r.creditCount ?? 0) },
      {
        key: 'totalGiven',
        label: 'Total Balance Give',
        width: 120,
        align: 'right',
        render: (r) => floorNum(r.totalBalanceGiven ?? 0).toLocaleString('en-IN'),
      },
      { key: 'debitCount', label: 'Debit Count', width: 90, align: 'right', render: (r) => String(r.debitCount ?? 0) },
      {
        key: 'totalRemove',
        label: 'Total Balance Remove',
        width: 130,
        align: 'right',
        render: (r) => floorNum(r.totalBalanceRemove ?? 0).toLocaleString('en-IN'),
      },
    ],
    [canShowMobile],
  );

  const docColumns = useMemo<DataTableColumn<Doc>[]>(
    () => [
      { key: 'idx', label: '#', width: 40, render: (_d, i) => String(i + 1) },
      { key: 'userName', label: 'User Name', width: 120, render: (d) => display(d.userName) },
      { key: 'userBankName', label: 'User Bank Name', width: 130, render: (d) => display(d.userBankName) },
      { key: 'userId', label: 'User Id', width: 150, render: (d) => display(d.userId) },
      { key: 'appCode', label: 'App Code', width: 80, render: (d) => appCodeForName(String(d.clientName || '')) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (d) => (canShowMobile ? display(d.userMobile) : d.userMobile ? '**********' : '—'),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (d) => floorNum(d.balance ?? 0).toLocaleString('en-IN'),
      },
      { key: 'tag', label: 'Tag', width: 90, render: (d) => display(d.tag) },
      { key: 'reason', label: 'Reason', width: 120, render: (d) => display(d.reason) },
      { key: 'mid', label: 'Mid', width: 100, render: (d) => display(d.mid) },
      { key: 'remark', label: 'Remark', width: 120, render: (d) => display(d.remakr || d.remark) },
      {
        key: 'time',
        label: 'Time',
        width: 150,
        render: (d) =>
          d.createdOn ? `${formatDisplayDate(d.createdOn)} ${formatDisplayTime(d.createdOn)}` : '—',
      },
    ],
    [canShowMobile],
  );

  // ---- Details (drill-down) view ----
  if (detailRow) {
    const docs = detailRow.documents || [];
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => {
            setDetailRow(null);
            setCoinMsg('');
            setCoinDraft('');
          }}
        >
          <Text style={styles.backLink}>‹ Back to Points Report</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Coins Reports</Text>
        <Text style={styles.sub}>
          {display(detailRow.subadminName)} · {docs.length} documents
        </Text>

        {/* Update coin limit (desktop UpdateCoinDialog) */}
        <View style={styles.coinCard}>
          <Text style={styles.coinTitle}>Update Coin Limit</Text>
          <View style={styles.coinRow}>
            <TextInput
              style={styles.coinInput}
              value={coinDraft}
              onChangeText={setCoinDraft}
              placeholder="New coin limit"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.coinBtn, (savingCoin || !coinDraft.trim()) && styles.coinBtnDisabled]}
              disabled={savingCoin || !coinDraft.trim()}
              onPress={() => void saveCoin()}
            >
              <Text style={styles.coinBtnText}>{savingCoin ? 'Saving…' : 'Update'}</Text>
            </TouchableOpacity>
          </View>
          {coinMsg ? <Text style={styles.coinMsg}>{coinMsg}</Text> : null}
        </View>

        <DataTable
          columns={docColumns.filter((c) => DOC_MAIN_KEYS.has(c.key))}
          rows={docs}
          keyFor={(d, i) => String(d._id || i)}
          emptyMessage="No documents found"
          onRowPress={(doc) => setSelectedDoc(doc)}
          hint="Tap a row to see all details"
        />

        <RowDetailSheet
          visible={selectedDoc !== null}
          title={selectedDoc ? display(selectedDoc.userName) : ''}
          fields={
            selectedDoc
              ? docColumns
                  .filter((c) => c.key !== 'idx')
                  .map<SheetField>((c) => ({ label: c.label, value: c.render(selectedDoc, 0) }))
              : []
          }
          onClose={() => setSelectedDoc(null)}
        />
      </ScrollView>
    );
  }

  // ---- Main report view ----
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Points Report</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Balance Give: {floorNum(totalGiven).toLocaleString('en-IN')}
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
        emptyMessage="No data available"
        onRowPress={(row) => setDetailRow(row)}
        hint="Tap a row to open its coin documents"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  coinCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  coinTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginBottom: spacing(2) },
  coinRow: { flexDirection: 'row', alignItems: 'center' },
  coinInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
  },
  coinBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  coinBtnDisabled: { opacity: 0.5 },
  coinBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  coinMsg: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
