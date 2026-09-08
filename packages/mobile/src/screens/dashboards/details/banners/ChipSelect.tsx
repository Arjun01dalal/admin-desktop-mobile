/** Single-select chip row used by the Banners add/edit forms. */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../BannersScreen.styles';

export function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[] | readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <View style={styles.chipsRow}>
      {normalized.map((o, oi) => (
        <TouchableOpacity
          key={`chip-${oi}-${o.value || o.label}`}
          style={[styles.chip, value === o.value && styles.chipActive]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[styles.chipText, value === o.value && styles.chipTextActive]}>
            {o.label || 'None'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
