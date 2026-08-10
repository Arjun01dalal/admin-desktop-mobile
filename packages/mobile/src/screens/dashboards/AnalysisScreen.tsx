/**
 * Analytics — calls /User/analytics (analytics.userAnalytics) when opened.
 * The response shape is rendered generically, matching the app's screen
 * structure: title, error/empty states, pull-to-refresh, stat cards for
 * scalar fields and tables for arrays of objects.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';
import { DataTable, type DataTableColumn } from '../../dashboards/ui/DataTable';

type Row = Record<string, unknown>;

function labelize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function fmtScalar(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('en-IN')
      : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function isScalar(v: unknown): boolean {
  return v == null || ['string', 'number', 'boolean'].includes(typeof v);
}

/** Split any object into scalar stats, object-array tables and nested objects. */
function splitSections(obj: Row): {
  stats: Array<[string, unknown]>;
  tables: Array<[string, Row[]]>;
  nested: Array<[string, Row]>;
} {
  const stats: Array<[string, unknown]> = [];
  const tables: Array<[string, Row[]]> = [];
  const nested: Array<[string, Row]> = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (isScalar(value)) {
      stats.push([key, value]);
    } else if (Array.isArray(value)) {
      const rows = value.filter(
        (r): r is Row => r != null && typeof r === 'object' && !Array.isArray(r),
      );
      if (rows.length > 0) tables.push([key, rows]);
      else if (value.length > 0) stats.push([key, value.map(String).join(', ')]);
    } else if (value && typeof value === 'object') {
      nested.push([key, value as Row]);
    }
  });
  return { stats, tables, nested };
}

function columnsFor(rows: Row[]): DataTableColumn<Row>[] {
  const keys: string[] = [];
  rows.slice(0, 20).forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (!keys.includes(k) && k !== '_id' && k !== '__v') keys.push(k);
    });
  });
  return keys.map((k) => ({
    key: k,
    label: labelize(k),
    width: 120,
    render: (r: Row) => (isScalar(r[k]) ? fmtScalar(r[k]) : JSON.stringify(r[k])),
  }));
}

function StatGrid({ stats }: { stats: Array<[string, unknown]> }) {
  if (stats.length === 0) return null;
  return (
    <View style={styles.statGrid}>
      {stats.map(([key, value]) => (
        <View style={styles.statCard} key={key}>
          <Text style={styles.statLabel}>{labelize(key)}</Text>
          <Text style={styles.statValue}>{fmtScalar(value)}</Text>
        </View>
      ))}
    </View>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonthIST(): { year: number; month: number } {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function AnalysisScreen() {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Row | null>(null);
  const [ym, setYm] = useState(currentMonthIST);

  /** Year & Month value sent to the API, e.g. "2026-08" (matches the web UI's month input). */
  const dateParam = useMemo(
    () => `${ym.year}-${String(ym.month).padStart(2, '0')}`,
    [ym],
  );

  const shiftMonth = useCallback((delta: number) => {
    setYm((prev) => {
      const idx = prev.year * 12 + (prev.month - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('analytics.userAnalytics', { date: dateParam });
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load analytics');
        return;
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        setData({ analytics: raw });
      } else if (raw && typeof raw === 'object') {
        setData(raw as Row);
      } else {
        setData(null);
      }
      setError('');
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const { stats, tables, nested } = data
    ? splitSections(data)
    : { stats: [], tables: [], nested: [] };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Analytics</Text>

      {/* Year & Month picker (same input the web UI uses) */}
      <View style={styles.monthBar}>
        <TouchableOpacity
          style={styles.monthBtn}
          onPress={() => shiftMonth(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.monthBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTH_NAMES[ym.month - 1]} {ym.year}
        </Text>
        <TouchableOpacity
          style={styles.monthBtn}
          onPress={() => shiftMonth(1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.monthBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && !error && (!data || (stats.length === 0 && tables.length === 0 && nested.length === 0)) ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No analytics data available.</Text>
        </View>
      ) : null}

      <StatGrid stats={stats} />

      {nested.map(([key, obj]) => {
        const sub = splitSections(obj);
        return (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{labelize(key)}</Text>
            <StatGrid stats={sub.stats} />
            {sub.tables.map(([tKey, rows]) => (
              <View key={`${key}-${tKey}`} style={styles.tableBlock}>
                <Text style={styles.tableTitle}>{labelize(tKey)}</Text>
                <DataTable
                  columns={columnsFor(rows)}
                  rows={rows}
                  keyFor={(_r, i) => `${key}-${tKey}-${i}`}
                  emptyMessage="No rows"
                />
              </View>
            ))}
            {/* Deeper nesting: show as formatted JSON so nothing is silently dropped. */}
            {sub.nested.map(([nKey, nObj]) => (
              <View key={`${key}-${nKey}`} style={styles.tableBlock}>
                <Text style={styles.tableTitle}>{labelize(nKey)}</Text>
                <View style={styles.jsonBox}>
                  <Text style={styles.jsonText}>{JSON.stringify(nObj, null, 2)}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}

      {tables.map(([key, rows]) => (
        <View key={key} style={styles.section}>
          <Text style={styles.sectionTitle}>{labelize(key)}</Text>
          <DataTable
            columns={columnsFor(rows)}
            rows={rows}
            keyFor={(_r, i) => `${key}-${i}`}
            emptyMessage="No rows"
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loading: { paddingVertical: spacing(8), alignItems: 'center' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(3),
  },
  monthBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  monthBtnText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  monthLabel: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    minWidth: '47%',
    flexGrow: 1,
  },
  statLabel: { color: colors.muted, fontSize: 12, marginBottom: spacing(1) },
  statValue: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  section: { marginBottom: spacing(4) },
  sectionTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  tableBlock: { marginTop: spacing(2) },
  jsonBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  jsonText: { color: colors.muted, fontSize: 11, fontFamily: 'monospace' },
  tableTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
});
