import React from 'react';
import { Text, View } from 'react-native';
import { Card } from '../components/UI';
import { styles } from './PlaceholderScreen.styles';

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

