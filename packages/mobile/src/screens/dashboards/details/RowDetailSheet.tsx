/**
 * Bottom-sheet modal showing every field of a tapped list row.
 * Used by the user-list detail screens: the table shows only the main
 * columns; tapping a row opens this sheet with the full desktop column set.
 */
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';

export type SheetField = { label: string; value: string; color?: string };

type Props = {
  visible: boolean;
  title: string;
  fields: SheetField[];
  onClose: () => void;
};

export function RowDetailSheet({ visible, title, fields, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing(8) }}>
            {fields.map((f) => (
              <View key={f.label} style={styles.fieldRow}>
                <Text style={styles.label}>{f.label}</Text>
                <Text style={[styles.value, f.color ? { color: f.color } : null]} selectable>
                  {f.value || '—'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing(2),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1 },
  close: { color: colors.muted, fontSize: 18, paddingHorizontal: spacing(2) },
  scroll: { marginTop: spacing(1) },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 13, flexShrink: 0, maxWidth: '45%' },
  value: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});
