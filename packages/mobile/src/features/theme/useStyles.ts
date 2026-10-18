/**
 * Runtime StyleSheet factory — recreates styles when theme colors change.
 * Prefer this over module-scope `StyleSheet.create({ color: colors.x })`.
 */
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { ThemeColors } from '../../themeTokens/palettes';
import { useTheme } from './ThemeProvider';

type AnyStyle = ViewStyle | TextStyle | ImageStyle;

export function useStyles<T extends Record<string, AnyStyle>>(
  factory: (c: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)) as T, [colors, factory]);
}
