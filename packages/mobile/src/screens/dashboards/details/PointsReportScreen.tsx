/**
 * Points Report — port of desktop PointsReportPage + PointsReportDetailsPage + UpdateCoinDialog.
 * reports.subadminCoinReport { startDate, endDate }; tap a row to see its coin documents
 * (desktop's /coin-reports/report drill-down) and update the coin limit (reports.addCoin).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './PointsReportScreen.styles';
import { display } from '../../../utils/display';

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
      {
        key: 'subadminName',
        label: 'Pseudo Name',
        width: 140,
        render: (r) => display(r.subadminName),
      },
      { key: 'realName', label: 'Real-Name', width: 130, render: (r) => display(r.realName) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) =>
          canShowMobile ? display(r.subadminMobile) : r.subadminMobile ? '**********' : '—',
      },
      {
        key: 'creditCount',
        label: 'Credit Count',
        width: 100,
        align: 'center',
        render: (r) => String(r.creditCount ?? 0),
      },
      {
        key: 'totalGiven',
        label: 'Total Balance Give',
        width: 130,
        align: 'center',
        render: (r) => floorNum(r.totalBalanceGiven ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'debitCount',
        label: 'Debit Count',
        width: 100,
        align: 'center',
        render: (r) => String(r.debitCount ?? 0),
      },
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
      {
        key: 'userBankName',
        label: 'User Bank Name',
        width: 130,
        render: (d) => display(d.userBankName),
      },
      { key: 'userId', label: 'User Id', width: 150, render: (d) => display(d.userId) },
      {
        key: 'appCode',
        label: 'App Code',
        width: 80,
        render: (d) => appCodeForName(String(d.clientName || '')),
      },
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

  const docs = detailRow?.documents || [];

  const docKeyExtractor = useCallback(
    (doc: Doc, index: number) => `row-${index}-${String(doc._id ?? '')}`,
    [],
  );

  const renderDocItem = useCallback(
    ({ item: doc, index }: ListRenderItemInfo<Doc>) => (
      <PointsReportDocCard doc={doc} index={index} onPress={() => setSelectedDoc(doc)} />
    ),
    [],
  );

  const rowKeyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderRowItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <PointsReportCard row={row} index={index} onPress={() => setSheetRow(row)} />
    ),
    [],
  );

  // ---- Details (drill-down) view ----
  if (detailRow) {
    const detailHeader = (
      <>
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
      </>
    );

    return (
      <View style={styles.screen}>
        <ScreenFlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={docs}
          keyExtractor={docKeyExtractor}
          renderItem={renderDocItem}
          listHeader={detailHeader}
          emptyMessage="No documents found"
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
      </View>
    );
  }

  // ---- Main report view ----
  const listHeader = (
    <>
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
    </>
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={rowKeyExtractor}
        renderItem={renderRowItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No data available"
        refreshing={loading}
        onRefresh={() => void load()}
      />

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
    </View>
  );
}

type PointsReportCardProps = {
  row: Row;
  index: number;
  onPress: () => void;
};

const PointsReportCard = memo(function PointsReportCard({
  row,
  index,
  onPress,
}: PointsReportCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.subadminName)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>Credit: {String(row.creditCount ?? 0)}</Text>
        <Text style={styles.cardSplitRight}>
          Given: {floorNum(row.totalBalanceGiven ?? 0).toLocaleString('en-IN')}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>Debit: {String(row.debitCount ?? 0)}</Text>
        <Text style={styles.cardSplitRight}>
          Removed: {floorNum(row.totalBalanceRemove ?? 0).toLocaleString('en-IN')}
        </Text>
      </View>
      <Text style={styles.cardHint}>Tap card for details & documents</Text>
    </TouchableOpacity>
  );
});

type PointsReportDocCardProps = {
  doc: Doc;
  index: number;
  onPress: () => void;
};

const PointsReportDocCard = memo(function PointsReportDocCard({
  doc,
  index,
  onPress,
}: PointsReportDocCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(doc.userName)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>
          Balance: {floorNum(doc.balance ?? 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.cardSplitRight}>
          App: {appCodeForName(String(doc.clientName || ''))}
        </Text>
      </View>
      <Text style={styles.cardSplitLeft} numberOfLines={1}>
        {doc.createdOn
          ? `${formatDisplayDate(doc.createdOn)} ${formatDisplayTime(doc.createdOn)}`
          : '—'}
      </Text>
      <Text style={styles.cardHint}>Tap card for details</Text>
    </TouchableOpacity>
  );
});

