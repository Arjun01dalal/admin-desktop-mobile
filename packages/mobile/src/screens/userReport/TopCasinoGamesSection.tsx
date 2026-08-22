import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
          row.marketName ?? row.market ?? row.market_name ?? row.gameName ?? '',
        ).trim(),
        playCount: Number(row.playCount ?? row.count ?? row.play_count ?? 0) || 0,
      };
    })
    .filter((r) => r.providerName || r.marketName);
}

export function TopCasinoGamesSection({ userId }: { userId: string }) {
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
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Top Casino Games</Text>
        <Text style={styles.count}>{loading ? 'Loading…' : `${rows.length} games`}</Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing(2),
    padding: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(1.5),
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  count: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  loader: { paddingVertical: spacing(2) },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: spacing(2) },
  row: {
    paddingVertical: spacing(1.25),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
