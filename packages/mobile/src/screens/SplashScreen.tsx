/**
 * Native splash — desktop Welcome / Astro branding (no website WebView).
 */
import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { styles } from './SplashScreen.styles';

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
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
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

