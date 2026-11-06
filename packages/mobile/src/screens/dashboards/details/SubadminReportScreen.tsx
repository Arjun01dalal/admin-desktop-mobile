/**
 * Subadmin Report — automatic logout sessions (desktop SubadminReportPage parity).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import {
  buildSubadminReportQuery,
  displaySubadminReportValue,
  formatSubadminLoginLabel,
  parseSubadminLogoutReport,
  SUBADMIN_REPORT_PAGE_SIZES,
  subadminReportRange,
  type SubadminLogoutRow,
} from '@astro/shared';

import { usePagedSecureQuery } from '../../../hooks/usePagedSecureQuery';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { hasPermission, Permissions } from '../../../auth/permissions';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { DetailFilterBar } from './DetailFilterBar';
import { todayIST } from '../../../utils/dates';
import { styles } from './reportList.styles';

function cell(value: unknown): string {
  return displaySubadminReportValue(value) || '—';
}

export function SubadminReportScreen() {
  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SubadminLogoutRow | null>(null);
  const canShowMobile = hasPermission(Permissions.show_mobile);

  const buildPayload = useCallback(() => {
    const query = buildSubadminReportQuery({
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      page,
      limit: pageSize,
    });
    if ('error' in query) {
      return { startDate: todayIST(), endDate: todayIST(), page: 1, limit: pageSize };
    }
    return query;
  }, [startDate, endDate, page, pageSize]);

  const unpack = useCallback(
    (data: unknown) => {
      const parsed = parseSubadminLogoutReport(data, { page, limit: pageSize });
      return {
        rows: parsed.rows,
        total: parsed.total,
        totalPages: parsed.totalPages,
      };
    },
    [page, pageSize],
  );

  const { rows, total, totalPages, loading, error, load } = usePagedSecureQuery<SubadminLogoutRow>({
    action: 'reports.automaticLogoutDetails',
    buildPayload,
    unpack,
    autoDeps: [startDate, endDate, pageSize, page],
    errorMessage: 'Failed to load Subadmin Report',
  });

  useEffect(() => {
    setSelected(null);
  }, [rows]);

  const range = subadminReportRange(total, page, pageSize);

  const columns = useMemo<DataTableColumn<SubadminLogoutRow>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      { key: 'name', label: 'Name', width: 130, render: (r) => cell(r.name) },
      { key: 'pseudo', label: 'Pseudo Name', width: 120, render: (r) => cell(r.pseudoName) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => (canShowMobile ? cell(r.mobile) : '*********'),
      },
      { key: 'role', label: 'Role', width: 110, render: (r) => cell(r.role) },
      {
        key: 'login',
        label: 'Login',
        width: 150,
        render: (r) => formatSubadminLoginLabel(r) || '—',
      },
      {
        key: 'logout',
        label: 'Automatic Logout',
        width: 140,
        render: (r) => cell(r.automaticLogoutTime),
      },
      { key: 'session', label: 'Session', width: 100, render: (r) => cell(r.sessionDuration) },
      { key: 'next', label: 'Next Login', width: 130, render: (r) => cell(r.nextLoginTime) },
      { key: 'id', label: 'SubAdmin Id', width: 140, render: (r) => cell(r.subAdminId) },
    ],
    [canShowMobile, page, pageSize],
  );

  const keyExtractor = useCallback(
    (row: SubadminLogoutRow, index: number) => `${row.subAdminId || 'row'}-${index}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<SubadminLogoutRow>) => (
      <SubadminReportCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={canShowMobile}
        onPress={() => setSelected(row)}
      />
    ),
    [canShowMobile, page, pageSize],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Subadmin Report</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total {total.toLocaleString('en-IN')}
        {total > 0 ? ` · Showing ${range.start}–${range.end}` : ''}
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
        pageSizeOptions={[...SUBADMIN_REPORT_PAGE_SIZES]}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />
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
        ItemSeparatorComponent={ListSeparator}
        loading={loading}
        emptyMessage="No records found — try a different date range"
        refreshing={loading}
        onRefresh={() => void load()}
      />
      <RowDetailSheet
        visible={selected !== null}
        title={selected ? cell(selected.name) : 'Subadmin'}
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

function ListSeparator() {
  return <View style={styles.listSeparator} />;
}

const SubadminReportCard = memo(function SubadminReportCard({
  row,
  index,
  page,
  pageSize,
  canShowMobile,
  onPress,
}: {
  row: SubadminLogoutRow;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {cell(row.name)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Pseudo</Text>
        <Text style={styles.cardValue}>{cell(row.pseudoName)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Mobile</Text>
        <Text style={styles.cardValue}>
          {canShowMobile ? cell(row.mobile) : '*********'}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Role / Session</Text>
        <Text style={styles.cardValue}>
          {cell(row.role)} · {cell(row.sessionDuration)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Login</Text>
        <Text style={styles.cardValue}>{formatSubadminLoginLabel(row) || '—'}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Auto Logout</Text>
        <Text style={styles.cardValue}>{cell(row.automaticLogoutTime)}</Text>
      </View>
    </TouchableOpacity>
  );
});
