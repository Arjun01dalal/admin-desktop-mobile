/**
 * Bottom-sheet modal showing every field of a tapped list row.
 * Used by the user-list detail screens: the table shows only the main
 * columns; tapping a row opens this sheet with the full desktop column set.
 */
import React, { type ReactNode } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing} from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { styles } from './RowDetailSheet.styles';

export type SheetField = {
  label: string;
  value: string;
  color?: string;
  /** Renders the value as a colored pill (e.g. call status badge). */
  badgeColor?: string;
  /** Long text: label on top, full-width left-aligned value below. */
  multiline?: boolean;
  /** Allow OS text selection / long-press copy. Defaults to true. */
  selectable?: boolean;
  /** Show a copy icon next to the value; copies `copyValue` or `value`. */
  copyable?: boolean;
  /** Optional raw string to copy (defaults to `value`). */
  copyValue?: string;
};

export type SheetAction = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'warning' | 'danger' | 'default';
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
  /** Optional image shown at the top of the sheet (e.g. game artwork). */
  imageUri?: string;
  /** Extra content (e.g. multi-select chips) rendered above actions. */
  footer?: ReactNode;
};

function canCopy(field: SheetField): boolean {
  if (!field.copyable) return false;
  const raw = String(field.copyValue ?? field.value ?? '').trim();
  return Boolean(raw) && raw !== '—';
}

async function copyField(field: SheetField): Promise<void> {
  const raw = String(field.copyValue ?? field.value ?? '').trim();
  if (!raw || raw === '—') return;
  try {
    await Clipboard.setStringAsync(raw);
    Alert.alert('Copied', `${toDisplayText(field.label)} copied`);
  } catch {
    Alert.alert('Copy failed', 'Unable to copy to clipboard');
  }
}

function CopyButton({ field }: { field: SheetField }) {
  if (!canCopy(field)) return null;
  return (
    <TouchableOpacity
      onPress={() => void copyField(field)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={`Copy ${field.label}`}
      style={styles.copyBtn}
    >
      <MaterialCommunityIcons name="content-copy" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

export function RowDetailSheet({
  visible,
  title,
  fields,
  onClose,
  action,
  actions,
  note,
  imageUri,
  footer,
}: Props) {
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
              {toDisplayText(title)}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: spacing(8) }}
            showsVerticalScrollIndicator={false}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            ) : null}
            {footer}
            {actions && actions.length > 0 ? (
              <View style={styles.actionsRow}>
                {actions.map((a, ai) => (
                  <TouchableOpacity
                    key={`action-${ai}-${a.label}`}
                    style={[
                      styles.actionBtn,
                      a.tone === 'primary' && styles.actionBtnPrimary,
                      a.tone === 'warning' && styles.actionBtnWarning,
                      a.tone === 'danger' && styles.actionBtnDanger,
                      a.disabled && styles.actionBtnDisabled,
                    ]}
                    onPress={a.onPress}
                    disabled={a.disabled}
                    delayPressIn={0}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        a.tone === 'primary' && styles.actionBtnTextPrimary,
                        a.tone === 'warning' && styles.actionBtnTextWarning,
                        a.tone === 'danger' && styles.actionBtnTextDanger,
                      ]}
                    >
                      {toDisplayText(a.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {note ? <Text style={styles.note}>{note}</Text> : null}
            {fields.map((f, fi) =>
              f.multiline ? (
                <View key={`field-${fi}-${f.label}`} style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.label}>{toDisplayText(f.label)}</Text>
                    <CopyButton field={f} />
                  </View>
                  <Text
                    style={[styles.blockValue, f.color ? { color: f.color } : null]}
                    selectable={f.selectable !== false}
                  >
                    {f.value ? toDisplayText(f.value) : '—'}
                  </Text>
                </View>
              ) : (
                <View key={`field-${fi}-${f.label}`} style={styles.fieldRow}>
                  <Text style={styles.label}>{toDisplayText(f.label)}</Text>
                  {f.badgeColor ? (
                    <View style={styles.valueSide}>
                      <View style={[styles.valueBadge, { backgroundColor: f.badgeColor }]}>
                        <Text style={styles.valueBadgeText}>
                          {f.value ? toDisplayText(f.value) : '—'}
                        </Text>
                      </View>
                      <CopyButton field={f} />
                    </View>
                  ) : (
                    <View style={styles.valueSide}>
                      <Text
                        style={[styles.value, f.color ? { color: f.color } : null]}
                        selectable={f.selectable !== false}
                      >
                        {f.value ? toDisplayText(f.value) : '—'}
                      </Text>
                      <CopyButton field={f} />
                    </View>
                  )}
                </View>
              ),
            )}
            {action ? (
              <TouchableOpacity style={styles.singleActionBtn} onPress={action.onPress}>
                <Text style={styles.singleActionText}>{toDisplayText(action.label)}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

