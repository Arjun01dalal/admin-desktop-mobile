/**
 * Dialer Push Data — list SubAdmin/get-dialer-datas records (desktop DialerPushDataPage).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CAMPAIGN_LIST, buildExtensionAssigneeMap, dialerCampaignLabel, pickPageSizes } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { canAccessNavItem, Permissions } from '../../../auth/permissions';
import { DateField } from '../../../components/DateField';
import { colors, radius, spacing } from '../../../theme';
import {
  formatDisplayDate,
  formatDisplayTime,
  todayIST,
} from '../../../utils/dates';

type Row = Record<string, unknown>;

const PAGE_SIZES = pickPageSizes([25, 50, 100, 200, 500]);
const CAMPAIGN_PAGE_SIZE = 50;

function display(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function formatDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  const joined = [d, t].filter(Boolean).join(' ');
  return joined || display(value);
}

function pickField(row: Row, ...keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

function userIdOf(row: Row): string {
  return display(
    pickField(
      row,
      'province',
      'Province',
      'provience',
      'Provience',
      'userId',
      'user_id',
      'UserId',
    ),
  );
}

function createdOnOf(row: Row): string {
  return formatDateTime(
    pickField(row, 'createdAt', 'createdOn', 'created_at', 'CreatedAt', 'CreatedOn'),
  );
}

function updatedOnOf(row: Row): string {
  return formatDateTime(
    pickField(row, 'updatedAt', 'updatedOn', 'updated_at', 'UpdatedAt', 'UpdatedOn'),
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

/** List wrapper keys — never treat these as Campaign IDs. */
const LIST_KEYS = new Set([
  'data',
  'items',
  'docs',
  'leads',
  'records',
  'list',
  'result',
  'results',
]);

function isLeadRow(row: Record<string, unknown>): boolean {
  return (
    row.list_id != null ||
    row.phone_number != null ||
    row.first_name != null ||
    row.list_name != null ||
    row.province != null
  );
}

function withCampaign(lead: Row, wrapperCampaign?: string | number): Row {
  if (lead.campaign_id != null && String(lead.campaign_id).trim() !== '') {
    return lead;
  }
  if (wrapperCampaign == null || String(wrapperCampaign).trim() === '') {
    return lead;
  }
  return { ...lead, campaign_id: wrapperCampaign };
}

function rowDedupeKey(row: Row): string {
  return String(
    row._id ||
      `${row.phone_number || ''}|${row.list_id || ''}|${row.campaign_id || ''}|${row.province || ''}`,
  );
}

function dedupeRows(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const id = rowDedupeKey(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/** Expand campaign-keyed objects (desktop DialerPushDataPage parity). */
function extractCampaignMap(obj: Record<string, unknown>): Row[] {
  const out: Row[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (META_KEYS.has(key) || LIST_KEYS.has(key)) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        if (isLeadRow(item as Record<string, unknown>)) {
          out.push(withCampaign(item as Row, key));
        } else {
          out.push(...flattenDialerRows([item], key));
        }
      }
      continue;
    }

    if (!value || typeof value !== 'object') continue;
    const group = value as Record<string, unknown>;
    const nested =
      group.data ??
      group.items ??
      group.leads ??
      group.records ??
      group.docs ??
      group.list;

    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        out.push(
          withCampaign(
            item as Row,
            (group.campaign_id as string | number | undefined) ?? key,
          ),
        );
      }
      continue;
    }

    if (isLeadRow(group)) {
      out.push(withCampaign(group as Row, key));
      continue;
    }

    out.push(...flattenDialerRows([group], key));
  }
  return out;
}

function isCampaignMapObject(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).filter((k) => !META_KEYS.has(k) && !LIST_KEYS.has(k));
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

function flattenDialerRows(
  list: unknown[],
  inheritedCampaign?: string | number,
): Row[] {
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
      row.data ??
      row.items ??
      row.leads ??
      row.records ??
      row.docs ??
      row.list ??
      row.result ??
      row.results;

    const campaignHint =
      row.campaign_id != null
        ? (row.campaign_id as string | number)
        : inheritedCampaign;

    if (Array.isArray(nested)) {
      out.push(...flattenDialerRows(nested, campaignHint));
      continue;
    }

    let foundArray = false;
    for (const [key, value] of Object.entries(row)) {
      if (META_KEYS.has(key) || key === 'campaign_id' || key === 'subAdminId') {
        continue;
      }
      if (!Array.isArray(value) || value.length === 0) continue;
      if (!value[0] || typeof value[0] !== 'object' || Array.isArray(value[0])) {
        continue;
      }
      foundArray = true;
      out.push(...flattenDialerRows(value, campaignHint));
    }
    if (!foundArray && isLeadRow(row)) {
      out.push(withCampaign(row as Row, campaignHint));
    }
  }

  return out;
}

/** Desktop DialerPushDataPage unpackList — pick richest lead interpretation. */
function unpackRows(data: unknown): { rows: Row[]; total: number; pages: number } {
  const metaRoot =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const metaPayload =
    metaRoot.payload &&
    typeof metaRoot.payload === 'object' &&
    !Array.isArray(metaRoot.payload)
      ? (metaRoot.payload as Record<string, unknown>)
      : metaRoot.data &&
          typeof metaRoot.data === 'object' &&
          !Array.isArray(metaRoot.data)
        ? (metaRoot.data as Record<string, unknown>)
        : metaRoot;

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
      obj.list,
      obj.data,
      (obj.payload as Record<string, unknown> | undefined)?.items,
      (obj.payload as Record<string, unknown> | undefined)?.data,
      (obj.payload as Record<string, unknown> | undefined)?.docs,
      (obj.payload as Record<string, unknown> | undefined)?.leads,
      (obj.data as Record<string, unknown> | undefined)?.items,
      (obj.data as Record<string, unknown> | undefined)?.docs,
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
      if (isCampaignMapObject(obj)) {
        candidate = extractCampaignMap(obj);
      } else {
        candidate = flattenDialerRows([obj]);
      }
    }
    if (candidate.length > rows.length) rows = candidate;
  }

  rows = dedupeRows(rows);

  // Sum per-campaign `count` when API reports counts larger than listed leads.
  let sumCounts = 0;
  if (metaPayload && typeof metaPayload === 'object') {
    for (const [key, value] of Object.entries(metaPayload)) {
      if (META_KEYS.has(key) || LIST_KEYS.has(key)) continue;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const c = Number((value as Record<string, unknown>).count);
        if (Number.isFinite(c) && c > 0) sumCounts += c;
      } else if (Array.isArray(value)) {
        sumCounts += value.length;
      }
    }
  }

  const total = Number(
    metaPayload.totalCount ??
      (metaPayload.pagination as { totalCount?: number } | undefined)?.totalCount ??
      metaPayload.total ??
      (sumCounts > rows.length ? sumCounts : rows.length),
  );
  const pages = Number(
    metaPayload.totalPages ??
      (metaPayload.pagination as { totalPages?: number } | undefined)?.totalPages ??
      0,
  );

  return {
    rows,
    total: Number.isFinite(total) ? total : rows.length,
    pages: Number.isFinite(pages) && pages > 0 ? pages : 0,
  };
}

export function DialerPushDataScreen() {
  const isFocused = useIsFocused();
  const canView =
    canAccessNavItem({
      id: 'dialerPushData',
      permission: Permissions.dialer_push_data,
    }) ||
    canAccessNavItem({
      id: 'callLogs',
      permission: Permissions.call_logs,
    });

  const [startDate, setStartDate] = useState(todayIST());
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
  /** Pull-to-refresh only — never bind initial load to RefreshControl (Android crash). */
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const aliveRef = useRef(true);
  /** extension / dialer id → assignee name (Caller Allotment). */
  const [extensionAssigneeMap, setExtensionAssigneeMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canView || !isFocused) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await secureApi<{ byRole?: unknown[] }>(
          'ops.callerAllotmentSubadmins',
          { filter: {} },
        );
        if (cancelled || !aliveRef.current || !res.ok) return;
        const raw = (res.data ?? {}) as Record<string, unknown>;
        const byRole = (raw.byRole ??
          (raw.payload as Record<string, unknown> | undefined)?.byRole ??
          []) as Array<{
          subAdmins?: Array<Record<string, unknown>>;
        }>;
        setExtensionAssigneeMap(buildExtensionAssigneeMap(byRole));
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, isFocused]);

  const filtersRef = useRef({
    pageNo,
    itemsPerPage,
    startDate,
    endDate,
    listId,
    campaignId,
    subAdminId,
  });
  filtersRef.current = {
    pageNo,
    itemsPerPage,
    startDate,
    endDate,
    listId,
    campaignId,
    subAdminId,
  };

  const load = useCallback(async (page?: number, opts?: { pull?: boolean }) => {
    if (!canView) return;
    const f = filtersRef.current;
    const pageToLoad = page ?? f.pageNo;
    if (f.startDate && f.endDate && f.startDate > f.endDate) {
      setError('From date cannot be greater than To date');
      return;
    }

    if (opts?.pull) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const buildBody = (page: number, pageSize: number): Record<string, unknown> => {
        // Match admin-panel DialerPushData — only known keys (Joi rejects extras).
        const body: Record<string, unknown> = {
          pageNo: page,
          itemsPerPage: pageSize,
          startDate: f.startDate,
          endDate: f.endDate,
        };
        if (f.listId.trim()) body.list_id = Number(f.listId.trim()) || f.listId.trim();
        if (f.campaignId.trim()) body.campaign_id = f.campaignId.trim();
        if (f.subAdminId.trim()) body.subAdminId = f.subAdminId.trim();
        return body;
      };

      const res = await secureApi(
        'callLogs.getDialerDatas',
        buildBody(pageToLoad, f.itemsPerPage),
      );
      if (!aliveRef.current) return;

      if (!res.ok) {
        setError(res.message || 'Failed to load dialer push data');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      let unpacked: { rows: Row[]; total: number; pages: number };
      try {
        unpacked = unpackRows(res.data);
      } catch {
        setError('Failed to parse dialer push data');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      // API often returns totalCount > listed leads (and may ignore itemsPerPage).
      // Retry larger page size, then walk pages using the actual returned page length.
      if (unpacked.total > unpacked.rows.length) {
        const bigger = Math.min(Math.max(unpacked.total, f.itemsPerPage, 500), 2000);
        if (bigger > f.itemsPerPage) {
          const retry = await secureApi('callLogs.getDialerDatas', buildBody(1, bigger));
          if (aliveRef.current && retry.ok) {
            try {
              const again = unpackRows(retry.data);
              if (again.rows.length > unpacked.rows.length) unpacked = again;
            } catch {
              /* keep first */
            }
          }
        }

        if (unpacked.rows.length < unpacked.total) {
          const merged = [...unpacked.rows];
          const seen = new Set(merged.map(rowDedupeKey));
          const returnedLen = Math.max(1, unpacked.rows.length);
          const pagesNeeded = Math.max(
            unpacked.pages > 0 ? unpacked.pages : 1,
            Math.ceil(unpacked.total / returnedLen),
          );
          const maxPages = Math.min(pagesNeeded, 40);
          // Page 1 already in `merged`; fetch 2..N
          for (let p = 2; p <= maxPages; p++) {
            if (merged.length >= unpacked.total) break;
            const pageRes = await secureApi(
              'callLogs.getDialerDatas',
              buildBody(p, f.itemsPerPage),
            );
            if (!aliveRef.current || !pageRes.ok) break;
            try {
              const pageUnpacked = unpackRows(pageRes.data);
              if (pageUnpacked.rows.length === 0) break;
              let added = 0;
              for (const row of pageUnpacked.rows) {
                const id = rowDedupeKey(row);
                if (seen.has(id)) continue;
                seen.add(id);
                merged.push(row);
                added += 1;
              }
              if (added === 0) break;
            } catch {
              break;
            }
          }
          unpacked = { ...unpacked, rows: merged };
        }
      }

      setRows(unpacked.rows);
      setTotal(Math.max(unpacked.total, unpacked.rows.length));
      const pagesFromCount = Math.max(
        1,
        Math.ceil(unpacked.total / Math.max(1, f.itemsPerPage)),
      );
      setTotalPages(unpacked.pages > 0 ? unpacked.pages : pagesFromCount);
      setError('');
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load dialer push data');
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [canView]);

  useEffect(() => {
    if (!isFocused || !canView) return;
    void load(pageNo);
  }, [isFocused, canView, pageNo, itemsPerPage, load]);

  const handleApply = () => {
    if (pageNo !== 1) setPageNo(1);
    else void load(1);
  };

  const campaignChips = useMemo(
    () => CAMPAIGN_LIST.slice(0, 40).map((c) => ({ id: c.id.trim(), key: c.id })),
    [],
  );

  /** All campaigns that have data — default view is campaign-wise (desktop parity). */
  const groupedByCampaign = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    for (const row of rows) {
      const key =
        row?.campaign_id !== undefined &&
        row?.campaign_id !== null &&
        String(row.campaign_id).trim() !== ''
          ? String(row.campaign_id).trim()
          : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    let entries = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (campaignId.trim()) {
      entries = entries.filter(([key]) => key === campaignId.trim());
    }
    return entries.map(([key, campaignRows]) => ({
      key,
      label: dialerCampaignLabel(key, extensionAssigneeMap),
      rows: campaignRows,
      count: campaignRows.length,
    }));
  }, [rows, campaignId, extensionAssigneeMap]);

  /** Campaign sections collapsed by default — tap header to expand. */
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>({});
  const [campaignPage, setCampaignPage] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!groupedByCampaign.length) {
      setOpenCampaigns({});
      setCampaignPage({});
      return;
    }
    const nextOpen: Record<string, boolean> = {};
    const nextPage: Record<string, number> = {};
    for (const g of groupedByCampaign) {
      nextOpen[g.key] = false;
      nextPage[g.key] = 1;
    }
    setOpenCampaigns(nextOpen);
    setCampaignPage(nextPage);
  }, [groupedByCampaign]);

  const toggleCampaign = useCallback((key: string) => {
    setOpenCampaigns((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>Dialer Push Data</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Showing {rows.length}
        {total > 0 && total !== rows.length ? ` of ${total}` : ''}
        {groupedByCampaign.length
          ? ` · ${groupedByCampaign.length} campaign${groupedByCampaign.length > 1 ? 's' : ''}`
          : ''}
      </Text>

      <View style={styles.datesRow}>
        <View style={styles.halfField}>
          <Text style={styles.fieldLabel}>From</Text>
          <DateField style={styles.dateInput} value={startDate} onChange={setStartDate} />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.fieldLabel}>To</Text>
          <DateField style={styles.dateInput} value={endDate} onChange={setEndDate} />
        </View>
      </View>

      <View style={styles.datesRow}>
        <View style={styles.halfField}>
          <Text style={styles.fieldLabel}>List ID</Text>
          <TextInput
            style={styles.input}
            value={listId}
            onChangeText={setListId}
            placeholder="List ID"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.fieldLabel}>Sub Admin ID</Text>
          <TextInput
            style={styles.input}
            value={subAdminId}
            onChangeText={setSubAdminId}
            placeholder="Sub Admin ID"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      <Text style={styles.label}>Campaign</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowContent}
        nestedScrollEnabled
      >
        <TouchableOpacity
          style={[styles.chip, !campaignId && styles.chipActive]}
          onPress={() => setCampaignId('')}
        >
          <Text style={[styles.chipText, !campaignId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {campaignChips.map((c) => {
          const active = campaignId === c.id;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCampaignId(c.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {c.id}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Rows</Text>
      <View style={styles.chipRowWrap}>
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
        style={[styles.applyBtn, loading && styles.disabled]}
        onPress={handleApply}
        disabled={loading || refreshing}
      >
        <Text style={styles.applyBtnText}>{loading ? 'Loading…' : 'Apply'}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Loading…</Text>
        </View>
      ) : null}
    </View>
  );

  if (!canView) {
    return (
      <View style={styles.screen}>
        <Text style={styles.error}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={groupedByCampaign}
      keyExtractor={(g) => g.key}
      ListHeaderComponent={listHeader}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(pageNo, { pull: true })}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item: group }) => {
        const isOpen = Boolean(openCampaigns[group.key]);
        const page = Math.max(1, campaignPage[group.key] || 1);
        const totalCampPages = Math.max(
          1,
          Math.ceil(group.count / CAMPAIGN_PAGE_SIZE),
        );
        const safePage = Math.min(page, totalCampPages);
        const start = (safePage - 1) * CAMPAIGN_PAGE_SIZE;
        const pageRows = group.rows.slice(start, start + CAMPAIGN_PAGE_SIZE);

        return (
          <View style={styles.campaignBlock}>
            <TouchableOpacity
              style={styles.campaignHeader}
              onPress={() => toggleCampaign(group.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.campaignChevron}>{isOpen ? '▼' : '▶'}</Text>
              <View style={styles.campaignHeaderMain}>
                <Text style={styles.campaignTitle} numberOfLines={2}>
                  {group.label}
                </Text>
                <Text style={styles.campaignCount}>Count: {group.count}</Text>
              </View>
            </TouchableOpacity>

            {isOpen
              ? pageRows.map((r, i) => (
                  <View
                    key={String(r._id || `${group.key}-${start + i}`)}
                    style={styles.card}
                  >
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {display(r.first_name)}{' '}
                      {display(r.last_name) !== '—' ? display(r.last_name) : ''}
                    </Text>
                    <Text style={styles.cardLine}>Mobile: {display(r.phone_number)}</Text>
                    <Text style={styles.cardLine}>User ID: {userIdOf(r)}</Text>
                    <Text style={styles.cardLine}>
                      List: {display(r.list_id)} · {display(r.list_name)}
                    </Text>
                    <Text style={styles.cardLine}>
                      {display(r.city)}, {display(r.state)} · App: {display(r.email)}
                    </Text>
                    <Text style={styles.cardMuted}>
                      SubAdmin: {display(r.subAdminId)}
                      {r.subAdminName ? ` (${display(r.subAdminName)})` : ''}
                    </Text>
                    <Text style={styles.cardMuted}>Created On: {createdOnOf(r)}</Text>
                    <Text style={styles.cardMuted}>Updated On: {updatedOnOf(r)}</Text>
                  </View>
                ))
              : null}

            {isOpen && totalCampPages > 1 ? (
              <View style={styles.campaignPager}>
                <TouchableOpacity
                  style={[styles.pagerBtn, safePage <= 1 && styles.disabled]}
                  disabled={safePage <= 1}
                  onPress={() =>
                    setCampaignPage((prev) => ({
                      ...prev,
                      [group.key]: Math.max(1, safePage - 1),
                    }))
                  }
                >
                  <Text style={styles.pagerText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.pagerLabel}>
                  {start + 1}–{Math.min(start + CAMPAIGN_PAGE_SIZE, group.count)} /{' '}
                  {group.count}
                </Text>
                <TouchableOpacity
                  style={[styles.pagerBtn, safePage >= totalCampPages && styles.disabled]}
                  disabled={safePage >= totalCampPages}
                  onPress={() =>
                    setCampaignPage((prev) => ({
                      ...prev,
                      [group.key]: Math.min(totalCampPages, safePage + 1),
                    }))
                  }
                >
                  <Text style={styles.pagerText}>›</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={
        !loading ? <Text style={styles.hint}>No data found</Text> : null
      }
      ListFooterComponent={
        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.pagerBtn, pageNo <= 1 && styles.disabled]}
            disabled={pageNo <= 1 || loading || refreshing}
            onPress={() => setPageNo((p) => Math.max(1, p - 1))}
          >
            <Text style={styles.pagerText}>‹ Prev</Text>
          </TouchableOpacity>
          <Text style={styles.pagerLabel}>
            Page {pageNo} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pagerBtn, pageNo >= totalPages && styles.disabled]}
            disabled={pageNo >= totalPages || loading || refreshing}
            onPress={() => setPageNo((p) => Math.min(totalPages, p + 1))}
          >
            <Text style={styles.pagerText}>Next ›</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerBlock: { marginBottom: spacing(1) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    marginBottom: spacing(2.5),
  },
  halfField: { flex: 1, minWidth: 0 },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing(1),
  },
  dateInput: {
    backgroundColor: colors.surface,
    minHeight: 42,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    color: colors.foreground,
    backgroundColor: colors.surface,
    fontSize: 13,
    minHeight: 42,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing(1.5),
    marginTop: spacing(0.5),
  },
  chipRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing(2),
    marginBottom: spacing(2.5),
    gap: spacing(2),
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(2.5),
  },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  applyBtnText: { color: '#fff', fontWeight: '700' },
  loadingBox: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(4) },
  campaignBlock: {
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  campaignChevron: { color: colors.primary, fontSize: 12, fontWeight: '700', width: 14 },
  campaignHeaderMain: { flex: 1, minWidth: 0 },
  campaignTitle: { color: colors.foreground, fontSize: 13, fontWeight: '800' },
  campaignCount: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  campaignPager: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    padding: spacing(3),
    backgroundColor: colors.surface,
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
    marginBottom: spacing(4),
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
