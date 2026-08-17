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
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
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
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
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
      setSheetRow(null);
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
      { key: 'subadminName', label: 'Pseudo Name', width: 140, render: (r) => display(r.subadminName) },
      { key: 'realName', label: 'Real-Name', width: 130, render: (r) => display(r.realName) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) =>
          canShowMobile ? display(r.subadminMobile) : r.subadminMobile ? '**********' : '—',
      },
      { key: 'creditCount', label: 'Credit Count', width: 100, align: 'center', render: (r) => String(r.creditCount ?? 0) },
      {
        key: 'totalGiven',
        label: 'Total Balance Give',
        width: 130,
        align: 'center',
        render: (r) => floorNum(r.totalBalanceGiven ?? 0).toLocaleString('en-IN'),
      },
      { key: 'debitCount', label: 'Debit Count', width: 100, align: 'center', render: (r) => String(r.debitCount ?? 0) },
      {
        key: 'totalRemove',
        label: 'Total Balance Remove',
        width: 140,
        align: 'center',
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
        align: 'center',
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

        {docs.length === 0 ? <Text style={styles.hint}>No documents found</Text> : null}
        <View style={styles.list}>
          {docs.map((doc, index) => (
            <TouchableOpacity key={`row-${index}-${String(doc._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSelectedDoc(doc)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{display(doc.userName)}</Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Balance: {floorNum(doc.balance ?? 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.cardSplitRight}>App: {appCodeForName(String(doc.clientName || ''))}</Text>
              </View>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>{doc.createdOn ? `${formatDisplayDate(doc.createdOn)} ${formatDisplayTime(doc.createdOn)}` : '—'}</Text>
              <Text style={styles.cardHint}>Tap card for details</Text>
            </TouchableOpacity>
          ))}
        </View>

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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No data available</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity key={`row-${index}-${String(row._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSheetRow(row)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{display(row.subadminName)}</Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft}>Credit: {String(row.creditCount ?? 0)}</Text>
              <Text style={styles.cardSplitRight}>Given: {floorNum(row.totalBalanceGiven ?? 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft}>Debit: {String(row.debitCount ?? 0)}</Text>
              <Text style={styles.cardSplitRight}>Removed: {floorNum(row.totalBalanceRemove ?? 0).toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.cardHint}>Tap card for details & documents</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.subadminName) : ''}
        fields={
          sheetRow
            ? columns.map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={[
          {
            label: 'Open coin documents',
            onPress: () => {
              if (sheetRow) setDetailRow(sheetRow);
              setSheetRow(null);
            },
          },
        ]}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginBottom: spacing(1) },
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
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1, minWidth: 0 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  cardSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2), paddingVertical: 1 },
  cardSplitLeft: { color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'left' },
  cardSplitRight: { color: colors.foreground, fontSize: 11, fontWeight: '700', flexShrink: 0, maxWidth: '48%', textAlign: 'right' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
});
