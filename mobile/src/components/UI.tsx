import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  style?: ViewStyle;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && { backgroundColor: colors.primary },
        variant === 'outline' && {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.primaryForeground : colors.foreground} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: isPrimary ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(4),
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  errorText: { color: '#fca5a5', fontSize: 14 },
});
