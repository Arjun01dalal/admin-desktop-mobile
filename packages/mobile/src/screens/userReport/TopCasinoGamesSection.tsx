import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';

type Row = {
  providerName: string;
  marketName: string;
  playCount: number;
};

function normalize(data: unknown): Row[] {
  const raw = data as Record<string, unknown> | unknown[] | null;
  const list =
    (Array.isArray(raw) && raw) ||
    (raw && typeof raw === 'object'
      ? raw.topCasinoGames ||
        raw.mostPlayedCasino ||
        raw.items ||
        raw.games ||
        (raw.payload as Record<string, unknown> | undefined)?.topCasinoGames ||
        (raw.payload as Record<string, unknown> | undefined)?.items
      : null);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        providerName: String(
          row.providerName ?? row.provider ?? row.provider_name ?? '',
        ).trim(),
        marketName: String(
          row.marketName ??
            row.market ??
            row.market_name ??
            row.gameName ??
            row.name ??
            '',
        ).trim(),
        playCount: Number(row.playCount ?? row.count ?? row.play_count ?? 0) || 0,
      };
    })
    .filter((r) => r.providerName || r.marketName);
}

export function TopCasinoGamesSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await secureApi('userReport.topCasinoGames', { userId });
      if (!res.ok) {
        setRows([]);
        return;
      }
      setRows(normalize(res.data));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (open) void load();
  }, [userId, open, load]);

  const summaryText = !open
    ? 'Tap to expand'
    : loading
      ? 'Loading…'
      : `${rows.length} games`;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.85}
        onPress={() => setOpen((value) => !value)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
          <Text style={styles.title}>Top Casino Games</Text>
        </View>
        <Text style={styles.count}>{summaryText}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>No casino game data found.</Text>
          ) : (
            rows.map((row, index) => (
              <View key={`${row.providerName}-${row.marketName}-${index}`} style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {index + 1}. {row.marketName || '—'}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {row.providerName || '—'} · Plays: {row.playCount}
                </Text>
              </View>
            ))
          )}
          {loaded && !loading ? (
            <TouchableOpacity style={styles.refreshBtn} onPress={() => void load()}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flex: 1 },
  chevron: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', color: colors.foreground, flex: 1 },
  count: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(2.5),
  },
  loader: { paddingVertical: spacing(3) },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: spacing(3) },
  row: {
    paddingVertical: spacing(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  refreshBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing(2),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
});
