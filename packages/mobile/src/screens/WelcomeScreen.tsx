/**
 * Welcome / landing screen — mobile take on the desktop panel's hero page:
 * app icon, "WELCOME to" + amber "ASTRO ADMIN", role badge and signed-in line,
 * over a subtle warm glow on the dark background.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';

export function WelcomeScreen() {
  const { user } = useAuth();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {/* soft warm glow behind the icon */}
        <View style={styles.glow} />
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.welcome}>WELCOME to</Text>
        <Text style={styles.brand}>ASTRO ADMIN</Text>
        {user?.Role_Name ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{String(user.Role_Name).toUpperCase()}</Text>
          </View>
        ) : null}
        {user?.name ? <Text style={styles.signedIn}>Signed in as {user.name}</Text> : null}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Getting started</Text>
        <Text style={styles.tipBody}>
          Use the menu to open a section — pages you have access to appear in the drawer.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10), flexGrow: 1 },
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing(12),
    paddingHorizontal: spacing(4),
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245,179,1,0.08)',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    marginBottom: spacing(5),
  },
  welcome: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brand: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: spacing(2),
    textAlign: 'center',
  },
  roleBadge: {
    marginTop: spacing(5),
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  signedIn: { color: colors.muted, fontSize: 13, marginTop: spacing(4) },
  tipCard: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  tipTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  tipBody: { color: colors.muted, fontSize: 13, marginTop: spacing(1.5), lineHeight: 19 },
});
