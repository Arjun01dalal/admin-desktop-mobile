import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/UI';
import { colors, spacing } from '../theme';

/** Shown for pages not yet ported to mobile. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Card style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>This page is coming to mobile soon.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing(5),
  },
  card: { alignItems: 'center', gap: spacing(2) },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14 },
});
