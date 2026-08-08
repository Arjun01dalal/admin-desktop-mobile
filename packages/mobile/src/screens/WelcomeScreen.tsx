/**
 * Welcome / landing screen — mobile take on the desktop panel's hero page:
 * app icon, "WELCOME to" + amber "ASTRO ADMIN", role badge and signed-in line,
 * over a subtle warm glow on the dark background.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';

export function WelcomeScreen() {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  // Scale type & logo off the viewport so small phones don't overflow and
  // tablets don't look tiny. Clamped so extremes stay sane.
  const brandSize = Math.min(34, Math.max(22, width * 0.075));
  const welcomeSize = Math.min(26, Math.max(18, width * 0.058));
  const logoSize = Math.min(88, Math.max(56, width * 0.18));
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { minHeight: height - 120 }]}
    >
      <View style={[styles.hero, { paddingVertical: Math.min(64, height * 0.08) }]}>
        {/* soft warm glow behind the icon */}
        <View style={styles.glow} />
        <Image
          source={require('../../assets/icon.png')}
          style={[styles.logo, { width: logoSize, height: logoSize }]}
          resizeMode="contain"
        />
        <Text style={[styles.welcome, { fontSize: welcomeSize }]}>WELCOME to</Text>
        <Text
          style={[styles.brand, { fontSize: brandSize }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ASTRO ADMIN
        </Text>
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
  content: { padding: spacing(4), paddingBottom: spacing(10), flexGrow: 1, justifyContent: 'center' },
  hero: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
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
    borderRadius: radius.md,
    marginBottom: spacing(5),
  },
  welcome: {
    color: colors.foreground,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  brand: {
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: spacing(2),
    textAlign: 'center',
    maxWidth: '100%',
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
    width: '100%',
    alignSelf: 'center',
    maxWidth: 480,
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
