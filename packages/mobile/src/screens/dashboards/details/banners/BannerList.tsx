import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../BannersScreen.styles';
import { display, type Row } from './helpers';

type Props = {
  rows: Row[];
  onSelect: (row: Row) => void;
};

export function BannerList({ rows, onSelect }: Props) {
  return (
    <View style={styles.list}>
      {rows.map((row, index) => {
        const active = Boolean(row.status);
        return (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => onSelect(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.gameName)}
              </Text>
              <Text style={[styles.statusPill, active ? styles.statusOn : styles.statusOff]}>
                {active ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>
                Type: {display(row.type)}
              </Text>
              <Text style={styles.cardSplitRight} numberOfLines={1}>
                Pos: {display(row.position)}
              </Text>
            </View>
            <Text style={styles.cardHint}>Tap card for details & actions</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
