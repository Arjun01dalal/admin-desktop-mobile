/**
 * Caller Details — port of desktop CallerDetailsPage.
 * Opened when a caller row is tapped on Caller Responsibility.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { colors, radius, spacing } from '../../../theme';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { pickPlayIn } from '../../../dashboards/userRowUtils';
import { addToDialerBatch, singleCallToDialer } from '../../../utils/externalDialer';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type DetailRow = Record<string, unknown> & {
  _id?: string;
  userId?: string;
  name?: string;
  userName?: string;
  mobile?: string;
  userMobile?: string;
  alternateMobile?: unknown;
  status?: string;
  city?: string;
  state?: string;
  app?: string;
  clientName?: string;
  appName?: string;
  createdAt?: string;
  createdOn?: string;
  activeUser?: string;
  lastActivity?: string;
  lastActive?: string;
  played?: unknown;
  playIn?: unknown;
  play_in?: unknown;
  playedGames?: unknown;
};

type TabKey = 'Today' | 'Active' | 'Warning' | 'Inactive';

const PLAY_LABELS: Record<string, string> = {
  E: 'Exchange',
  C: 'Casino',
  S: 'Sports',
};

function playParts(row: DetailRow): string[] {
  const raw = pickPlayIn(row);
  if (!raw || raw === '-') return [];
  return raw
    .split(/[,|\s]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '—');
}

function formatPlayed(row: DetailRow): string {
  const parts = playParts(row);
  if (!parts.length) return '—';
  return parts.map((part) => PLAY_LABELS[part.toUpperCase()] || part).join(', ');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDaysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function rowName(row: DetailRow): string {
  return display(row.name || row.userName);
}

function rowMobile(row: DetailRow): string {
  return String(row.mobile || row.userMobile || '').trim();
}

function extensionIdsOf(user: { extensionId?: unknown } | null): string[] {
  const raw = user?.extensionId;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function rowId(row: DetailRow): string {
  return String(row._id || row.userId || '');
}

function rowApp(row: DetailRow): string {
  return appCodeForName(row.clientName || row.appName) || display(row.app);
}

function rowCreated(row: DetailRow): string {
  return formatDisplayDate(row.createdOn || row.createdAt) || '—';
}

function alternateMobileList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const s = String(value).trim();
  return s ? [s] : [];
}

function formatAlternateMobile(value: unknown, canShow: boolean): string {
  const list = alternateMobileList(value);
  if (!list.length) return '—';
  if (!canShow) return '**********';
  return list.join(', ');
}

function unwrapToday(data: unknown): {
  users: DetailRow[];
  count: number;
  totalPages: number;
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const usersRaw = root.user ?? root.users ?? nested.user ?? nested.users;
  const users = Array.isArray(usersRaw) ? (usersRaw as DetailRow[]) : [];
  const count = Number(root.count ?? nested.count ?? users.length) || 0;
  const totalPages =
    Number(root.totalPages ?? nested.totalPages) ||
    Math.max(1, Math.ceil(count / Math.max(users.length, 1)) || 1);
  return { users, count, totalPages };
}

function unwrapWarn(data: unknown): { items: DetailRow[]; total: number } {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const itemsRaw = root.items ?? nested.items;
  const items = Array.isArray(itemsRaw) ? (itemsRaw as DetailRow[]) : [];
  const total = Number(root.total ?? nested.total ?? items.length) || 0;
  return { items, total };
}

function unwrapActiveInactive(data: unknown): {
  active: DetailRow[];
  inactive: DetailRow[];
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const activeRaw = root.active ?? nested.active;
  const inactiveRaw = root.inactive ?? nested.inactive;
  return {
    active: Array.isArray(activeRaw) ? (activeRaw as DetailRow[]) : [],
    inactive: Array.isArray(inactiveRaw) ? (inactiveRaw as DetailRow[]) : [],
  };
}

async function fetchAllTodayUsers(args: {
  empCode: string;
  startDate: string;
  endDate: string;
}): Promise<{ users: DetailRow[]; count: number }> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  let count = 0;
  const users: DetailRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi('caller.callerActiveToday', {
      empCode: args.empCode,
      filter: {},
      startDate: args.startDate,
      endDate: args.endDate,
      pageNo: page,
      itemsPerPage: pageSize,
    });
    const parsed = unwrapToday(res.data);
    if (page === 1) {
      count = parsed.count;
      totalPages = Math.max(
        1,
        Number(parsed.totalPages) || Math.ceil(parsed.count / pageSize) || 1,
      );
    }
    for (const row of parsed.users) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      users.push(row);
    }
    if (!parsed.users.length || parsed.users.length < pageSize) break;
    page += 1;
  } while (page <= totalPages && page <= 200);

  return { users, count: count || users.length };
}

async function fetchAllWarningUsers(args: {
  empCode: string;
  userId?: string;
}): Promise<{ items: DetailRow[]; total: number }> {
  const pageSize = 1000;
  let page = 1;
  let total = 0;
  const items: DetailRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi('caller.nonPerforming', {
      empCode: args.empCode,
      _id: args.userId,
      pageNo: page,
      itemPerPage: pageSize,
      filter: {},
    });
    const parsed = unwrapWarn(res.data);
    if (page === 1) total = parsed.total;
    for (const row of parsed.items) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      items.push(row);
    }
    if (!parsed.items.length || parsed.items.length < pageSize) break;
    if (total > 0 && items.length >= total) break;
    page += 1;
  } while (page <= 200);

  return { items, total: total || items.length };
}

export function CallerDetailsScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const empCode = String(params.empCode || '');
  const deposit = params.deposit;
  const ecs =
    params.activePlayersECS && typeof params.activePlayersECS === 'object'
      ? (params.activePlayersECS as Record<string, unknown>)
      : {};

  const user = getSessionUser() as {
    _id?: string;
    name?: string;
    extensionId?: unknown;
    serverId?: unknown;
  } | null;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);
  const canOpenReport = hasPermission('wallet_history', user);
  const hideContact = hasPermission('contact_visibility_none', user);
  const showCalling = !hideContact;
  const extensionIds = useMemo(() => extensionIdsOf(user), [user]);
  const numericCampaignId = useMemo(
    () => extensionIds.find((val) => /^\d+$/.test(val)) || '',
    [extensionIds],
  );

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [tab, setTab] = useState<TabKey>('Today');
  const [searchName, setSearchName] = useState('');
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [counts, setCounts] = useState({
    Today: 0,
    Active: 0,
    Warning: 0,
    Inactive: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dialerBusyId, setDialerBusyId] = useState<string | null>(null);
  const [addDialerBusy, setAddDialerBusy] = useState(false);

  const load = useCallback(async () => {
    if (!empCode) return;
    setLoading(true);
    setError(null);
    try {
      const [todayBundle, warning, aiRes] = await Promise.all([
        fetchAllTodayUsers({ empCode, startDate, endDate }),
        fetchAllWarningUsers({
          empCode,
          userId: user?._id ? String(user._id) : undefined,
        }),
        secureApi('caller.callerActiveInactive', {
          empCode,
          startDate: formatDaysAgoLocal(1),
          endDate: formatDaysAgoLocal(4),
          filter: {},
        }),
      ]);

      const { active, inactive } = unwrapActiveInactive(aiRes.data);
      const combined: DetailRow[] = [
        ...todayBundle.users.map((u) => ({ ...u, status: 'Today' })),
        ...active.map((u) => ({ ...u, status: 'Active' })),
        ...warning.items.map((u) => ({ ...u, status: 'Warning' })),
        ...inactive.map((u) => ({ ...u, status: 'Inactive' })),
      ];
      setRows(combined);
      setCounts({
        Today: todayBundle.count || todayBundle.users.length,
        Active: active.length,
        Warning: warning.total || warning.items.length,
        Inactive: inactive.length,
      });
      setSelectedIds(new Set());

      if (
        !aiRes.ok &&
        todayBundle.users.length === 0 &&
        warning.items.length === 0
      ) {
        setError('Failed to load caller details');
      }
    } finally {
      setLoading(false);
    }
  }, [empCode, startDate, endDate, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.status !== tab) return false;
      if (!q) return true;
      return rowName(row).toLowerCase().includes(q);
    });
  }, [rows, tab, searchName]);

  const columns = useMemo<DataTableColumn<DetailRow>[]>(
    () => [
      { key: 'name', label: 'Name', width: 140, render: (r) => rowName(r) },
      { key: 'dp', label: 'DP ID', width: 160, render: (r) => display(rowId(r) || '—') },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => maskMobile(r.mobile || r.userMobile, canShowMobile),
      },
      {
        key: 'alternateMobile',
        label: 'Alternate Mobile',
        width: 140,
        render: (r) => formatAlternateMobile(r.alternateMobile, canShowMobile),
      },
      { key: 'app', label: 'App Code', width: 100, render: (r) => rowApp(r) },
      { key: 'played', label: 'In (E/C/S)', width: 120, render: (r) => formatPlayed(r) },
      { key: 'created', label: 'Created At', width: 120, render: (r) => rowCreated(r) },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 130,
        render: (r) =>
          formatDisplayDate(r.activeUser || r.lastActivity || r.lastActive) || '—',
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
    ],
    [canShowMobile],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return columns.map((column) => ({
      label: column.label,
      value: column.render(selected, 0),
    }));
  }, [columns, selected]);

  const openUserReport = (row: DetailRow) => {
    const id = rowId(row);
    if (!canOpenReport || !id) return;
    navigation.navigate('/user-report', {
      userId: id,
      userName: rowName(row),
      played: formatPlayed(row),
    });
  };

  const addSingleToDialer = useCallback(
    async (row: DetailRow) => {
      const mobile = rowMobile(row);
      if (!mobile) {
        Alert.alert('Dialer', 'Mobile number not found');
        return;
      }
      if (!numericCampaignId) {
        Alert.alert('Dialer', 'Dialer extension / campaign ID not found for this admin');
        return;
      }
      setDialerBusyId(rowId(row) || 'pending');
      try {
        const res = await singleCallToDialer({
          lead: {
            _id: rowId(row),
            name: rowName(row),
            mobile,
            city: String(row.city || ''),
            state: String(row.state || ''),
            clientName: String(row.clientName || row.appName || ''),
          },
          extensionId: extensionIds,
          adminName: user?.name || 'ADMIN',
          serverId: user?.serverId,
        });
        Alert.alert(res.ok ? 'Dialer' : 'Dialer failed', res.message);
      } finally {
        setDialerBusyId(null);
      }
    },
    [extensionIds, numericCampaignId, user?.name, user?.serverId],
  );

  const addSelectedToDialer = useCallback(async () => {
    if (!numericCampaignId) {
      Alert.alert('Dialer', 'Dialer extension / campaign ID not found for this admin');
      return;
    }
    const selectedRows = rows.filter(
      (row) => row.status === 'Warning' && selectedIds.has(rowId(row)),
    );
    const leads = selectedRows
      .map((row) => ({
        _id: rowId(row),
        name: rowName(row),
        mobile: rowMobile(row),
        city: String(row.city || ''),
        state: String(row.state || ''),
        clientName: String(row.clientName || row.appName || ''),
      }))
      .filter((lead) => lead.mobile.replace(/\D/g, ''));
    if (!leads.length) {
      Alert.alert('Dialer', 'Leads should not be empty.');
      return;
    }
    setAddDialerBusy(true);
    try {
      const res = await addToDialerBatch({
        campaignId: numericCampaignId,
        serverId: user?.serverId != null ? String(user.serverId) : undefined,
        leads,
        listId: `9${numericCampaignId}`,
        listName: `${String(user?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
      });
      Alert.alert(res.ok ? 'Dialer' : 'Dialer failed', res.message);
      if (res.ok) setSelectedIds(new Set());
    } finally {
      setAddDialerBusy(false);
    }
  }, [numericCampaignId, rows, selectedIds, user?.name, user?.serverId]);

  const toggleSelect = useCallback((id: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const warningRows = useMemo(
    () => (tab === 'Warning' ? filtered : []),
    [tab, filtered],
  );
  const allWarningSelected =
    warningRows.length > 0 && warningRows.every((row) => selectedIds.has(rowId(row)));

  const toggleSelectAllWarning = useCallback(() => {
    setSelectedIds((prev) => {
      if (allWarningSelected) return new Set();
      return new Set(warningRows.map((row) => rowId(row)).filter(Boolean));
    });
  }, [allWarningSelected, warningRows]);

  if (!empCode) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Caller Details</Text>
        <Text style={styles.sub}>No caller selected.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Caller Details — {empCode}</Text>
      <Text style={styles.sub}>
        Deposit:{' '}
        {deposit != null && Number.isFinite(Number(deposit))
          ? Math.round(Number(deposit)).toLocaleString('en-IN')
          : '—'}
        {' · '}
        E:{display(ecs.E)} C:{display(ecs.C)} S:{display(ecs.S)}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      <TextInput
        style={styles.search}
        value={searchName}
        onChangeText={setSearchName}
        placeholder="Search by name"
        placeholderTextColor={colors.muted}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(['Today', 'Active', 'Warning', 'Inactive'] as const).map((key) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setTab(key);
                setSelectedIds(new Set());
              }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {key} ({counts[key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === 'Warning' && filtered.length > 0 ? (
        <View style={styles.dialerBar}>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllWarning}>
            <Text style={styles.selectAllText}>
              {allWarningSelected ? 'Clear selection' : 'Select all'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addDialerBtn,
              (addDialerBusy || selectedIds.size === 0 || dialerBusyId != null) && styles.addDialerBtnDisabled,
            ]}
            disabled={addDialerBusy || selectedIds.size === 0 || dialerBusyId != null}
            onPress={() => void addSelectedToDialer()}
          >
            <Text style={styles.addDialerBtnText}>
              {addDialerBusy
                ? 'Sending…'
                : selectedIds.size > 0
                  ? `Add to Dialer (${selectedIds.size})`
                  : 'Add to Dialer'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {!filtered.length ? (
            <Text style={styles.cardEmpty}>No {tab.toLowerCase()} users</Text>
          ) : (
            filtered.map((row, index) => {
              const name = rowName(row);
              const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
              const app = rowApp(row);
              const mobileVal = maskMobile(row.mobile || row.userMobile, canShowMobile);
              const city = display(row.city);
              const sub =
                [mobileVal !== '—' ? mobileVal : '', city !== '—' ? city : '']
                  .filter(Boolean)
                  .join(' · ') || '—';
              const status = String(row.status || tab);
              const warning = status === 'Warning';
              const inactive = status === 'Inactive';
              const id = rowId(row);
              const checked = selectedIds.has(id);
              const hasMobile = Boolean(rowMobile(row));
              const sending = Boolean(id) && dialerBusyId === id;
              return (
                <TouchableOpacity
                  key={`${id || index}-${index}`}
                  style={[styles.userCard, checked && styles.userCardSelected]}
                  onPress={() => setSelected(row)}
                  activeOpacity={0.7}
                >
                  {tab === 'Warning' ? (
                    <TouchableOpacity
                      style={[styles.checkBox, checked && styles.checkBoxOn]}
                      onPress={() => toggleSelect(id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.checkBoxText}>{checked ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.userCardMid}>
                    <Text
                      style={[
                        styles.userCardName,
                        canOpenReport && rowId(row) ? styles.userCardNameLink : null,
                      ]}
                      numberOfLines={1}
                      onPress={
                        canOpenReport && rowId(row)
                          ? () => openUserReport(row)
                          : undefined
                      }
                    >
                      {name}
                    </Text>
                    <Text style={styles.userCardSub} numberOfLines={1}>
                      {sub}
                    </Text>
                    <View style={styles.userCardTags}>
                      {app && app !== '—' ? (
                        <View style={styles.tagApp}>
                          <Text style={styles.tagAppText} numberOfLines={1}>
                            {app}
                          </Text>
                        </View>
                      ) : null}
                      {playParts(row).map((part) => {
                        const key = part.toUpperCase();
                        return (
                          <View
                            key={`${rowId(row)}-${part}`}
                            style={[
                              styles.tagPlay,
                              key === 'E' && styles.tagPlayE,
                              key === 'C' && styles.tagPlayC,
                              key === 'S' && styles.tagPlayS,
                            ]}
                          >
                            <Text style={styles.tagPlayText} numberOfLines={1}>
                              {PLAY_LABELS[key] || part}
                            </Text>
                          </View>
                        );
                      })}
                      {display(row.state) !== '—' ? (
                        <View style={[styles.tagApp, styles.tagState]}>
                          <Text style={styles.tagAppText} numberOfLines={1}>
                            {display(row.state)}
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.tagStatus,
                          warning
                            ? styles.tagWarning
                            : inactive
                              ? styles.tagInactive
                              : styles.tagActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagStatusText,
                            warning
                              ? styles.tagWarningText
                              : inactive
                                ? styles.tagInactiveText
                                : styles.tagActiveText,
                          ]}
                          numberOfLines={1}
                        >
                          {status}
                        </Text>
                      </View>
                    </View>
                    {showCalling && hasMobile ? (
                      <View style={styles.callBtnRow}>
                        <TouchableOpacity
                          style={[styles.callBtn, sending && styles.callBtnDisabled]}
                          disabled={sending || addDialerBusy}
                          onPress={() => void addSingleToDialer(row)}
                        >
                          <Text style={styles.callBtnText}>
                            {sending ? 'Sending…' : 'Add to Dialer'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.userCardRight}>
                    <Text style={styles.userCardBalance} numberOfLines={1}>
                      {rowCreated(row)}
                    </Text>
                    <Text style={styles.userCardIdx}>#{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          {filtered.length ? (
            <Text style={styles.cardHint}>Tap a card to see all details</Text>
          ) : null}
        </View>
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? rowName(selected) : ''}
        fields={sheetFields}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                ...(canOpenReport && rowId(selected)
                  ? [
                      {
                        label: 'View Details',
                        tone: 'primary' as const,
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          openUserReport(row);
                        },
                      },
                    ]
                  : []),
                ...(showCalling && rowMobile(selected)
                  ? [
                      {
                        label:
                          dialerBusyId && dialerBusyId === rowId(selected)
                            ? 'Sending…'
                            : 'Add to Dialer',
                        tone: 'primary' as const,
                        disabled: addDialerBusy || Boolean(dialerBusyId),
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          void addSingleToDialer(row);
                        },
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    marginTop: spacing(3),
    marginBottom: spacing(3),
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.primaryForeground },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loaderText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  cardList: {
    marginTop: spacing(1),
    gap: spacing(2),
  },
  cardEmpty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing(6),
    fontSize: 13,
  },
  cardHint: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing(1),
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(3),
  },
  userCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(245, 179, 1, 0.08)',
  },
  dialerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  selectAllBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  selectAllText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  addDialerBtn: {
    flex: 1,
    backgroundColor: '#ff9f0a',
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    alignItems: 'center',
  },
  addDialerBtnDisabled: {
    opacity: 0.5,
  },
  addDialerBtnText: {
    color: '#1a1200',
    fontSize: 12,
    fontWeight: '800',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBoxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkBoxText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '800',
  },
  callBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginTop: spacing(1.5),
  },
  callBtn: {
    backgroundColor: '#ff9f0a',
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 5,
  },
  callBtnDisabled: {
    opacity: 0.5,
  },
  callBtnText: {
    color: '#1a1200',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(245, 179, 1, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  userCardMid: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  userCardName: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 14,
  },
  userCardNameLink: {
    color: colors.foreground,
  },
  userCardSub: {
    color: colors.muted,
    fontSize: 12,
  },
  userCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(1),
  },
  tagApp: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
    flexShrink: 1,
  },
  tagState: {
    maxWidth: '72%',
  },
  tagAppText: {
    color: colors.foreground,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  tagPlay: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderWidth: 1,
    flexShrink: 0,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  tagPlayE: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  tagPlayC: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  tagPlayS: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  tagPlayText: {
    color: colors.foreground,
    fontSize: 10,
    fontWeight: '700',
  },
  tagStatus: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderWidth: 1,
    flexShrink: 0,
  },
  tagActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  tagWarning: {
    backgroundColor: 'rgba(245, 179, 1, 0.12)',
    borderColor: 'rgba(245, 179, 1, 0.4)',
  },
  tagInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  tagStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tagActiveText: {
    color: colors.success,
  },
  tagWarningText: {
    color: colors.primary,
  },
  tagInactiveText: {
    color: colors.muted,
  },
  userCardRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  userCardBalance: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 13,
  },
  userCardIdx: {
    color: colors.muted,
    fontSize: 10,
  },
});
