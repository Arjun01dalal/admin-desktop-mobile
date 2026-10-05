/**
 * AAA exchange game-wise P/L — Laxmi ExchangeRateManagement settled-market view.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors } from '../../../theme';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { styles } from './ExchangeRateManagementScreen.styles';

type MarketRow = {
  marketName?: string;
  marketPL?: number;
  settleDateTime?: string;
};

type GameCard = {
  gameId?: string | number;
  gameName?: string;
  tournamentName?: string;
  markets?: MarketRow[];
  pl?: number;
};

export function ExchangeRateManagementScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Array<[string, GameCard]>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi('dashboard.aaaGameWise', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load AAA exchange data');
        setGames([]);
        return;
      }
      const raw = res.data;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw as Record<string, unknown>)
          .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
          .map(([k, v]) => [k, v as GameCard] as [string, GameCard]);
        setGames(entries);
        return;
      }
      if (Array.isArray(raw)) {
        setGames((raw as GameCard[]).map((g, i) => [String(g.gameId ?? i), g]));
        return;
      }
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>AAA Exchange</Text>
      <Text style={styles.description}>
        {startDate} → {endDate}
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
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && games.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && games.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No AAA exchange data</Text>
        </View>
      ) : null}

      {games.map(([matchKey, game]) => {
        const gameId = String(game.gameId ?? matchKey);
        const markets = Array.isArray(game.markets) ? game.markets : [];
        const isOpen = Boolean(expanded[gameId]);
        const marketsToShow = isOpen ? markets : markets.slice(0, 3);
        const pl = Number(game.pl ?? 0);

        return (
          <View key={gameId} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{String(game.gameName || matchKey)}</Text>
              {game.tournamentName ? (
                <Text style={styles.tournament}>
                  Tournament:{' '}
                  <Text style={styles.tournamentStrong}>{String(game.tournamentName)}</Text>
                </Text>
              ) : null}
            </View>

            {marketsToShow.map((mkt, i) => {
              const marketPl = Number(mkt.marketPL ?? 0);
              return (
                <View key={`${gameId}-mkt-${i}`} style={styles.market}>
                  <Text style={styles.marketName}>
                    Market Name: <Text style={styles.strong}>{String(mkt.marketName || '—')}</Text>
                  </Text>
                  <Text style={styles.marketMeta}>
                    Market Profit/Loss:{' '}
                    <Text
                      style={{
                        color: marketPl >= 0 ? colors.success : colors.destructive,
                        fontWeight: '800',
                      }}
                    >
                      {marketPl.toFixed(2)}
                    </Text>
                  </Text>
                  {mkt.settleDateTime ? (
                    <Text style={styles.marketMeta}>
                      Settled On: {new Date(mkt.settleDateTime).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {markets.length > 4 ? (
              <TouchableOpacity
                onPress={() => setExpanded((prev) => ({ ...prev, [gameId]: !isOpen }))}
                style={styles.moreBtn}
              >
                <Text style={styles.moreBtnText}>
                  {isOpen ? 'Show Less ↑' : `Show More (${markets.length - 3}) ↓`}
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.totalPl}>
              Total Game P/L:{' '}
              <Text
                style={{
                  color: pl >= 0 ? colors.success : colors.destructive,
                  fontWeight: '800',
                  fontSize: 16,
                }}
              >
                {pl.toFixed(2)}
              </Text>
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

