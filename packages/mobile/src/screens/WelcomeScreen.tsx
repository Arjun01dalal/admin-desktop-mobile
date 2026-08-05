import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/UI';
import { colors, spacing } from '../theme';

export function WelcomeScreen() {
  const { user } = useAuth();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.hello}>Welcome{user?.name ? `, ${user.name}` : ''} 👋</Text>
        <Text style={styles.sub}>
          {user?.Role_Name ? `Role: ${user.Role_Name}` : 'Astro Admin Panel'}
        </Text>
      </Card>
      <Card style={{ marginTop: spacing(3) }}>
        <Text style={styles.sectionTitle}>Getting started</Text>
        <Text style={styles.body}>
          Use the menu to open a section. Pages are being ported from the desktop panel in
          stages — items you have access to appear in the drawer.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4) },
  hello: { color: colors.foreground, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 14, marginTop: spacing(1) },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, marginTop: spacing(2), lineHeight: 20 },
});
