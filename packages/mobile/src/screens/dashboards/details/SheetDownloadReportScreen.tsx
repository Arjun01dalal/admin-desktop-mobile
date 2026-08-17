/**
 * Sheet Download Report — port of desktop SheetDownloadReportPage.
 * reports.getAllMidOld ({}) for the Mid filter; reports.sheetDownloadAudit for the list.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  downloadedBy?: { name?: string; userId?: string; date?: string; city?: string; state?: string };
  filter?: { type?: string; mid?: string };
  [key: string]: unknown;
};


function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function SheetDownloadReportScreen() {
  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [mids, setMids] = useState<string[]>([]);
  const [mid, setMid] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const genRef = useRef(0);

  // Load Mid options once.
  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('reports.getAllMidOld', {});
      if (!res.ok) return;
      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { payload?: unknown[] })?.payload)
          ? ((raw as { payload?: unknown[] }).payload as unknown[])
          : [];
      const opts = list
        .map((gw) => String((gw as { mid?: unknown })?.mid || ''))
        .filter(Boolean);
      setMids([...new Set(opts)]);
    })();
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('reports.sheetDownloadAudit', {
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        itemsPerPage: pageSize,
        pageNo: page,
        filter: { mid: mid || undefined },
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load sheet download report');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const data = (res.data || {}) as { items?: unknown; total?: unknown; totalPages?: unknown };
      setSelected(null);
      setRows(Array.isArray(data.items) ? (data.items as Row[]) : []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, pageSize, page, mid]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.downloadedBy?.name) },
      { key: 'userId', label: 'User ID', width: 150, render: (r) => display(r.downloadedBy?.userId) },
      {
        key: 'date',
        label: 'Download Date/Time',
        width: 160,
        render: (r) => {
          const d = r.downloadedBy?.date;
          return d ? `${formatDisplayDate(d)} - ${formatDisplayTime(d)}` : '—';
        },
      },
      { key: 'type', label: 'Type', width: 100, render: (r) => display(r.filter?.type) },
      { key: 'mid', label: 'Mid', width: 110, render: (r) => display(r.filter?.mid) },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.downloadedBy?.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.downloadedBy?.state) },
    ],
    [page, pageSize],
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
      <Text style={styles.title}>Sheet Download Report</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Record : {total.toLocaleString('en-IN')}
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
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />

      {/* Mid filter chips */}
      {mids.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.chip, mid === '' && styles.chipActive]}
            onPress={() => {
              setMid('');
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, mid === '' && styles.chipTextActive]}>All Mids</Text>
          </TouchableOpacity>
          {mids.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, mid === m && styles.chipActive]}
              onPress={() => {
                setMid(mid === m ? '' : m);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, mid === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No download records found</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => {
          const date = row.downloadedBy?.date;
          return (
            <TouchableOpacity key={`row-${index}-${String(row._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(row)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{display(row.downloadedBy?.name)}</Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>MID: {display(row.filter?.mid)}</Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>Type: {display(row.filter?.type)}</Text>
              </View>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>{date ? `${formatDisplayDate(date)} - ${formatDisplayTime(date)}` : '—'}</Text>
              <Text style={styles.cardHint}>Tap card for details</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.downloadedBy?.name) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(selected, 0) }))
            : []
        }
        onClose={() => setSelected(null)}
      />

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
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  quickRow: { marginTop: spacing(3), flexGrow: 0 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
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
});
