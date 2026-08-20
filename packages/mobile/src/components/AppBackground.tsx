/**
 * Global cosmic background — dark base with amber/violet radial glows and a
 * deterministic starfield. Mounted once behind the navigator; screens use a
 * transparent root so this shows through everywhere.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, isDarkTheme } from '../theme';

function makeStars(count: number, w: number, h: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 1234;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.5 + rnd() * 1.3,
      o: 0.15 + rnd() * 0.4,
    });
  }
  return stars;
}

export function AppBackground() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => makeStars(70, width, height), [width, height]);
  const starFill = isDarkTheme() ? '#fff' : '#0b0f14';
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="bgGlow" cx="50%" cy="0%" r="70%">
            <Stop offset="0%" stopColor="#f5b301" stopOpacity="0.10" />
            <Stop offset="55%" stopColor="#f5b301" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#f5b301" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bgViolet" cx="10%" cy="100%" r="70%">
            <Stop offset="0%" stopColor="#7c3aed" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bgGlow)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#bgViolet)" />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={starFill} opacity={s.o} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.background },
});
