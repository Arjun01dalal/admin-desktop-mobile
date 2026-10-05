import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { secureApi } from '../../api/client';
import { colors } from '../../theme';
import { styles } from './TopCasinoGamesSection.styles';

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
        providerName: String(row.providerName ?? row.provider ?? row.provider_name ?? '').trim(),
        marketName: String(
          row.marketName ?? row.market ?? row.market_name ?? row.gameName ?? row.name ?? '',
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

  const summaryText = !open ? 'Tap to expand' : loading ? 'Loading…' : `${rows.length} games`;

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

