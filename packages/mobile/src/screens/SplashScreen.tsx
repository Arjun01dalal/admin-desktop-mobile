/**
 * Native splash — desktop Welcome / Astro branding (no website WebView).
 */
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { colors, spacing } from '../theme';

type Props = {
  onDone: () => void;
  durationMs?: number;
};

export function SplashScreen({ onDone, durationMs = 1200 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <SafeAreaView style={styles.root}>
      <AppBackground />
      <View style={styles.center}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.overline}>ASTRO ADMIN</Text>
        <Text style={styles.welcome}>WELCOME to</Text>
        <Text style={styles.brand}>ASTRO ADMIN</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>CS PANEL</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
  },
  logo: { width: 96, height: 96, marginBottom: spacing(4) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(3),
  },
  welcome: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  brand: {
    marginTop: spacing(1),
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#f1a144',
  },
  badge: {
    marginTop: spacing(4),
    backgroundColor: '#000',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(2),
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 13,
  },
});
