import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatGgrDateTime, type GgrSubAdminOption } from '@astro/shared';
import { colors } from '../../../../theme';
import { ggrAlertStyles as styles } from './styles';

type Props = {
  open: boolean;
  onToggleOpen: () => void;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  selectedIds: string[];
  selectedOptions: GgrSubAdminOption[];
  telegramChatIds: number[];
  telegramInput: string;
  onTelegramInputChange: (value: string) => void;
  onAddTelegram: () => void;
  onRemoveTelegram: (id: number) => void;
  onOpenSubAdminPicker: () => void;
  onToggleSubAdmin: (id: string) => void;
  onClearSubAdmins: () => void;
  meta: { updatedBy?: string; updatedAt?: string };
  loading: boolean;
  saving: boolean;
  onReload: () => void;
  onSave: () => void;
};

export function GgrRecipientsPanel({
  open,
  onToggleOpen,
  enabled,
  onEnabledChange,
  selectedIds,
  selectedOptions,
  telegramChatIds,
  telegramInput,
  onTelegramInputChange,
  onAddTelegram,
  onRemoveTelegram,
  onOpenSubAdminPicker,
  onToggleSubAdmin,
  onClearSubAdmins,
  meta,
  loading,
  saving,
  onReload,
  onSave,
}: Props) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.collapseHead} onPress={onToggleOpen} activeOpacity={0.75}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.collapseTitle}>Recipients & Config</Text>
          <Text style={styles.collapseSummary} numberOfLines={1}>
            {enabled ? 'Live' : 'Paused'} · {selectedIds.length} sub-admins · {telegramChatIds.length}{' '}
            telegram
          </Text>
        </View>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.muted}
        />
      </TouchableOpacity>

      {open ? (
        <>
          <View style={styles.enabledRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enabledTitle}>Alerts {enabled ? 'enabled' : 'disabled'}</Text>
              <Text style={styles.enabledSub}>Toggle delivery without clearing list</Text>
            </View>
            <Switch value={enabled} onValueChange={onEnabledChange} />
          </View>

          <Text style={styles.fieldLabel}>Sub-Admins</Text>
          <TouchableOpacity style={styles.dropdownTrigger} onPress={onOpenSubAdminPicker} activeOpacity={0.75}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dropdownValue} numberOfLines={1}>
                {selectedIds.length === 0 ? 'Select sub-admins' : `${selectedIds.length} selected`}
              </Text>
              {selectedOptions.length > 0 ? (
                <Text style={styles.dropdownPreview} numberOfLines={1}>
                  {selectedOptions.map((o) => o.label).join(', ')}
                </Text>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-down" size={22} color={colors.muted} />
          </TouchableOpacity>

          {selectedOptions.length > 0 ? (
            <View style={styles.selectedWrap}>
              {selectedOptions.map((opt) => (
                <TouchableOpacity
                  key={`sel-${opt.id}`}
                  style={styles.selectedChip}
                  onPress={() => onToggleSubAdmin(opt.id)}
                  accessibilityLabel={`Remove ${opt.label}`}
                >
                  <Text style={styles.selectedChipText} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={onClearSubAdmins} hitSlop={8} style={styles.clearChip}>
                <Text style={styles.clearLink}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Telegram Chat IDs</Text>
          <View style={styles.chipWrap}>
            {telegramChatIds.map((id) => (
              <TouchableOpacity key={id} style={styles.pickChip} onPress={() => onRemoveTelegram(id)}>
                <Text style={styles.pickChipText}>{id} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0 }]}
              value={telegramInput}
              onChangeText={onTelegramInputChange}
              placeholder="Chat ID"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={onAddTelegram}
            />
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnGhost, { flex: 0, paddingHorizontal: 16 }]}
              onPress={onAddTelegram}
            >
              <Text style={styles.formBtnGhostText}>Add</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.metaLine}>
            Updated by {meta.updatedBy || '—'} · {formatGgrDateTime(meta.updatedAt)}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnGhost]}
              onPress={onReload}
              disabled={loading || saving}
            >
              <Text style={styles.formBtnGhostText}>Reload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnPrimary, saving && styles.btnDisabled]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.formBtnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}
