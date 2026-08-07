/**
 * Mobile dashboard filter bar — date range presets + custom dates,
 * app selector, optional provider filter. Mirrors desktop DashboardFilterBar.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../theme';
import { PROVIDER_FILTERS } from '../constants';
import type { ProviderFilter } from '../types';
import { daysAgoIST, monthStartIST, todayIST } from '../../utils/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Preset = { label: string; start: () => string; end: () => string };
const PRESETS: Preset[] = [
  { label: 'Today', start: todayIST, end: todayIST },
  { label: 'Yesterday', start: () => daysAgoIST(1), end: () => daysAgoIST(1) },
  { label: '7D', start: () => daysAgoIST(6), end: todayIST },
  { label: 'MTD', start: monthStartIST, end: todayIST },
  { label: '30D', start: () => daysAgoIST(29), end: todayIST },
];

type Props = {
  startDate: string;
  endDate: string;
  appClientName: string;
  filterBy: ProviderFilter;
  appOptions: readonly string[];
  showProviderFilter?: boolean;
  loading?: boolean;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onAppChange: (v: string) => void;
  onFilterByChange: (v: ProviderFilter) => void;
  onApply: () => void;
  onAllData: () => void;
  onRefresh?: () => void;
};

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FilterBar(props: Props) {
  const {
    startDate,
    endDate,
    appClientName,
    filterBy,
    appOptions,
    showProviderFilter,
    loading,
    onStartDateChange,
    onEndDateChange,
    onAppChange,
    onFilterByChange,
    onApply,
    onAllData,
    onRefresh,
  } = props;
  const [showCustom, setShowCustom] = useState(false);

  const activePreset = PRESETS.find(
    (p) => p.start() === startDate && p.end() === endDate,
  )?.label;

  const datesValid = DATE_RE.test(startDate) && DATE_RE.test(endDate);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            active={activePreset === p.label && !showCustom}
            onPress={() => {
              setShowCustom(false);
              onStartDateChange(p.start());
              onEndDateChange(p.end());
            }}
          />
        ))}
        <Chip
          label="Custom"
          active={showCustom || !activePreset}
          onPress={() => setShowCustom((v) => !v)}
        />
      </ScrollView>

      {(showCustom || !activePreset) && (
        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={onStartDateChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To</Text>
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={onEndDateChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="All Apps" active={!appClientName} onPress={() => onAppChange('')} />
        {appOptions.map((name) => (
          <Chip
            key={name}
            label={appCodeForName(name)}
            active={appClientName === name}
            onPress={() => onAppChange(name)}
          />
        ))}
      </ScrollView>

      {showProviderFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {PROVIDER_FILTERS.map((name) => (
            <Chip
              key={name}
              label={name}
              active={filterBy === name}
              onPress={() => onFilterByChange(name)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.applyBtn, !datesValid && styles.btnDisabled]}
          onPress={onApply}
          disabled={!datesValid || loading}
        >
          <Text style={styles.applyText}>Apply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={onAllData} disabled={loading}>
          <Text style={styles.outlineText}>All Data</Text>
        </TouchableOpacity>
        {onRefresh && (
          <TouchableOpacity style={styles.outlineBtn} onPress={onRefresh} disabled={loading}>
            <Text style={styles.outlineText}>Refresh</Text>
          </TouchableOpacity>
        )}
        {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  row: { gap: spacing(2), alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  datesRow: { flexDirection: 'row', gap: spacing(2) },
  dateField: { flex: 1 },
  dateLabel: { color: colors.muted, fontSize: 11, marginBottom: spacing(1) },
  dateInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(2.5),
  },
  btnDisabled: { opacity: 0.5 },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  outlineText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
});
