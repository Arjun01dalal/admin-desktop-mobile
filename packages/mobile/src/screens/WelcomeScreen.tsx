/**
 * Welcome / landing screen — cosmic hero matching the desktop panel:
 * SVG starfield + warm radial glow, logo in an amber ring, "WELCOME to"
 * + amber "ASTRO ADMIN", role badge and signed-in chip.
 */
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../auth/AuthContext';
import { spacing} from '../theme';
import { styles } from './WelcomeScreen.styles';

/** Deterministic pseudo-random star positions (no Math.random → stable renders). */
function makeStars(count: number, w: number, h: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 42;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.6 + rnd() * 1.4,
      o: 0.25 + rnd() * 0.55,
    });
  }
  return stars;
}

export function WelcomeScreen() {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();

  const heroW = Math.min(width - spacing(8), 480);
  const heroH = Math.max(360, Math.min(460, height * 0.55));
  const brandSize = Math.min(34, Math.max(22, width * 0.075));
  const welcomeSize = Math.min(24, Math.max(17, width * 0.052));
  const logoSize = Math.min(84, Math.max(56, width * 0.17));

  const stars = useMemo(() => makeStars(46, heroW, heroH), [heroW, heroH]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { minHeight: height - 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { width: heroW, minHeight: heroH }]}>
        {/* Starfield + warm glow backdrop */}
        <Svg width={heroW} height={heroH} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="30%" r="65%">
              <Stop offset="0%" stopColor="#f5b301" stopOpacity="0.22" />
              <Stop offset="45%" stopColor="#f5b301" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="#f5b301" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="violet" cx="15%" cy="85%" r="60%">
              <Stop offset="0%" stopColor="#7c3aed" stopOpacity="0.16" />
              <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={heroW} height={heroH} fill="url(#glow)" />
          <Rect x="0" y="0" width={heroW} height={heroH} fill="url(#violet)" />
          {stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
          ))}
        </Svg>

        <View style={styles.heroInner}>
          <View
            style={[
              styles.logoRing,
              { width: logoSize + 22, height: logoSize + 22, borderRadius: (logoSize + 22) / 2 },
            ]}
          >
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 4 }}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.welcome, { fontSize: welcomeSize }]}>WELCOME TO</Text>
          <Text
            style={[styles.brand, { fontSize: brandSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            ASTRO ADMIN
          </Text>
          <View style={styles.csPanel}>
            <Text style={styles.csPanelText}>CS PANEL</Text>
          </View>

          {user?.Role_Name ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{String(user.Role_Name).toUpperCase()}</Text>
            </View>
          ) : null}

          {user?.name ? (
            <View style={styles.signedChip}>
              <View style={styles.onlineDot} />
              <Text style={styles.signedIn}>Signed in as {user.name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.tipCard, { width: heroW }]}>
        <Text style={styles.tipTitle}>✨ Getting started</Text>
        <Text style={styles.tipBody}>
          Use the menu to open a section — pages you have access to appear in the drawer.
        </Text>
      </View>
    </ScrollView>
  );
}

