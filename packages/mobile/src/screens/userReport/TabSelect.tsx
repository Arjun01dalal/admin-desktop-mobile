import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';

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
                    <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
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

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 180,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: spacing(2.5),
    paddingRight: spacing(2),
    paddingVertical: spacing(1.75),
    gap: spacing(1),
  },
  btnText: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: { color: colors.muted, fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    paddingTop: spacing(3),
    overflow: 'hidden',
  },
  sheetTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(1),
  },
  list: { paddingBottom: spacing(2) },
  row: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.25),
  },
  rowActive: { backgroundColor: `${colors.primary}22` },
  rowText: { color: colors.foreground, fontSize: 14 },
  rowTextActive: { color: colors.primary, fontWeight: '700' },
});
