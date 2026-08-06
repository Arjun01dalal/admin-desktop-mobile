/**
 * Casino Games — port of desktop CasinoGamesPage (list + status toggle).
 * ops.casinoGetConfig -> activeCasinoProvider (QTECH/WACS); ops.casinoGetData
 * { pageNo, itemsPerPage, Filters }. Row tap opens a detail modal with an
 * Enable/Disable action (ops.casinoEditGame). Provider switching, Mirai and
 * Table ID management stay desktop-only.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  Name?: string;
  name?: string;
  gameId?: string | number;
  Game_Code?: string | number;
  tableId?: string | number;
  providerId?: string | number;
  Provider_ID?: string | number;
  provider?: { id?: string | number };
  category?: string;
  Category_ID?: string;
  status?: boolean;
  [key: string]: unknown;
};

type Provider = 'QTECH' | 'WACS';

const PAGE_SIZE = 25;
const MAIN_KEYS = new Set(['idx', 'name', 'gameId', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function asProvider(value: unknown): Provider {
  return value === 'WACS' ? 'WACS' : 'QTECH';
}

export function CasinoGamesScreen() {
  const [provider, setProvider] = useState<Provider>('QTECH');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [idDraft, setIdDraft] = useState('');
  const [applied, setApplied] = useState<{ name: string; id: string }>({ name: '', id: '' });
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const genRef = useRef(0);

  // Active provider from config (desktop reads res.data.activeCasinoProvider).
  useEffect(() => {
    void (async () => {
      const res = await secureApi<{ activeCasinoProvider?: string }>('ops.casinoGetConfig', {});
      if (res.ok) setProvider(asProvider(res.data?.activeCasinoProvider));
    })();
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, unknown> = {};
      if (applied.name.trim()) filters.Name = applied.name.trim();
      if (applied.id.trim()) {
        if (provider === 'QTECH') filters.gameId = applied.id.trim();
        else filters.Game_Code = applied.id.trim();
      }
      const res = await secureApi<unknown>('ops.casinoGetData', {
        pageNo: page,
        itemsPerPage: PAGE_SIZE,
        Filters: filters,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load casino games');
        setRows([]);
        setTotalPages(1);
        return;
      }
      const data = (res.data || {}) as { items?: Row[]; totalPages?: number };
      setSheetRow(null);
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, applied, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Enable game' : 'Disable game',
        `${next ? 'Enable' : 'Disable'} ${row.Name || row.name || 'this game'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next ? 'Enable' : 'Disable',
            style: next ? 'default' : 'destructive',
            onPress: () => {
              void (async () => {
                setTogglingId(String(row._id || ''));
                try {
                  const res = await secureApi<unknown>('ops.casinoEditGame', {
                    gameId: row.gameId ?? row._id,
                    _id: row._id,
                    status: next,
                  });
                  if (res.ok) {
                    setSheetRow(null);
                    void load();
                  } else {
                    setError(res.message || 'Failed to update game status');
                  }
                } finally {
                  setTogglingId(null);
                }
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * PAGE_SIZE + i + 1) },
      { key: 'id', label: 'ID', width: 150, render: (r) => display(r._id) },
      { key: 'name', label: 'Game Name', width: 150, render: (r) => display(r.Name || r.name) },
      {
        key: 'gameId',
        label: provider === 'QTECH' ? 'Game ID' : 'Game Code',
        width: 110,
        render: (r) => display(provider === 'QTECH' ? r.gameId : (r.Game_Code ?? r.gameId)),
      },
      ...(provider === 'QTECH'
        ? [{ key: 'tableId', label: 'Table ID', width: 100, render: (r: Row) => display(r.tableId) }]
        : []),
      {
        key: 'providerId',
        label: 'Provider ID',
        width: 100,
        render: (r) => display(r.provider?.id ?? r.Provider_ID ?? r.providerId),
      },
      {
        key: 'category',
        label: 'Category',
        width: 110,
        render: (r) => display(r.category ?? r.Category_ID),
      },
      { key: 'status', label: 'Status', width: 80, render: (r) => (r.status ? 'Active' : 'Inactive') },
    ],
    [page, provider],
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
      <Text style={styles.title}>Casino Games</Text>
      <Text style={styles.sub}>Active Provider: {provider}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Game name…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.searchInput}
          value={idDraft}
          onChangeText={setIdDraft}
          placeholder={provider === 'QTECH' ? 'Game ID…' : 'Game Code…'}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => {
            setApplied({ name: nameDraft, id: idDraft });
            setPage(1);
          }}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

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
        emptyMessage="No games found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.Name || sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={
          sheetRow
            ? [
                {
                  label: sheetRow.status ? 'Disable game' : 'Enable game',
                  tone: sheetRow.status ? 'warning' : 'primary',
                  disabled: togglingId === String(sheetRow._id || ''),
                  onPress: () => toggleStatus(sheetRow),
                },
              ]
            : []
        }
        note="Provider switching, Mirai and Table ID management are available on the desktop panel."
        onClose={() => setSheetRow(null)}
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
  searchInput: {
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
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  btnDisabled: { opacity: 0.5 },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
