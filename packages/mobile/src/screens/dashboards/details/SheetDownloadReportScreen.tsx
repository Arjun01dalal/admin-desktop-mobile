/**
 * Sheet Download Report — port of desktop SheetDownloadReportPage.
 * reports.getAllMidOld ({}) → getAllDistinctMids for the Mid filter;
 * reports.sheetDownloadAudit for the list.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { parseDistinctMidOptions } from '@astro/shared';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { usePagedSecureQuery } from '../../../hooks/usePagedSecureQuery';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display } from '../../../utils/display';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './reportList.styles';

type Row = {
  _id?: string;
  downloadedBy?: { name?: string; userId?: string; date?: string; city?: string; state?: string };
  filter?: { type?: string; mid?: string };
  [key: string]: unknown;
};

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
  const [selected, setSelected] = useState<Row | null>(null);

  // Load Mid options once.
  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('reports.getAllMidOld', {});
      if (!res.ok) return;
      setMids(parseDistinctMidOptions(res.data));
    })();
  }, []);

  const buildPayload = useCallback(
    () => ({
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      itemsPerPage: pageSize,
      pageNo: page,
      filter: { mid: mid || undefined },
    }),
    [startDate, endDate, pageSize, page, mid],
  );

  const unpack = useCallback((data: unknown) => {
    const body = (data || {}) as { items?: unknown; total?: unknown; totalPages?: unknown };
    const list = Array.isArray(body.items) ? (body.items as Row[]) : [];
    return {
      rows: list,
      total: Number(body.total) || 0,
      totalPages: Math.max(1, Number(body.totalPages) || 1),
    };
  }, []);

  const { rows, total, totalPages, loading, error, load } = usePagedSecureQuery<Row>({
    action: 'reports.sheetDownloadAudit',
    buildPayload,
    unpack,
    autoDeps: [startDate, endDate, pageSize, page, mid],
    errorMessage: 'Failed to load sheet download report',
  });

  useEffect(() => {
    setSelected(null);
  }, [rows]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.downloadedBy?.name) },
      {
        key: 'userId',
        label: 'User ID',
        width: 150,
        render: (r) => display(r.downloadedBy?.userId),
      },
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

  const keyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <SheetDownloadCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        onPress={() => setSelected(row)}
      />
    ),
    [page, pageSize],
  );

  const listHeader = (
    <>
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
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No download records found"
        refreshing={loading}
        onRefresh={() => void load()}
      />

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
    </>
  );
}

type SheetDownloadCardProps = {
  row: Row;
  index: number;
  page: number;
  pageSize: number;
  onPress: () => void;
};

const SheetDownloadCard = memo(function SheetDownloadCard({
  row,
  index,
  page,
  pageSize,
  onPress,
}: SheetDownloadCardProps) {
  const date = row.downloadedBy?.date;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.downloadedBy?.name)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          MID: {display(row.filter?.mid)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          Type: {display(row.filter?.type)}
        </Text>
      </View>
      <Text style={styles.cardSplitLeft} numberOfLines={1}>
        {date ? `${formatDisplayDate(date)} - ${formatDisplayTime(date)}` : '—'}
      </Text>
      <Text style={styles.cardHint}>Tap card for details</Text>
    </TouchableOpacity>
  );
});
