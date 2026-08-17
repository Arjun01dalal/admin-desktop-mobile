/**
 * Top Games — port of desktop TopGamesPage.
 * topGames.completeDoc {} -> { data: { [category]: TopGameItem[] } }; category chips,
 * client-side search; row tap opens detail modal with status toggle
 * (topGames.updateStatus) and delete (topGames.removeAtPosition).
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
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Item = {
  _id?: string;
  Name?: string;
  gameName?: string;
  gameId?: string | number;
  providerName?: string;
  provider?: { name?: string; id?: string | number };
  category?: string;
  subCategory?: string;
  status?: boolean;
  createdOn?: string;
  updatedOn?: string;
  imagePath?: string;
  images?: Array<{ type?: string; url?: string }>;
  [key: string]: unknown;
};

type GameRow = Item & { _categoryKey: string; _position: number };

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function gameName(item: Item): string {
  return String(item.Name || item.gameName || '—');
}

function providerName(item: Item): string {
  return String(item.providerName || item.provider?.name || '—');
}

/** Desktop getImageUrl: imagePath, else preferred image type. */
function getImageUrl(item: Item): string {
  if (item.imagePath) return item.imagePath;
  const images = item.images || [];
  const preferred =
    images.find((img) => img.type === 'logo-square') ||
    images.find((img) => img.type === 'banner') ||
    images.find((img) => img.type === 'logo-round') ||
    images[0];
  return preferred?.url || '';
}

/** Desktop normalizePayload: canonical { data: { [category]: Item[] } }. */
function unpackDoc(data: unknown): Record<string, Item[]> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  const inner = (obj.payload ?? obj) as unknown;
  if (!inner || typeof inner !== 'object') return {};
  const innerObj = inner as Record<string, unknown>;
  if (innerObj.data && typeof innerObj.data === 'object' && !Array.isArray(innerObj.data)) {
    return innerObj.data as Record<string, Item[]>;
  }
  if (!Array.isArray(inner)) {
    const looksLikeCategoryMap = Object.values(innerObj).every(
      (val) => Array.isArray(val) || val == null,
    );
    return looksLikeCategoryMap
      ? (innerObj as Record<string, Item[]>)
      : { All: [inner as Item] };
  }
  return { All: inner as Item[] };
}

export function TopGamesScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Record<string, Item[]>>({});
  const [category, setCategory] = useState('All');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sheetRow, setSheetRow] = useState<GameRow | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('topGames.completeDoc', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load top games');
        setDoc({});
        return;
      }
      setSheetRow(null);
      setDoc(unpackDoc(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => ['All', ...Object.keys(doc)], [doc]);

  const rows = useMemo<GameRow[]>(() => {
    const mapCat = (cat: string, items: Item[] | undefined): GameRow[] =>
      (items || []).map((item, index) => ({ ...item, _categoryKey: cat, _position: index + 1 }));
    const list =
      category === 'All'
        ? Object.entries(doc).flatMap(([cat, items]) => mapCat(cat, items))
        : mapCat(category, doc[category]);
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) =>
      [gameName(item), String(item.gameId || ''), providerName(item)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [doc, category, search]);

  const toggleStatus = useCallback(
    (row: GameRow) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Show game' : 'Hide game',
        `${next ? 'Show' : 'Hide'} ${gameName(row)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              void (async () => {
                const res = await secureApi<unknown>('topGames.updateStatus', {
                  category: row._categoryKey,
                  gameId: row.gameId,
                  status: next,
                });
                if (res.ok) {
                  setSheetRow(null);
                  void load();
                } else {
                  setError(res.message || 'Failed to update status');
                }
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  const deleteRow = useCallback(
    (row: GameRow) => {
      Alert.alert('Remove game', `Remove ${gameName(row)} from ${row._categoryKey}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('topGames.removeAtPosition', {
                category: row._categoryKey,
                position: row._position,
              });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to remove game');
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const columns = useMemo<DataTableColumn<GameRow>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'name', label: 'Name', width: 150, render: (r) => gameName(r) },
      { key: 'gameId', label: 'Game ID', width: 110, render: (r) => display(r.gameId) },
      { key: 'provider', label: 'Provider', width: 120, render: (r) => providerName(r) },
      { key: 'categoryGroup', label: 'Category Group', width: 120, render: (r) => display(r._categoryKey) },
      { key: 'category', label: 'Game Category', width: 120, render: (r) => display(r.category) },
      { key: 'position', label: 'Position', width: 80, align: 'center', render: (r) => String(r._position) },
      { key: 'status', label: 'Status', width: 80, render: (r) => (r.status ? 'Showing' : 'Hidden') },
      {
        key: 'updatedOn',
        label: 'Updated On',
        width: 150,
        render: (r) => {
          const ts = r.updatedOn || r.createdOn;
          return ts ? `${formatDisplayDate(ts)} ${formatDisplayTime(ts)}` : '—';
        },
      },
    ],
    [],
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
      <Text style={styles.title}>Top Games</Text>
      <Text style={styles.sub}>
        {rows.length} games · {rows.filter((r) => r.status).length} showing
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchDraft}
          onChangeText={setSearchDraft}
          onSubmitEditing={() => setSearch(searchDraft)}
          returnKeyType="search"
          placeholder="Search name / game ID / provider…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => setSearch(searchDraft)}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
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
          const showing = Boolean(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${row._categoryKey}-${String(row._id ?? row.gameId ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {gameName(row)}
                </Text>
                <Text style={[styles.statusPill, showing ? styles.statusOn : styles.statusOff]}>
                  {showing ? 'Showing' : 'Hidden'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Category: {display(row.category)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Pos: {String(row._position)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Provider: {providerName(row)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  ID: {display(row.gameId)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? gameName(sheetRow) : ''}
        imageUri={sheetRow ? getImageUrl(sheetRow) || undefined : undefined}
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
                  label: sheetRow.status ? 'Hide game' : 'Show game',
                  tone: sheetRow.status ? 'warning' : 'primary',
                  onPress: () => toggleStatus(sheetRow),
                },
                { label: 'Remove from list', tone: 'warning', onPress: () => deleteRow(sheetRow) },
              ]
            : []
        }
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
  chipRow: { alignItems: 'center', paddingVertical: spacing(2), marginTop: spacing(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(2) },
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
});
