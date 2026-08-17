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
import { CLIENT_NAMES, appCodeForName, pickPageSizes } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DateField } from '../../../components/DateField';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mobile page-size chips — shared pagination, compact subset for small screens. */
export const PAGE_SIZE_OPTIONS = pickPageSizes([10, 25, 50, 100, 200]);


/** One search field option; `key` is sent as the server-side filter key (mirrors desktop). */
export type SearchFieldOption = { key: string; label: string };
export type SearchFieldKey = string;

/** Default search fields (used by screens without a desktop per-column filter set). */
export const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'city', label: 'City' },
];

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
  /** Per-screen search field set (defaults to SEARCH_FIELDS). */
  searchFields?: readonly SearchFieldOption[];
  /** When provided, renders the search row (field chips + text input + Search). */
  searchField?: SearchFieldKey;
  onSearchFieldChange?: (v: SearchFieldKey) => void;
  searchText?: string;
  onSearchTextChange?: (v: string) => void;
  onSearchSubmit?: () => void;
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
    searchFields = SEARCH_FIELDS,
    searchField,
    onSearchFieldChange,
    searchText,
    onSearchTextChange,
    onSearchSubmit,
  } = props;

  const datesValid = DATE_RE.test(startDate) && DATE_RE.test(endDate);

  return (
    <View style={styles.wrap}>
      <View style={styles.datesRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>From</Text>
          <DateField style={styles.dateInput} value={startDate} onChange={onStartDateChange} />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>To</Text>
          <DateField style={styles.dateInput} value={endDate} onChange={onEndDateChange} />
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

      {onSearchTextChange && onSearchSubmit ? (
        <View style={styles.searchWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            <Text style={styles.rowLabel}>Search by</Text>
            {searchFields.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                active={searchField === f.key}
                onPress={() => onSearchFieldChange?.(f.key)}
              />
            ))}
          </ScrollView>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={[styles.dateInput, styles.searchInput]}
                value={searchText ?? ''}
                onChangeText={onSearchTextChange}
                onSubmitEditing={onSearchSubmit}
                returnKeyType="search"
                placeholder={`Search ${
                  searchFields.find((f) => f.key === searchField)?.label ?? 'name'
                }…`}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={searchField === 'mobile' ? 'phone-pad' : 'default'}
              />
              {Boolean(searchText?.trim()) ? (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => onSearchTextChange('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.applyBtn, loading && styles.btnDisabled]}
              onPress={onSearchSubmit}
              disabled={loading}
            >
              <Text style={styles.applyText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {onAppChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Chip label="All Apps" active={!appClientName} onPress={() => onAppChange('')} />
          {CLIENT_NAMES.map((name, i) => (
            <Chip
              key={`app-${i}-${name}`}
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
  row: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  searchWrap: { gap: spacing(2) },
  searchRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    flex: undefined,
    width: '100%',
    paddingRight: spacing(9),
  },
  clearSearchBtn: {
    position: 'absolute',
    right: spacing(2),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
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
