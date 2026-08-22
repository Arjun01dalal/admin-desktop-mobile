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
import {
  buildUpdateGameImagePayload,
  type GameImageUpdateTarget,
} from '@astro/shared/updateGameImage';
import { pickPageSizes } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { replaceS3WithCloudfront } from '../../../utils/cdnUrl';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { UpdateGameImageModal } from './UpdateGameImageModal';

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
  images?: Array<{ url?: string }>;
  Thumbnail?: string;
  [key: string]: unknown;
};

type Provider = 'QTECH' | 'WACS';

const PAGE_SIZE_OPTIONS = pickPageSizes([10, 25, 50, 100, 200]);
const GAME_CATEGORIES = [
  'Andar Bahar',
  'Roulette',
  'Dragon Tiger',
  'Lucky Sevens',
  'Poker',
  'Teen Patti',
  'BlackJack',
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function asProvider(value: unknown): Provider {
  return value === 'WACS' ? 'WACS' : 'QTECH';
}

function imageUrl(row: Row): string {
  const raw = row.images?.[0]?.url || row.images?.[1]?.url || row.Thumbnail || '';
  return raw ? replaceS3WithCloudfront(raw) : '';
}

function casinoGameId(row: Row): string {
  return String(row.gameId || row.Game_Code || '').trim();
}

function casinoProviderRaw(row: Row): string {
  return String(
    row.provider?.name ||
      row.Provider_ID ||
      (row as { providerName?: string }).providerName ||
      '',
  ).trim();
}

function asProviderNames(data: unknown): string[] {
  const fromArray = (items: unknown[]): string[] =>
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          const name = o.name ?? o.Name ?? o.providerName ?? o.id;
          return name != null ? String(name).trim() : '';
        }
        return '';
      })
      .filter(Boolean);

  if (Array.isArray(data)) return fromArray(data);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return fromArray(obj.payload);
    if (Array.isArray(obj.items)) return fromArray(obj.items);
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      const nested = obj.payload as Record<string, unknown>;
      if (Array.isArray(nested.items)) return fromArray(nested.items);
    }
  }
  return [];
}

export function CasinoGamesScreen() {
  const [provider, setProvider] = useState<Provider>('QTECH');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [gameCategory, setGameCategory] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [idDraft, setIdDraft] = useState('');
  const [applied, setApplied] = useState<{ name: string; id: string }>({ name: '', id: '' });
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<GameImageUpdateTarget | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const genRef = useRef(0);

  // Active provider from config (desktop reads res.data.activeCasinoProvider).
  useEffect(() => {
    void (async () => {
      const res = await secureApi<{ activeCasinoProvider?: string }>('ops.casinoGetConfig', {});
      if (res.ok) setProvider(asProvider(res.data?.activeCasinoProvider));
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('ops.casinoGetProviders', {});
      if (res.ok) setProviderOptions(asProviderNames(res.data));
    })();
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, unknown> = {};
      // Desktop: the category select takes priority over the name search.
      const nameFilter = gameCategory.trim() || applied.name.trim();
      if (nameFilter) filters.Name = nameFilter;
      if (applied.id.trim()) {
        if (provider === 'QTECH') filters.gameId = applied.id.trim();
        else filters.Game_Code = applied.id.trim();
      }
      if (provider === 'QTECH' && providerName.trim()) {
        filters['provider.name'] = providerName.trim();
      }
      const res = await secureApi<unknown>('ops.casinoGetData', {
        pageNo: page,
        itemsPerPage: pageSize,
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
  }, [page, pageSize, gameCategory, applied, provider, providerName]);

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
                  // Server schema rejects extra keys ("_id is not allowed") — send only gameId + status.
                  const res = await secureApi<unknown>('ops.casinoEditGame', {
                    gameId: row.gameId ?? row._id,
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

  const openImageUpdate = useCallback((row: Row) => {
    const gameId = casinoGameId(row);
    if (!gameId) {
      Alert.alert('Error', 'Game ID is required');
      return;
    }
    const providerRaw = casinoProviderRaw(row);
    if (!providerRaw) {
      Alert.alert('Error', 'Provider is required');
      return;
    }
    setSheetRow(null);
    setImageTarget({
      gameId,
      provider: providerRaw,
      name: String(row.Name || row.name || gameId),
      currentImageUrl: imageUrl(row) || '',
    });
  }, []);

  const handleImageUpdate = useCallback(
    async (imagePath: string) => {
      if (!imageTarget) return;
      setImageSaving(true);
      try {
        const payload = buildUpdateGameImagePayload(
          imageTarget.gameId,
          imagePath,
          imageTarget.provider,
        );
        const res = await secureApi<unknown>('topGames.updateImage', payload);
        if (!res.ok) {
          Alert.alert('Error', res.message || 'Failed to update game image');
          return;
        }
        Alert.alert('Success', 'Game image updated successfully');
        setImageTarget(null);
        void load();
      } finally {
        setImageSaving(false);
      }
    },
    [imageTarget, load],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
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
    [page, pageSize, provider],
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
      <Text style={styles.title}>{toDisplayText('Casino Games')}</Text>
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

      <View style={styles.filterBlock}>
        <Text style={styles.filterLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {['', ...GAME_CATEGORIES].map((cat) => (
            <TouchableOpacity
              key={cat || 'All'}
              style={[styles.chip, gameCategory === cat && styles.chipActive]}
              onPress={() => {
                if (gameCategory !== cat) {
                  setGameCategory(cat);
                  setPage(1);
                }
              }}
            >
              <Text style={[styles.chipText, gameCategory === cat && styles.chipTextActive]}>
                {cat || 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {provider === 'QTECH' ? (
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Provider</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            <TouchableOpacity
              style={[styles.chip, !providerName && styles.chipActive]}
              onPress={() => {
                if (providerName) {
                  setProviderName('');
                  setPage(1);
                }
              }}
            >
              <Text style={[styles.chipText, !providerName && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {providerOptions.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.chip, providerName === name && styles.chipActive]}
                onPress={() => {
                  if (providerName !== name) {
                    setProviderName(name);
                    setPage(1);
                  }
                }}
              >
                <Text style={[styles.chipText, providerName === name && styles.chipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.chipsRow}>
        <Text style={styles.chipsLabel}>Per page:</Text>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              if (pageSize !== n) {
                setPageSize(n);
                setPage(1);
              }
            }}
          >
            <Text style={[styles.chipText, pageSize === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No games found</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const active = Boolean(row.status);
          const gameIdLabel = provider === 'QTECH' ? 'Game ID' : 'Game Code';
          const gameIdValue = display(
            provider === 'QTECH' ? row.gameId : (row.Game_Code ?? row.gameId),
          );
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.Name || row.name)}
                </Text>
                <Text style={[styles.statusPill, active ? styles.statusOn : styles.statusOff]}>
                  {active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  {gameIdLabel}: {gameIdValue}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  {display(row.category ?? row.Category_ID)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.Name || sheetRow.name) : ''}
        imageUri={
          sheetRow ? imageUrl(sheetRow) || undefined : undefined
        }
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
                  label: 'Update Image',
                  tone: 'primary',
                  onPress: () => openImageUpdate(sheetRow),
                },
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

      <UpdateGameImageModal
        visible={imageTarget !== null}
        loading={imageSaving}
        target={imageTarget}
        onClose={() => !imageSaving && setImageTarget(null)}
        onSubmit={(path) => void handleImageUpdate(path)}
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
  filterBlock: { marginTop: spacing(3) },
  filterLabel: { color: colors.muted, fontSize: 12, marginBottom: spacing(1) },
  chipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(1),
    paddingRight: spacing(2),
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipsLabel: { color: colors.muted, fontSize: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
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
    maxWidth: '48%',
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
