/**
 * Welcome / landing screen — cosmic hero matching the desktop panel:
 * SVG starfield + warm radial glow, logo in an amber ring, "WELCOME to"
 * + amber "ASTRO ADMIN", role badge and signed-in chip.
 */
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';

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
          <View style={styles.brandUnderline} />

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245,179,1,0.25)',
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroInner: { alignItems: 'center', paddingHorizontal: spacing(4), paddingVertical: spacing(8) },
  logoRing: {
    borderWidth: 1.5,
    borderColor: 'rgba(245,179,1,0.45)',
    backgroundColor: 'rgba(245,179,1,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(5),
  },
  welcome: {
    color: colors.foreground,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    opacity: 0.9,
  },
  brand: {
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: spacing(2),
    textAlign: 'center',
    maxWidth: '100%',
    textShadowColor: 'rgba(245,179,1,0.45)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  brandUnderline: {
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(245,179,1,0.6)',
    marginTop: spacing(3),
  },
  roleBadge: {
    marginTop: spacing(5),
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  signedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(4),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  signedIn: { color: colors.muted, fontSize: 12 },
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
