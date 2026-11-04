/**
 * Bottom-sheet modal showing every field of a tapped list row.
 * Used by the user-list detail screens: the table shows only the main
 * columns; tapping a row opens this sheet with the full desktop column set.
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '../../../components/CachedImage';
import { colors, spacing } from '../../../theme';
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
  /**
   * When set, show only the first N items (lines), then a More control that
   * opens a nested modal with the full list (Deposit Providers long lists).
   */
  listItems?: string[];
  /** How many items to preview before More (default 3). */
  listPreviewCount?: number;
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

type ListExpand = { title: string; items: string[] };

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

function ListFieldValue({
  field,
  onExpand,
}: {
  field: SheetField;
  onExpand: (expand: ListExpand) => void;
}) {
  const items = (field.listItems || []).map((v) => String(v).trim()).filter(Boolean);
  const previewCount = Math.max(1, field.listPreviewCount ?? 3);
  if (!items.length) {
    return <Text style={styles.blockValue}>—</Text>;
  }
  const preview = items.slice(0, previewCount);
  const hasMore = items.length > previewCount;
  return (
    <View style={styles.listPreviewRow}>
      <Text
        style={[styles.listPreviewText, field.color ? { color: field.color } : null]}
        selectable={field.selectable !== false}
      >
        {preview.map((v) => toDisplayText(v)).join('\n')}
      </Text>
      {hasMore ? (
        <TouchableOpacity
          style={styles.listMoreBtn}
          onPress={() => onExpand({ title: field.label, items })}
          accessibilityLabel={`Show all ${field.label}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.listMoreText}>+{items.length - previewCount}</Text>
          <MaterialCommunityIcons name="dots-horizontal" size={16} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
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
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, spacing(3));
  const [listExpand, setListExpand] = useState<ListExpand | null>(null);

  useEffect(() => {
    if (!visible) setListExpand(null);
  }, [visible]);

  const closeAll = () => {
    setListExpand(null);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeAll}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={closeAll}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>
                {toDisplayText(title)}
              </Text>
              <TouchableOpacity
                onPress={closeAll}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: spacing(8) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {imageUri ? (
                <CachedImage
                  source={{ uri: imageUri }}
                  style={styles.image}
                  resizeMode="contain"
                  recyclingKey={imageUri}
                />
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
                f.multiline || (f.listItems && f.listItems.length > 0) ? (
                  <View key={`field-${fi}-${f.label}`} style={styles.fieldBlock}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.label}>{toDisplayText(f.label)}</Text>
                      <CopyButton field={f} />
                    </View>
                    {f.listItems && f.listItems.length > 0 ? (
                      <ListFieldValue field={f} onExpand={setListExpand} />
                    ) : (
                      <Text
                        style={[styles.blockValue, f.color ? { color: f.color } : null]}
                        selectable={f.selectable !== false}
                      >
                        {f.value ? toDisplayText(f.value) : '—'}
                      </Text>
                    )}
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

      <Modal
        visible={listExpand !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setListExpand(null)}
      >
        <View style={styles.listExpandBackdrop}>
          <TouchableWithoutFeedback onPress={() => setListExpand(null)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.listExpandCard, { marginBottom: bottomPad }]}>
            <View style={styles.listExpandHeader}>
              <Text style={styles.listExpandTitle} numberOfLines={1}>
                {listExpand ? toDisplayText(listExpand.title) : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setListExpand(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.listExpandBody}
              contentContainerStyle={{ paddingBottom: spacing(4) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(listExpand?.items || []).map((item, index) => (
                <Text
                  key={`list-item-${index}-${item}`}
                  style={styles.listExpandItem}
                  selectable
                >
                  {toDisplayText(item)}
                </Text>
              ))}
            </ScrollView>
            <Text style={styles.listExpandCount}>
              {listExpand ? `${listExpand.items.length} items` : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
