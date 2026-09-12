import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type GgrAlertType } from '@astro/shared';
import { colors } from '../../../../theme';
import { ggrAlertStyles as styles } from './styles';

export type GgrAppliedFilters = {
  startDate: string;
  endDate: string;
  userId: string;
  clientName: string;
  type: GgrAlertType;
};

type Props = {
  open: boolean;
  onToggleOpen: () => void;
  total: number;
  applied: GgrAppliedFilters;
  startDate: string;
  endDate: string;
  filterUserId: string;
  filterClient: string;
  filterType: GgrAlertType;
  pageSize: number;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onUserIdChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onTypeChange: (value: GgrAlertType) => void;
  onPageSizeChange: (value: number) => void;
  onClear: () => void;
  onApply: () => void;
};

export function GgrLogsFiltersPanel({
  open,
  onToggleOpen,
  total,
  applied,
  startDate,
  endDate,
  filterUserId,
  filterClient,
  filterType,
  pageSize,
  onStartDateChange,
  onEndDateChange,
  onUserIdChange,
  onClientChange,
  onTypeChange,
  onPageSizeChange,
  onClear,
  onApply,
}: Props) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.collapseHead} onPress={onToggleOpen} activeOpacity={0.75}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.collapseTitle}>Alert Logs · {total.toLocaleString('en-IN')}</Text>
          <Text style={styles.collapseSummary} numberOfLines={1}>
            {applied.startDate} → {applied.endDate}
            {applied.type ? ` · ${applied.type}` : ' · All'}
            {applied.userId ? ` · ${applied.userId}` : ''}
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
          <Text style={styles.fieldLabel}>Start (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={onStartDateChange}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>End (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={onEndDateChange}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>User ID</Text>
          <TextInput
            style={styles.input}
            value={filterUserId}
            onChangeText={onUserIdChange}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Client</Text>
          <TextInput
            style={styles.input}
            value={filterClient}
            onChangeText={onClientChange}
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.modeRow}>
            {(['', 'casino', 'sattamatka'] as GgrAlertType[]).map((t) => (
              <TouchableOpacity
                key={t || 'all'}
                style={[styles.modeBtn, filterType === t && styles.modeBtnActive]}
                onPress={() => onTypeChange(t)}
              >
                <Text style={[styles.modeBtnText, filterType === t && styles.modeBtnTextActive]}>
                  {t === '' ? 'All' : t === 'casino' ? 'Casino' : 'Satta'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Per page</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[10, 20, 50, 100].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.modeBtn, pageSize === n && styles.modeBtnActive, { marginRight: 8 }]}
                onPress={() => onPageSizeChange(n)}
              >
                <Text style={[styles.modeBtnText, pageSize === n && styles.modeBtnTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={onClear}>
              <Text style={styles.formBtnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary]} onPress={onApply}>
              <Text style={styles.formBtnPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}
