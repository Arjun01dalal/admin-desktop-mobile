/**
 * Login Report — port of desktop LoginReportPage.
 * Calls reports.loginByRole ({}) once; role chips switch the locally loaded group.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayTime } from '../../../utils/dates';
import { roleNamesMap } from '../../../data/rolesData';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Item = {
  _id?: string;
  name?: string;
  lat?: unknown;
  long?: unknown;
  updatedOn?: string;
  address?: {
    addressLine2?: string;
    state?: string;
    city?: string;
    city_district?: string;
  };
  [key: string]: unknown;
};

type RoleGroup = { _id: string; items?: Item[] };


function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function LoginReportScreen() {
  const roleNames = useMemo(() => roleNamesMap(), []);
  const [grouped, setGrouped] = useState<Record<string, Item[]>>({});
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('reports.loginByRole', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setGrouped({});
        setRoleIds([]);
        setError(res.message || 'Failed to load login report');
        return;
      }
      const raw = res.data;
      const list: RoleGroup[] = Array.isArray(raw)
        ? (raw as RoleGroup[])
        : Array.isArray((raw as { payload?: RoleGroup[] })?.payload)
          ? ((raw as { payload?: RoleGroup[] }).payload as RoleGroup[])
          : [];
      const next: Record<string, Item[]> = {};
      const ids: string[] = [];
      for (const group of list) {
        if (!group?._id) continue;
        next[group._id] = Array.isArray(group.items) ? group.items : [];
        ids.push(group._id);
      }
      setGrouped(next);
      setRoleIds(ids);
      setRoleId((prev) => (prev && next[prev] ? prev : ids[0] || ''));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = grouped[roleId] || [];

  const columns = useMemo<DataTableColumn<Item>[]>(
    () => [
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
      { key: 'addressLine', label: 'Address Line', width: 180, render: (r) => display(r.address?.addressLine2) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.address?.state) },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.address?.city) },
      { key: 'district', label: 'District', width: 120, render: (r) => display(r.address?.city_district) },
      { key: 'lat', label: 'Latitude', width: 100, render: (r) => display(r.lat) },
      { key: 'long', label: 'Longitude', width: 100, render: (r) => display(r.long) },
      { key: 'loginTime', label: 'Login Time', width: 100, render: (r) => formatDisplayTime(r.updatedOn) || '—' },
    ],
    [],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Login Report</Text>
      <Text style={styles.sub}>
        {roleId ? `${roleNames[roleId] || roleId} · ${rows.length} logins` : 'Select a role'}
      </Text>

      {/* Role chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        {roleIds.map((id) => (
          <TouchableOpacity
            key={id}
            style={[styles.chip, roleId === id && styles.chipActive]}
            onPress={() => setRoleId(id)}
          >
            <Text style={[styles.chipText, roleId === id && styles.chipTextActive]}>
              {roleNames[id] || id} ({(grouped[id] || []).length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No login records</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity key={`row-${index}-${String(row._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(row)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{display(row.name)}</Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>City: {display(row.address?.city)}</Text>
              <Text style={styles.cardSplitRight}>Login: {formatDisplayTime(row.updatedOn) || '—'}</Text>
            </View>
            <Text style={styles.cardSplitLeft} numberOfLines={1}>State: {display(row.address?.state)}</Text>
            <Text style={styles.cardHint}>Tap card for details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.name) : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({ label: c.label, value: c.render(selected, 0) }))
            : []
        }
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  quickRow: { marginTop: spacing(3), flexGrow: 0 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginBottom: spacing(1) },
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
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1, minWidth: 0 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  cardSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2), paddingVertical: 1 },
  cardSplitLeft: { color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'left' },
  cardSplitRight: { color: colors.foreground, fontSize: 11, fontWeight: '700', flexShrink: 0, maxWidth: '48%', textAlign: 'right' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
});
