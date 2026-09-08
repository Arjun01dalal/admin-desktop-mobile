/**
 * Active Bot Users — port of desktop ActiveBotUsersPage / Laxmi activeBotUsers.
 * Columns: SR.No, Name, DP ID, Bot ID, App Name, Mobile No, Balance, Last Activity, City, State.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { makeStyles } from '../../../styles/common';
import { useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { RESP_SHOW_MOBILE, type CallerRow } from '../../../auth/callerRoles';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { colors, spacing } from '../../../theme';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type ListParams = {
  activeBotUsers?: CallerRow[];
  startDate?: string;
  endDate?: string;
};

function formatBalance(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function firstBotId(row: CallerRow): string {
  const ids = row.botIds;
  if (Array.isArray(ids) && ids.length > 0) return String(ids[0] ?? '-');
  if (ids != null && ids !== '') return String(ids);
  return '-';
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

export function ActiveBotUsersScreen() {
  const params = (useRoute().params ?? {}) as ListParams;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, getSessionUser());

  const [draftStart, setDraftStart] = useState(() => params.startDate || todayIST());
  const [draftEnd, setDraftEnd] = useState(() => params.endDate || todayIST());
  const [startDate, setStartDate] = useState(() => params.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => params.endDate || todayIST());
  const [rows, setRows] = useState<CallerRow[]>(() => params.activeBotUsers || []);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('caller.activeUsersFromCalls', { startDate, endDate });
      if (!res.ok || res.success === false) {
        setRows([]);
        setTotal(0);
        return;
      }
      const data = res.data as { users?: CallerRow[]; total?: number } | undefined;
      setRows(data?.users || []);
      setTotal(Number(data?.total ?? data?.users?.length ?? 0));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }, [draftStart, draftEnd]);

  const columns = useMemo<DataTableColumn<CallerRow>[]>(
    () => [
      { key: 'sr', label: 'SR.No', width: 56, render: (_r, i) => String(i + 1) },
      {
        key: 'name',
        label: 'Name',
        width: 120,
        render: (r) => String(r.name || r.userName || '-'),
      },
      {
        key: 'dp',
        label: 'DP ID',
        width: 140,
        render: (r) => String(r._id || r.userId || '-'),
      },
      { key: 'bot', label: 'Bot ID', width: 80, render: (r) => firstBotId(r) },
      {
        key: 'app',
        label: 'App Name',
        width: 110,
        render: (r) => String(r.clientName || r.appName || '-'),
      },
      {
        key: 'mobile',
        label: 'Mobile No',
        width: 120,
        render: (r) => maskMobile(r.mobile || r.userMobile, canShowMobile),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (r) => formatBalance(r.balance),
      },
      {
        key: 'last',
        label: 'Last Activity',
        width: 110,
        render: (r) => {
          const raw = r.activeUser ?? r.lastActivity ?? r.updatedOn ?? r.updatedAt;
          return raw ? formatDisplayDate(raw) : '-';
        },
      },
      { key: 'city', label: 'City', width: 100, render: (r) => String(r.city || '-') },
      { key: 'state', label: 'State', width: 100, render: (r) => String(r.state || '-') },
    ],
    [canShowMobile],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    const r = selected.row;
    const raw = r.activeUser ?? r.lastActivity ?? r.updatedOn ?? r.updatedAt;
    return [
      { label: 'SR.No', value: String(selected.index + 1) },
      { label: 'Name', value: String(r.name || r.userName || '-') },
      { label: 'DP ID', value: String(r._id || r.userId || '-') },
      { label: 'Bot ID', value: firstBotId(r) },
      { label: 'App Name', value: String(r.clientName || r.appName || '-') },
      { label: 'Mobile No', value: maskMobile(r.mobile || r.userMobile, canShowMobile) },
      { label: 'Balance', value: formatBalance(r.balance) },
      { label: 'Last Activity', value: raw ? formatDisplayDate(raw) : '-' },
      { label: 'City', value: String(r.city || '-') },
      { label: 'State', value: String(r.state || '-') },
    ];
  }, [selected, canShowMobile]);

  const styles = useStyles();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Text style={styles.title}>Active Bot Users ({total || rows.length})</Text>
        <DetailFilterBar
          startDate={draftStart}
          endDate={draftEnd}
          loading={loading}
          onStartDateChange={setDraftStart}
          onEndDateChange={setDraftEnd}
          onApply={applyDates}
        />
        {loading && rows.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            keyFor={(r, i) => String(r._id || r.userId || i)}
            loading={loading}
            emptyMessage="No bot users"
            onRowPress={(row, index) => setSelected({ row, index })}
          />
        )}
      </ScrollView>

      <RowDetailSheet
        visible={!!selected}
        title={String(selected?.row.name || selected?.row.userName || 'Bot user')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loadingBox: { paddingVertical: spacing(8), alignItems: 'center' as const },
}));
