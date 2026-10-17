import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../../theme';
import { COMMENT_OPTIONS, PAGE_SIZES, STATUS_OPTIONS } from './helpers';
import { styles } from '../CallLogsScreen.styles';

export type CallLogTextFilter = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboard?: 'phone-pad' | 'number-pad';
};

type SearchFiltersProps = {
  open: boolean;
  loading: boolean;
  textFilters: CallLogTextFilter[];
  selectedStatus: string;
  commentFilter: string;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
  onCommentChange: (comment: string) => void;
  onClear: () => void;
  onSearch: () => void;
};

export function SearchFilters({
  open,
  loading,
  textFilters,
  selectedStatus,
  commentFilter,
  onToggle,
  onStatusChange,
  onCommentChange,
  onClear,
  onSearch,
}: SearchFiltersProps) {
  return (
    <>
      <TouchableOpacity style={styles.collapseHeader} onPress={onToggle}>
        <Text style={styles.collapseTitle}>Search Filters {open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.filterCard}>
          {textFilters.map((filter) => (
            <View key={filter.label} style={styles.filterRow}>
              <Text style={styles.filterLabel}>{filter.label}</Text>
              <TextInput
                style={styles.filterInput}
                value={filter.value}
                onChangeText={filter.onChangeText}
                placeholder={filter.label}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={filter.keyboard ?? 'default'}
              />
            </View>
          ))}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Status</Text>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.chip, selectedStatus === status && styles.chipActive]}
                  onPress={() => onStatusChange(status)}
                >
                  <Text
                    style={[styles.chipText, selectedStatus === status && styles.chipTextActive]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Comment</Text>
              {['All', ...COMMENT_OPTIONS].map((comment) => (
                <TouchableOpacity
                  key={comment}
                  style={[styles.chip, commentFilter === comment && styles.chipActive]}
                  onPress={() => onCommentChange(comment)}
                >
                  <Text
                    style={[styles.chipText, commentFilter === comment && styles.chipTextActive]}
                  >
                    {comment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={onClear} disabled={loading}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}

type PageSizePickerProps = {
  pageSize: number;
  onChange: (pageSize: number) => void;
};

export function PageSizePicker({ pageSize, onChange }: PageSizePickerProps) {
  return (
    <View style={styles.chipRowSpaced}>
      <Text style={styles.chipRowLabel}>Per page</Text>
      {PAGE_SIZES.map((size) => (
        <TouchableOpacity
          key={size}
          style={[styles.chip, pageSize === size && styles.chipActive]}
          onPress={() => onChange(size)}
        >
          <Text style={[styles.chipText, pageSize === size && styles.chipTextActive]}>{size}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
