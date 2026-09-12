import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  formatGgrDateTime,
  formatGgrMoney,
  resolveGgrGameParts,
  type GgrAlertLogRow,
} from '@astro/shared';
import { ggrColor } from './ggrColor';
import { ggrAlertStyles as styles } from './styles';

type Props = {
  row: GgrAlertLogRow;
  index: number;
  page: number;
  pageSize: number;
  expanded: boolean;
  onToggleExpanded: () => void;
};

function GgrLogCardComponent({ row, index, page, pageSize, expanded, onToggleExpanded }: Props) {
  const games = Array.isArray(row.games) ? row.games : [];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.typePill}>{String(row.type || '—')}</Text>
      </View>
      <Text style={styles.cardTitle}>{row.name || '—'}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {row.userId || '—'} · {row.clientName || '—'}
      </Text>
      <Text style={styles.cardMeta}>
        {formatGgrDateTime(String(row.createdOn || row.createdAt || ''))}
      </Text>
      <View style={styles.metrics}>
        <Text style={styles.metric}>Bet {formatGgrMoney(row.totalBetAmount)}</Text>
        <Text style={styles.metric}>Win {formatGgrMoney(row.totalWinAmount)}</Text>
        <Text style={[styles.metric, { color: ggrColor(row.ggr), fontWeight: '800' }]}>
          GGR {formatGgrMoney(row.ggr)}
        </Text>
      </View>
      {games.length > 0 ? (
        <TouchableOpacity onPress={onToggleExpanded} style={styles.expandBtn}>
          <Text style={styles.expandBtnText}>
            {expanded ? 'Hide' : 'Show'} games ({games.length})
          </Text>
        </TouchableOpacity>
      ) : null}
      {expanded
        ? games.map((game, gi) => {
            const { gameId, gameName } = resolveGgrGameParts(game);
            return (
              <View key={`${row._id || index}-g-${gi}`} style={styles.gameRow}>
                <Text style={styles.gameTitle}>{gameName || gameId || '—'}</Text>
                {gameId ? <Text style={styles.cardMeta}>ID: {gameId}</Text> : null}
                <Text style={styles.cardMeta}>
                  Bet {formatGgrMoney(game.totalBetAmount)} · Win{' '}
                  {formatGgrMoney(game.totalWinAmount)} ·{' '}
                  <Text style={{ color: ggrColor(game.ggr), fontWeight: '700' }}>
                    GGR {formatGgrMoney(game.ggr)}
                  </Text>
                </Text>
              </View>
            );
          })
        : null}
    </View>
  );
}

export const GgrLogCard = memo(GgrLogCardComponent);
