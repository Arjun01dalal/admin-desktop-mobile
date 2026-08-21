/**
 * Dialer Push Data — list SubAdmin/get-dialer-datas records (desktop DialerPushDataPage).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CAMPAIGN_LIST, pickPageSizes } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { canAccessNavItem, Permissions } from '../../../auth/permissions';
import { colors, radius, spacing } from '../../../theme';
import { monthStartIST, todayIST } from '../../../utils/dates';

type Row = Record<string, unknown>;

const PAGE_SIZES = pickPageSizes([25, 50, 100, 200]);

function display(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function isLeadRow(row: Record<string, unknown>): boolean {
  return (
    row.list_id != null ||
    row.phone_number != null ||
    row.first_name != null ||
    row.list_name != null ||
    row.province != null
  );
}

const META_KEYS = new Set([
  'totalCount',
  'total',
  'count',
  'totalPages',
  'pageNo',
  'itemsPerPage',
  'pagination',
  'payload',
  'success',
  'message',
  'status',
  'statusCode',
]);

function withCampaign(lead: Row, wrapperCampaign?: string | number): Row {
  if (lead.campaign_id != null && String(lead.campaign_id).trim() !== '') return lead;
  if (wrapperCampaign == null || String(wrapperCampaign).trim() === '') return lead;
  return { ...lead, campaign_id: wrapperCampaign };
}

function extractCampaignMap(obj: Record<string, unknown>): Row[] {
  const out: Row[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (META_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        out.push(withCampaign(item as Row, key));
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const group = value as Record<string, unknown>;
    const nested =
      group.data ?? group.items ?? group.leads ?? group.records ?? group.docs;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        out.push(
          withCampaign(item as Row, (group.campaign_id as string | number | undefined) ?? key),
        );
      }
    } else if (isLeadRow(group)) {
      out.push(withCampaign(group as Row, key));
    }
  }
  return out;
}

function isCampaignMapObject(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).filter((k) => !META_KEYS.has(k));
  if (keys.length === 0) return false;
  let hits = 0;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      hits += 1;
      continue;
    }
    if (v && typeof v === 'object') {
      const g = v as Record<string, unknown>;
      if (
        Array.isArray(g.data) ||
        Array.isArray(g.items) ||
        Array.isArray(g.leads) ||
        typeof g.count === 'number' ||
        isLeadRow(g)
      ) {
        hits += 1;
      }
    }
  }
  return hits > 0 && hits >= Math.ceil(keys.length * 0.5);
}

function flattenDialerRows(list: unknown[], inheritedCampaign?: string | number): Row[] {
  const out: Row[] = [];
  for (const entry of list) {
    if (entry == null) continue;
    if (Array.isArray(entry)) {
      out.push(...flattenDialerRows(entry, inheritedCampaign));
      continue;
    }
    if (typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (isLeadRow(row)) {
      out.push(withCampaign(row as Row, inheritedCampaign));
      continue;
    }
    if (isCampaignMapObject(row)) {
      out.push(...extractCampaignMap(row));
      continue;
    }
    const nested =
      row.data ?? row.items ?? row.leads ?? row.records ?? row.docs ?? row.list;
    const campaignHint =
      row.campaign_id != null ? (row.campaign_id as string | number) : inheritedCampaign;
    if (Array.isArray(nested)) {
      out.push(...flattenDialerRows(nested, campaignHint));
      continue;
    }
    for (const [key, value] of Object.entries(row)) {
      if (META_KEYS.has(key) || key === 'campaign_id') continue;
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value[0] &&
        typeof value[0] === 'object' &&
        !Array.isArray(value[0])
      ) {
        out.push(...flattenDialerRows(value, campaignHint));
      }
    }
  }
  return out;
}

function unpackRows(data: unknown): { rows: Row[]; total: number; pages: number } {
  const attempts: unknown[] = [data];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    attempts.push(
      obj.payload,
      obj.items,
      obj.docs,
      obj.leads,
      obj.records,
      obj.result,
      obj.results,
      obj.data,
      (obj.payload as Record<string, unknown> | undefined)?.items,
      (obj.payload as Record<string, unknown> | undefined)?.data,
      (obj.data as Record<string, unknown> | undefined)?.items,
    );
  }

  let rows: Row[] = [];
  for (const attempt of attempts) {
    if (attempt == null) continue;
    let candidate: Row[] = [];
    if (Array.isArray(attempt)) {
      candidate = flattenDialerRows(attempt);
    } else if (typeof attempt === 'object') {
      const obj = attempt as Record<string, unknown>;
      candidate = isCampaignMapObject(obj)
        ? extractCampaignMap(obj)
        : flattenDialerRows([obj]);
    }
    if (candidate.length > rows.length) rows = candidate;
  }

  const meta =
    data && typeof data === 'object' && !Array.isArray(data)
      ? ((data as Record<string, unknown>).payload as Record<string, unknown>) ||
        ((data as Record<string, unknown>).data as Record<string, unknown>) ||
        (data as Record<string, unknown>)
      : {};
  const total = Number(meta.totalCount ?? meta.total ?? rows.length);
  const pages = Number(
    meta.totalPages ?? Math.max(1, Math.ceil((Number.isFinite(total) ? total : rows.length) / 50)),
  );
  return {
    rows,
    total: Number.isFinite(total) ? total : rows.length,
    pages: Number.isFinite(pages) && pages > 0 ? pages : 1,
  };
}

export function DialerPushDataScreen() {
  const isFocused = useIsFocused();
  const canView = canAccessNavItem({
    id: 'dialerPushData',
    permission: Permissions.dialer_push_data,
  });

  const [startDate, setStartDate] = useState(monthStartIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [listId, setListId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [subAdminId, setSubAdminId] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        pageNo,
        itemsPerPage,
        startDate,
        endDate,
      };
      if (listId.trim()) body.list_id = Number(listId.trim()) || listId.trim();
      if (campaignId.trim()) body.campaign_id = campaignId.trim();
      if (subAdminId.trim()) body.subAdminId = subAdminId.trim();

      const res = await secureApi('callLogs.getDialerDatas', body);
      if (!res.ok) {
        setError(res.message || 'Failed to load dialer push data');
        setRows([]);
        return;
      }
      const unpacked = unpackRows(res.data);
      setRows(unpacked.rows);
      setTotal(unpacked.total);
      setTotalPages(unpacked.pages);
      setError('');
    } finally {
      setLoading(false);
    }
  }, [canView, pageNo, itemsPerPage, startDate, endDate, listId, campaignId, subAdminId]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  if (!canView) {
    return (
      <View style={styles.screen}>
        <Text style={styles.error}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Dialer Push Data</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total {total}
      </Text>

      <View style={styles.filterGrid}>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="From (YYYY-MM-DD)"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="To (YYYY-MM-DD)"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={listId}
          onChangeText={setListId}
          placeholder="List ID"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          value={subAdminId}
          onChangeText={setSubAdminId}
          placeholder="Sub Admin ID"
          placeholderTextColor={colors.muted}
        />
      </View>

      <Text style={styles.label}>Campaign</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, !campaignId && styles.chipActive]}
          onPress={() => setCampaignId('')}
        >
          <Text style={[styles.chipText, !campaignId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {CAMPAIGN_LIST.slice(0, 20).map((c) => {
          const active = campaignId === c.id.trim();
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCampaignId(c.id.trim())}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {c.id.trim()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.chipRow}>
        {PAGE_SIZES.map((n) => {
          const active = itemsPerPage === n;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setItemsPerPage(n);
                setPageNo(1);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.applyBtn}
        onPress={() => {
          setPageNo(1);
          void load();
        }}
        disabled={loading}
      >
        <Text style={styles.applyBtnText}>{loading ? 'Loading…' : 'Apply'}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.map((r, i) => (
        <View key={String(r._id || i)} style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {display(r.first_name)} {display(r.last_name) !== '—' ? display(r.last_name) : ''}
          </Text>
          <Text style={styles.cardLine}>Mobile: {display(r.phone_number)}</Text>
          <Text style={styles.cardLine}>
            List: {display(r.list_id)} · {display(r.list_name)}
          </Text>
          <Text style={styles.cardLine}>Campaign: {display(r.campaign_id)}</Text>
          <Text style={styles.cardLine}>
            {display(r.city)}, {display(r.state)} · App: {display(r.email)}
          </Text>
          <Text style={styles.cardMuted}>
            SubAdmin: {display(r.subAdminId)}
            {r.subAdminName ? ` (${display(r.subAdminName)})` : ''}
          </Text>
        </View>
      ))}

      {!loading && rows.length === 0 ? <Text style={styles.hint}>No data found</Text> : null}

      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pagerBtn, pageNo <= 1 && styles.disabled]}
          disabled={pageNo <= 1 || loading}
          onPress={() => setPageNo((p) => Math.max(1, p - 1))}
        >
          <Text style={styles.pagerText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerLabel}>
          Page {pageNo} / {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, pageNo >= totalPages && styles.disabled]}
          disabled={pageNo >= totalPages || loading}
          onPress={() => setPageNo((p) => Math.min(totalPages, p + 1))}
        >
          <Text style={styles.pagerText}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  filterGrid: { gap: spacing(2), marginBottom: spacing(2) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: spacing(1) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(2) },
  chip: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  applyBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    backgroundColor: colors.surface,
    marginBottom: spacing(2),
  },
  cardTitle: { color: colors.foreground, fontWeight: '700', fontSize: 15 },
  cardLine: { color: colors.foreground, fontSize: 12, marginTop: 4 },
  cardMuted: { color: colors.muted, fontSize: 11, marginTop: 6 },
  hint: { color: colors.muted, textAlign: 'center', marginTop: spacing(4) },
  error: { color: '#ef5350', marginVertical: spacing(2) },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(2),
  },
  pagerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  pagerText: { color: colors.foreground, fontWeight: '600' },
  pagerLabel: { color: colors.muted },
  disabled: { opacity: 0.4 },
});
