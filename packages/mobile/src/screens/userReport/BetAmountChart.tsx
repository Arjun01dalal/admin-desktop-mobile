/** Bet Amount Overview bars (desktop chart, RN Views version). */
import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../UserReportScreen.styles';

const BAR_COLORS = ['#4fc3f7', '#ffb74d', '#81c784', '#e57373', '#ba68c8', '#f06292'];

export function BetAmountChart({ data }: { data: { name: string; amount: number }[] }) {
  if (!data.length) {
    return <Text style={styles.muted}>No graph data</Text>;
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <View style={styles.chartCard}>
      {data.map((d, i) => (
        <View key={d.name} style={styles.chartRow}>
          <Text style={styles.chartLabel} numberOfLines={1}>
            {d.name}
          </Text>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartBar,
                {
                  width: `${Math.max(d.amount > 0 ? 2 : 0, (d.amount / max) * 100)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                },
              ]}
            />
          </View>
          <Text style={styles.chartValue} numberOfLines={1}>
            {Math.floor(d.amount).toLocaleString('en-IN')}
          </Text>
        </View>
      ))}
    </View>
  );
}
