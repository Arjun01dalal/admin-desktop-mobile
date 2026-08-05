/**
 * In-screen date/filter controls for dashboard detail screens.
 * Reuses the visual pattern from src/dashboards/ui/FilterBar.tsx:
 * From/To date inputs + Apply, optional app chips and per-page chips
 * (matching desktop's App / Per-page selectors on user list pages).
 */
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLIENT_NAMES, appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors desktop ITEMS_PER_PAGE_OPTIONS (subset that makes sense on mobile). */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

type Props = {
  startDate: string;
  endDate: string;
  loading?: boolean;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onApply: () => void;
  /** When provided, renders the app filter chips (All Apps + client apps). */
  appClientName?: string;
  onAppChange?: (v: string) => void;
  /** When provided, renders per-page chips. */
  pageSize?: number;
  onPageSizeChange?: (v: number) => void;
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

export function DetailFilterBar(props: Props) {
  const {
    startDate,
    endDate,
    loading,
    onStartDateChange,
    onEndDateChange,
    onApply,
    appClientName,
    onAppChange,
    pageSize,
    onPageSizeChange,
  } = props;

  const datesValid = DATE_RE.test(startDate) && DATE_RE.test(endDate);

  return (
    <View style={styles.wrap}>
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
        <TouchableOpacity
          style={[styles.applyBtn, (!datesValid || loading) && styles.btnDisabled]}
          onPress={onApply}
          disabled={!datesValid || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.applyText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>

      {onAppChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Chip label="All Apps" active={!appClientName} onPress={() => onAppChange('')} />
          {CLIENT_NAMES.map((name) => (
            <Chip
              key={name}
              label={appCodeForName(name)}
              active={appClientName === name}
              onPress={() => onAppChange(name)}
            />
          ))}
        </ScrollView>
      ) : null}

      {onPageSizeChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Text style={styles.rowLabel}>Per page</Text>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <Chip
              key={n}
              label={String(n)}
              active={pageSize === n}
              onPress={() => onPageSizeChange(n)}
            />
          ))}
        </ScrollView>
      ) : null}
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
    marginTop: spacing(3),
  },
  datesRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-end' },
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
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  row: { gap: spacing(2), alignItems: 'center' },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
});
