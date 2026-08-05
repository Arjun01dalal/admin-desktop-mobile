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

export type SheetField = {
  label: string;
  value: string;
  color?: string;
  /** Renders the value as a colored pill (e.g. call status badge). */
  badgeColor?: string;
};

export type SheetAction = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'warning' | 'default';
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  fields: SheetField[];
  onClose: () => void;
  /** Optional action button rendered at the bottom of the sheet (e.g. drill-downs). */
  action?: SheetAction;
  /** Optional action buttons rendered above the field list. */
  actions?: SheetAction[];
  /** Optional muted note rendered under the actions (e.g. desktop-only features). */
  note?: string;
};

export function RowDetailSheet({ visible, title, fields, onClose, action, actions, note }: Props) {
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
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: spacing(8) }}
            showsVerticalScrollIndicator={false}
          >
            {actions && actions.length > 0 ? (
              <View style={styles.actionsRow}>
                {actions.map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    style={[
                      styles.actionBtn,
                      a.tone === 'primary' && styles.actionBtnPrimary,
                      a.tone === 'warning' && styles.actionBtnWarning,
                      a.disabled && styles.actionBtnDisabled,
                    ]}
                    onPress={a.onPress}
                    disabled={a.disabled}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        a.tone === 'primary' && styles.actionBtnTextPrimary,
                        a.tone === 'warning' && styles.actionBtnTextWarning,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {note ? <Text style={styles.note}>{note}</Text> : null}
            {fields.map((f) => (
              <View key={f.label} style={styles.fieldRow}>
                <Text style={styles.label}>{f.label}</Text>
                {f.badgeColor ? (
                  <View style={[styles.valueBadge, { backgroundColor: f.badgeColor }]}>
                    <Text style={styles.valueBadgeText}>{f.value || '—'}</Text>
                  </View>
                ) : (
                  <Text style={[styles.value, f.color ? { color: f.color } : null]} selectable>
                    {f.value || '—'}
                  </Text>
                )}
              </View>
            ))}
            {action ? (
              <TouchableOpacity style={styles.singleActionBtn} onPress={action.onPress}>
                <Text style={styles.singleActionText}>{action.label}</Text>
              </TouchableOpacity>
            ) : null}
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
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    paddingVertical: spacing(2.5),
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    backgroundColor: colors.surfaceAlt,
  },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnWarning: { backgroundColor: '#facc15', borderColor: '#facc15' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  actionBtnTextPrimary: { color: colors.primaryForeground },
  actionBtnTextWarning: { color: '#111' },
  note: {
    color: colors.muted,
    fontSize: 11,
    paddingBottom: spacing(2),
  },
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
  valueBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  valueBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  singleActionBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  singleActionText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
