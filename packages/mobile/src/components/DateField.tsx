/**
 * Date input field — opens the native date picker (calendar) instead of a
 * free-text input. Value in/out is always 'YYYY-MM-DD'.
 * Web fallback: a real <input type="date"> via TextInput is not possible, so
 * we keep a plain TextInput there (workspace preview only).
 */
import React, { useState } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme';
import { styles } from './DateField.styles';

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
  disabled?: boolean;
};

export function DateField({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  style,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={[styles.input, style, disabled && styles.inputDisabled]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.input, style, disabled && styles.inputDisabled]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'dismissed' || !selected) return;
            onChange(toYmd(selected));
          }}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.pickerCard}>
              <DateTimePicker
                value={parseYmd(value)}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                themeVariant="dark"
                accentColor={colors.primary}
                style={styles.iosPicker}
                onChange={(event, selected) => {
                  if (!selected) return;
                  onChange(toYmd(selected));
                  setOpen(false);
                }}
              />
              <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

