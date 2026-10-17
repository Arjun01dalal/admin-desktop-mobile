import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { C2cCallerOption } from '@astro/shared';

import { colors } from '../../../../theme';
import { styles } from './styles';

export type C2cCampaignFormValues = {
  name: string;
  isActive: boolean;
  callerIds: string[];
};

type Props = {
  visible: boolean;
  title: string;
  submitLabel: string;
  values: C2cCampaignFormValues;
  callers: C2cCallerOption[];
  saving?: boolean;
  onChange: (next: C2cCampaignFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function C2cCampaignFormModal({
  visible,
  title,
  submitLabel,
  values,
  callers,
  saving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const toggleCaller = (id: string) => {
    const on = values.callerIds.includes(id);
    onChange({
      ...values,
      callerIds: on ? values.callerIds.filter((x) => x !== id) : [...values.callerIds, id],
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={values.name}
              onChangeText={(name) => onChange({ ...values, name })}
              placeholder="Campaign name"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch
                value={values.isActive}
                onValueChange={(isActive) => onChange({ ...values, isActive })}
              />
            </View>
            <Text style={styles.fieldLabel}>
              Callers ({values.callerIds.length} selected)
            </Text>
            <View style={styles.chipRow}>
              {callers.length ? (
                callers.map((c) => {
                  const on = values.callerIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.callerChip, on && styles.callerChipOn]}
                      onPress={() => toggleCaller(c.id)}
                    >
                      <Text style={[styles.callerChipText, on && styles.callerChipTextOn]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.cardMeta}>No callers found</Text>
              )}
            </View>
          </ScrollView>
          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnGhost]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.formBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnPrimary]}
              onPress={onSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.formBtnPrimaryText}>{submitLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
