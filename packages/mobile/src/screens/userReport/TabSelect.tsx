import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './TabSelect.styles';

type Props<T extends string> = {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
};

/** Compact report-tab picker. Lives beside the user name without overlapping it. */
export function TabSelect<T extends string>({ value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.btnText} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Select report</Text>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt) => {
                const active = opt === value;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.rowText, active && styles.rowTextActive]}
                      numberOfLines={1}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

