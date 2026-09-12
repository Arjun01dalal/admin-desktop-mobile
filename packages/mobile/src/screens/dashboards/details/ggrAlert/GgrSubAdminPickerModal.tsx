import React, { useCallback } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { GgrSubAdminOption } from '@astro/shared';
import { colors } from '../../../../theme';
import { ggrAlertStyles as styles } from './styles';

type Props = {
  visible: boolean;
  options: GgrSubAdminOption[];
  filteredOptions: GgrSubAdminOption[];
  selectedIds: string[];
  selectedSet: Set<string>;
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
};

export function GgrSubAdminPickerModal({
  visible,
  options,
  filteredOptions,
  selectedIds,
  selectedSet,
  search,
  onSearchChange,
  onToggle,
  onClose,
}: Props) {
  const keyExtractor = useCallback((item: GgrSubAdminOption) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: GgrSubAdminOption }) => {
      const on = selectedSet.has(item.id);
      return (
        <TouchableOpacity
          style={[styles.pickerRow, on && styles.pickerRowOn]}
          onPress={() => onToggle(item.id)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={22}
            color={on ? colors.primary : colors.muted}
          />
          <Text style={[styles.pickerLabel, on && styles.pickerLabelOn]} numberOfLines={1}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [onToggle, selectedSet],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.dropdownBackdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.dropdownBackdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.dropdownSheet}>
          <View style={styles.dropdownHandle} />
          <View style={styles.dropdownSheetHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dropdownSheetTitle}>Sub-Admins</Text>
              <Text style={styles.dropdownSheetMeta}>
                {selectedIds.length} selected
                {options.length ? ` · ${options.length} total` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.dropdownDoneBtn}>
              <Text style={styles.dropdownDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search sub-admins"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            style={styles.dropdownList}
            data={filteredOptions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={24}
            windowSize={8}
            ListEmptyComponent={
              <Text style={styles.hintLine}>
                {options.length === 0 ? 'Loading sub-admins…' : 'No matches'}
              </Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}
