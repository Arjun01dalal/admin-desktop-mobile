/**
 * AAA Black Listed Users — mobile port of desktop AAABlacklistedUsersPage.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

const PREFERRED_LIST_KEYS = [
  'reports',
  'report',
  'data',
  'list',
  'rows',
  'items',
  'users',
  'result',
  'payload',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findRecordArray(value: unknown, depth = 0): unknown[] | null {
  if (value == null || depth > 5) return null;
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => isPlainObject(item))) {
      return value;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const key of PREFERRED_LIST_KEYS) {
      if (key in value) {
        const found = findRecordArray(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const key of Object.keys(value)) {
      if (PREFERRED_LIST_KEYS.includes(key)) continue;
      const found = findRecordArray(value[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractList(raw: unknown): Record<string, unknown>[] {
  const found = findRecordArray(raw);
  if (!found) return [];
  return found.filter(isPlainObject) as Record<string, unknown>[];
}

function formatColumnLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const TITLE_KEYS = ['userName', 'name', 'fullName', 'username', 'userId', '_id', 'id'];
const CARD_PRIORITY_KEYS = [
  'userId',
  'mobile',
  'status',
  'reason',
  'remark',
  'state',
  'city',
  'createdOn',
  'updatedOn',
];

function rowTitle(row: Record<string, unknown>): string {
  for (const key of TITLE_KEYS) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
      return cellText(row[key]);
    }
  }
  return 'Blacklisted User';
}

function cardFields(row: Record<string, unknown>): string[] {
  const titleKey = TITLE_KEYS.find(
    (key) => row[key] !== null && row[key] !== undefined && row[key] !== '',
  );
  const available = Object.keys(row).filter(
    (key) =>
      key !== titleKey &&
      row[key] !== null &&
      row[key] !== undefined &&
      row[key] !== '' &&
      typeof row[key] !== 'object',
  );
  return [
    ...CARD_PRIORITY_KEYS.filter((key) => available.includes(key)),
    ...available.filter((key) => !CARD_PRIORITY_KEYS.includes(key)),
  ].slice(0, 4);
}

export function AAABlacklistedUsersScreen() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Record<string, unknown> | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('aaa.blacklistedUsers', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch blacklisted users');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(extractList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sheetFields: SheetField[] = sheetRow
    ? Object.keys(sheetRow).map((k) => ({
        label: formatColumnLabel(k),
        value: cellText(sheetRow[k]),
      }))
    : [];

  return (
    <ScrollView
      style={styles.root}
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
      <View style={styles.toolbar}>
        <View style={styles.heading}>
          <Text style={styles.title}>AAA Black Listed Users</Text>
          <Text style={styles.subtitle}>
            {loading ? 'Checking records…' : `${rows.length.toLocaleString('en-IN')} users found`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => void load()}
        >
          <Text style={styles.btnText}>{loading ? 'Refreshing…' : '↻ Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load users</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>✓</Text>
          </View>
          <Text style={styles.emptyTitle}>No blacklisted users</Text>
          <Text style={styles.emptyText}>
            The API returned no records. Pull down or tap Refresh to check again.
          </Text>
        </View>
      ) : null}

      {!error && loading && rows.length === 0 ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Loading blacklisted users…</Text>
          <Text style={styles.loadingText}>Please wait while records are fetched.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id || row.id || row.userId || '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {rowTitle(row)}
              </Text>
              <Text style={styles.detailsText}>Details ›</Text>
            </View>
            {cardFields(row).map((key) => (
              <View style={styles.cardRow} key={key}>
                <Text style={styles.cardLabel}>{formatColumnLabel(key)}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {cellText(row[key])}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={Boolean(sheetRow)}
        title={sheetRow ? rowTitle(sheetRow) : 'Blacklisted User'}
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10), flexGrow: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
  },
  heading: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.sm,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 12 },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(4),
    marginTop: spacing(4),
  },
  errorTitle: { color: colors.destructive, fontSize: 15, fontWeight: '700' },
  errorText: { color: colors.foreground, fontSize: 12, marginTop: spacing(1) },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginTop: spacing(3),
  },
  retryText: { color: colors.destructive, fontSize: 12, fontWeight: '700' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(8),
    marginTop: spacing(5),
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.14)',
    marginBottom: spacing(3),
  },
  emptyIconText: { color: '#16a34a', fontSize: 22, fontWeight: '800' },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing(1.5),
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(5),
    marginTop: spacing(5),
  },
  loadingTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  loadingText: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  list: { gap: spacing(2), marginTop: spacing(4) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1 },
  detailsText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});
