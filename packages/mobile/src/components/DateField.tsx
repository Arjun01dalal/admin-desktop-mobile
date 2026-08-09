/**
 * Date input field — opens the native date picker (calendar) instead of a
 * free-text input. Value in/out is always 'YYYY-MM-DD'.
 * Web fallback: a real <input type="date"> via TextInput is not possible, so
 * we keep a plain TextInput there (workspace preview only).
 */
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing } from '../theme';

function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseYmd(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return new Date(2026, 0, 1);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
};

export function DateField({ value, onChange, placeholder = 'YYYY-MM-DD', style }: Props) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    );
  }

  return (
    <>
      <TouchableOpacity style={[styles.input, style]} onPress={() => setOpen(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'dismissed' || !selected) return;
            onChange(toYmd(selected));
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    justifyContent: 'center',
  },
  valueText: { color: colors.foreground, fontSize: 13 },
  placeholderText: { color: colors.muted, fontSize: 13 },
});
