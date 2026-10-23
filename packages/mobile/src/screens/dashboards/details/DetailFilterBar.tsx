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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLIENT_NAMES, appCodeForName, pickPageSizes } from '@astro/shared';
import { colors } from '../../../theme';
import { DateField } from '../../../components/DateField';
import { styles } from './DetailFilterBar.styles';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mobile page-size chips — shared pagination, compact subset for small screens. */
/** Mobile lists are card/table-mapped — keep page sizes small for JS/thread health. */
export const PAGE_SIZE_OPTIONS = pickPageSizes([10, 25, 50]);

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
  /** When provided, shows All Data (fetch without date range). */
  onAllData?: () => void;
  /** When provided, shows Clear Dates (clear date inputs only). */
  onClearDates?: () => void;
  /** When provided, shows Clear All Filters (reset dates + search/status filters). */
  onClearAllFilters?: () => void;
  /** When provided, renders the app filter chips (All Apps + client apps). */
  appClientName?: string;
  onAppChange?: (v: string) => void;
  /** When provided, renders per-page chips. */
  pageSize?: number;
  onPageSizeChange?: (v: number) => void;
  /** Override default PAGE_SIZE_OPTIONS when provided. */
  pageSizeOptions?: readonly number[];
  /** Per-screen search field set (defaults to SEARCH_FIELDS). */
  searchFields?: readonly SearchFieldOption[];
  /** When provided, renders the search row (field chips + text input + Search). */
  searchField?: SearchFieldKey;
  onSearchFieldChange?: (v: SearchFieldKey) => void;
  searchText?: string;
  onSearchTextChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  /** Collapsible filter box (Gtel / Played pattern). */
  collapsible?: boolean;
  /** Controlled expanded state when collapsible. */
  filtersExpanded?: boolean;
  onToggleFilters?: () => void;
  /** Header label when collapsible (default 'Filters'). */
  filtersTitle?: string;
  /** Extra controls inside the expanded body (after dates/search). */
  children?: React.ReactNode;
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
    onAllData,
    onClearDates,
    onClearAllFilters,
    appClientName,
    onAppChange,
    pageSize,
    onPageSizeChange,
    pageSizeOptions,
    searchFields = SEARCH_FIELDS,
    searchField,
    onSearchFieldChange,
    searchText,
    onSearchTextChange,
    onSearchSubmit,
    collapsible,
    filtersExpanded,
    onToggleFilters,
    filtersTitle = 'Filters',
    children,
  } = props;

  const bothEmpty = !startDate.trim() && !endDate.trim();
  const allowEmptyDates = Boolean(onAllData || onClearDates || onClearAllFilters);
  const datesValid =
    (allowEmptyDates && bothEmpty) ||
    (DATE_RE.test(startDate) && DATE_RE.test(endDate));
  const showDateActions = Boolean(onAllData || onClearDates || onClearAllFilters);
  const sizeOptions = pageSizeOptions?.length ? pageSizeOptions : PAGE_SIZE_OPTIONS;
  const expanded = !collapsible || Boolean(filtersExpanded);

  const body = (
    <>
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

      {showDateActions ? (
        <View style={styles.actionBtnsRow}>
          {onAllData ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.actionBtnFlex, loading && styles.btnDisabled]}
              onPress={onAllData}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="All Data"
            >
              <Text style={styles.secondaryBtnText}>All Data</Text>
            </TouchableOpacity>
          ) : null}
          {onClearDates ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.actionBtnFlex, loading && styles.btnDisabled]}
              onPress={onClearDates}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Clear Dates"
            >
              <Text style={styles.secondaryBtnText}>Clear Dates</Text>
            </TouchableOpacity>
          ) : null}
          {onClearAllFilters ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.actionBtnFlex, loading && styles.btnDisabled]}
              onPress={onClearAllFilters}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Clear All Filters"
            >
              <Text style={styles.secondaryBtnText}>Clear All Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

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
                keyboardType={
                  searchField === 'mobile'
                    ? 'phone-pad'
                    : searchField === 'balance' || searchField === 'bonusBalance'
                      ? 'numeric'
                      : 'default'
                }
              />
              {searchText?.trim() ? (
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

      {children}

      {onPageSizeChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Text style={styles.rowLabel}>Per page</Text>
          {sizeOptions.map((n) => (
            <Chip
              key={n}
              label={String(n)}
              active={pageSize === n}
              onPress={() => onPageSizeChange(n)}
            />
          ))}
        </ScrollView>
      ) : null}
    </>
  );

  if (!collapsible) {
    return <View style={styles.wrap}>{body}</View>;
  }

  return (
    <View style={styles.filterBox}>
      <TouchableOpacity
        style={styles.filterHeader}
        activeOpacity={0.8}
        onPress={onToggleFilters}
        accessibilityRole="button"
        accessibilityLabel={filtersTitle}
      >
        <Text style={styles.filterHeaderTitle}>{filtersTitle}</Text>
        <Text style={styles.filterHeaderChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded ? <View style={styles.filterBody}>{body}</View> : null}
    </View>
  );
}
