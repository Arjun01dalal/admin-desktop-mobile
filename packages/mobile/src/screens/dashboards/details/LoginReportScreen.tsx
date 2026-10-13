/**
 * Login Report — port of desktop LoginReportPage.
 * Calls reports.loginByRole ({}) once; role chips switch the locally loaded group.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { useRequestGeneration } from '../../../hooks/useRequestGeneration';
import { formatDisplayTime } from '../../../utils/dates';
import { display } from '../../../utils/display';
import { roleNamesMap } from '../../../data/rolesData';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './reportList.styles';

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

export function LoginReportScreen() {
  const roleNames = useMemo(() => roleNamesMap(), []);
  const [grouped, setGrouped] = useState<Record<string, Item[]>>({});
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('reports.loginByRole', {});
      if (!isCurrent(gen)) return;
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
      const nextGrouped: Record<string, Item[]> = {};
      const ids: string[] = [];
      for (const group of list) {
        if (!group?._id) continue;
        nextGrouped[group._id] = Array.isArray(group.items) ? group.items : [];
        ids.push(group._id);
      }
      setGrouped(nextGrouped);
      setRoleIds(ids);
      setRoleId((prev) => (prev && nextGrouped[prev] ? prev : ids[0] || ''));
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, isCurrent, begin, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = grouped[roleId] || [];

  const columns = useMemo<DataTableColumn<Item>[]>(
    () => [
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
      {
        key: 'addressLine',
        label: 'Address Line',
        width: 180,
        render: (r) => display(r.address?.addressLine2),
      },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.address?.state) },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.address?.city) },
      {
        key: 'district',
        label: 'District',
        width: 120,
        render: (r) => display(r.address?.city_district),
      },
      { key: 'lat', label: 'Latitude', width: 100, render: (r) => display(r.lat) },
      { key: 'long', label: 'Longitude', width: 100, render: (r) => display(r.long) },
      {
        key: 'loginTime',
        label: 'Login Time',
        width: 100,
        render: (r) => formatDisplayTime(r.updatedOn) || '—',
      },
    ],
    [],
  );

  const keyExtractor = useCallback(
    (row: Item, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Item>) => (
      <LoginReportCard row={row} index={index} onPress={() => setSelected(row)} />
    ),
    [],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Login Report</Text>
      <Text style={styles.sub}>
        {roleId ? `${roleNames[roleId] || roleId} · ${rows.length} logins` : 'Select a role'}
      </Text>

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
    </>
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No login records"
        refreshing={loading}
        onRefresh={() => void load()}
      />

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
    </>
  );
}

type LoginReportCardProps = {
  row: Item;
  index: number;
  onPress: () => void;
};

const LoginReportCard = memo(function LoginReportCard({
  row,
  index,
  onPress,
}: LoginReportCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.name)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          City: {display(row.address?.city)}
        </Text>
        <Text style={styles.cardSplitRight}>
          Login: {formatDisplayTime(row.updatedOn) || '—'}
        </Text>
      </View>
      <Text style={styles.cardSplitLeft} numberOfLines={1}>
        State: {display(row.address?.state)}
      </Text>
      <Text style={styles.cardHint}>Tap card for details</Text>
    </TouchableOpacity>
  );
});
