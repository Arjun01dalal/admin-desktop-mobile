/**
 * New Registers — full-column port of desktop NewRegistersPage.
 * Calls users.getAll with { itemsPerPage, pageNo, startDate, endDate, filter }.
 * Every desktop column is shown in a sideways-scrolling table; contact
 * columns are hidden for restricted roles like on desktop.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import {
  formatAadharAddress,
  flattenUserRow,
  nestedDpId,
  nestedName,
  pickAadharNumber,
  pickAccountNumber,
  pickAppName,
  pickBalance,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
  pickUserComesFrom,
} from '../../../dashboards/userRowUtils';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import { CAMPAIGN_LIST } from '../../../utils/campaignList';
import { addToDialerBatch, singleCallToDialer } from '../../../utils/externalDialer';
import { getRoleId, getRoleName, hasPermission } from '../../../auth/permissions';
import { CALLER_ROLE_IDS } from '../../../auth/callerRoles';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'appName', 'balance', 'created']);

/** Search fields mirroring desktop NewRegistersPage per-column filters (filter keys match).
 *  Contact-identifier fields are withheld for restricted roles like the desktop column filters. */
function newRegistersSearchFields(hideContact: boolean): readonly SearchFieldOption[] {
  const fields: SearchFieldOption[] = [
    { key: 'name', label: 'Name' },
    { key: '_id', label: 'Dp Id' },
    { key: 'userComesFrom', label: 'User Comes From' },
    { key: 'balance', label: 'Balance' },
    { key: 'played', label: 'In (E/C/S)' },
  ];
  if (!hideContact) {
    fields.push(
      { key: 'mobile', label: 'Mobile' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'aadhaarNumber', label: 'Aadhar' },
      { key: 'email', label: 'Email' },
    );
  }
  fields.push({ key: 'city', label: 'City' }, { key: 'state', label: 'State' });
  if (!hideContact) {
    fields.push(
      { key: 'referredCode', label: 'Referred Code' },
      { key: 'referralCodeUser', label: 'Referral Code' },
    );
  }
  return fields;
}

/** Mirror of desktop NewRegistersPage isNewRegistersCaller — caller roles must not see contact columns. */
function isNewRegistersCaller(): boolean {
  const id = String(getRoleId() || '');
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(getRoleName() || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  city?: string;
  state?: string;
  createdOn?: string;
  createdAt?: string;
  [key: string]: unknown;
};

type Response = {
  users?: Row[];
  items?: Row[];
  total?: number;
  count?: number;
  totalPages?: number;
  payload?: Response;
};

const PAGE_SIZE = 25;

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function NewRegistersScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none') || isNewRegistersCaller();

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const map: Record<string, string> = {};
      for (const item of Array.isArray(res.data) ? res.data : []) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [appClientName, setAppClientName] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  // New web-panel filters (reference: NewRegisterUsers)
  const [newRegistration, setNewRegistration] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'InActive'>('All');
  const [nonPerforming, setNonPerforming] = useState(false);
  const [otherState, setOtherState] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  // Stored admin — read once (fresh object each call would retrigger load).
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);

  // Add to Dialer — like the web panel, sends ALL currently loaded rows.
  const [campaignId, setCampaignId] = useState('');
  const [dialerOpen, setDialerOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [dialerMsg, setDialerMsg] = useState('');
  const [calling, setCalling] = useState(false);
  const [callMsg, setCallMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      const text = appliedSearch.text.trim();
      if (text) {
        if (appliedSearch.field === 'balance') {
          // Desktop sends balance as a number; keep a valid 0, drop non-numeric input.
          const num = Number(text);
          if (Number.isFinite(num)) filter.balance = num;
        } else {
          filter[appliedSearch.field] = text;
        }
      }
      if (otherState) filter.state = 'other';
      if (activeFilter === 'Active') filter.active = true;
      else if (activeFilter === 'InActive') filter.active = false;
      if (nonPerforming) filter.nonPerforming = true;

      const payload: Record<string, unknown> = {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
        startDate,
        endDate,
        newRegistration,
      };
      // Only send `app` when it actually restricts something — an empty
      // array/string makes the server match no apps and return 0 records.
      const adminApp = admin?.clientName || admin?.allotedApps;
      if (Array.isArray(adminApp) ? adminApp.length > 0 : typeof adminApp === 'string' && adminApp.trim()) {
        payload.app = adminApp;
      }

      const res = await secureApi<Response>('users.getAll', payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      if (res.success === false) {
        setError(res.message || 'Server rejected the request');
        setRows([]);
        return;
      }
      const data = (res.data || {}) as Response;
      const nested =
        data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
          ? data.payload
          : data;
      let list: Row[] = Array.isArray(res.data)
        ? (res.data as Row[])
        : nested.items || nested.users || data.items || data.users || [];
      setServerCount(list.length);

      // Web-panel post-fetch behavior:
      list = list.map((row) => {
        const flat = { ...flattenUserRow(row) } as Row;
        if (!String(flat.userComesFrom || '').trim()) {
          const picked = pickUserComesFrom(flat);
          if (picked !== 'Company') flat.userComesFrom = picked;
        }
        if (flat.balance == null || flat.balance === '') {
          const bal = pickBalance(flat);
          if (bal != null) flat.balance = bal;
        }
        return flat;
      });
      if (showEmpty) list = list.filter((v) => !v.activeUser);
      const states = Array.isArray(admin?.accessibleStates)
        ? (admin.accessibleStates as string[]).map((s) => String(s).toLowerCase())
        : [];
      if (states.length > 0) {
        list = list.filter((item) => states.includes(String(item.state || '').toLowerCase()));
      }
      list = [...list].sort((a, b) => {
        const valA = String(a.userComesFrom || '').trim();
        const valB = String(b.userComesFrom || '').trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        return valA.localeCompare(valB);
      });

      setSelected(null);
      setRows(list);
      setTotal(
        Number(nested.total ?? nested.count ?? data.total ?? data.count ?? 0) || list.length,
      );
    } finally {
      setLoading(false);
    }
  }, [
    appClientName,
    appliedSearch,
    endDate,
    page,
    pageSize,
    startDate,
    newRegistration,
    activeFilter,
    nonPerforming,
    otherState,
    showEmpty,
    admin,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  // Single Call — same as the web panel's per-row Call button (CallingBtn).
  const singleCall = useCallback(
    async (row: Row) => {
      setCallMsg('');
      setCalling(true);
      try {
        const res = await singleCallToDialer({
          lead: {
            _id: String(row._id || ''),
            name: row.name,
            mobile: row.mobile,
            city: row.city,
            state: row.state,
            clientName: row.clientName,
          },
          extensionId: admin?.extensionId as string[] | string | undefined,
          adminName: typeof admin?.name === 'string' ? admin.name : 'ADMIN',
          serverId: admin?.serverId,
        });
        setCallMsg(res.message);
      } finally {
        setCalling(false);
      }
    },
    [admin],
  );

  const addToDialer = useCallback(async () => {
    setDialerMsg('');
    if (!campaignId) {
      setDialerMsg('Campaign should not be empty');
      return;
    }
    if (!rows.length) {
      setDialerMsg('No users to send');
      return;
    }
    const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId.trim());
    setPushing(true);
    try {
      const res = await addToDialerBatch({
        campaignId,
        serverId: campaign?.serverId,
        leads: rows.map((r) => ({
          _id: String(r._id || ''),
          name: r.name,
          mobile: r.mobile,
          city: r.city,
          state: r.state,
          clientName: r.clientName,
        })),
      });
      setDialerMsg(res.message);
    } finally {
      setPushing(false);
    }
  }, [campaignId, rows]);

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name) },
      { key: 'dpId', label: 'DP ID', width: 150, render: (r) => display(r._id) },
      {
        key: 'userComesFrom',
        label: 'User Comes From',
        width: 110,
        render: (r) => pickUserComesFrom(r),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (r) => {
          const n = pickBalance(r);
          return n == null ? '—' : floorNum(n).toLocaleString('en-IN');
        },
      },
      { key: 'lastActivity', label: 'Last Activity', width: 150, render: (r) => pickLastActivity(r) },
    ];
    if (!hideContact) {
      cols.push({ key: 'userBankName', label: 'User Bank Name', width: 130, render: (r) => pickUserBankName(r) });
    }
    cols.push(
      { key: 'appName', label: 'App Code', width: 70, render: (r) => appCodeForName(pickAppName(r)) },
      { key: 'playIn', label: 'In', width: 90, render: (r) => pickPlayIn(r) },
      {
        key: 'encryptedDpId',
        label: 'User Encrypted Dp Id',
        width: 150,
        render: (r) => String(r.encryptedUserName || '-'),
      },
    );
    if (!hideContact) {
      cols.push(
        { key: 'mobile', label: 'Mobile Phone', width: 100, render: (r) => maskMobile(r.mobile, canShowMobile) },
        { key: 'kyc', label: 'Kyc', width: 70, render: (r) => (r.kyc === true ? 'Done' : 'Not Done') },
        { key: 'accountNumber', label: 'Account Number', width: 130, render: (r) => pickAccountNumber(r) },
        { key: 'aadharNumber', label: 'Aadhar Number', width: 120, render: (r) => pickAadharNumber(r) },
        { key: 'email', label: 'Email', width: 160, render: (r) => (canShowMobile ? display(r.email) : '**********') },
      );
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
    );
    if (!hideContact) {
      cols.push(
        { key: 'previousCallerName', label: 'Previous Caller Name', width: 130, render: (r) => nestedName(r.previousCaller) },
        { key: 'previousCallerDpId', label: 'Previous Caller Dp_ID', width: 150, render: (r) => nestedDpId(r.previousCaller) },
      );
    }
    cols.push({ key: 'empCode', label: 'Employee Code', width: 100, render: (r) => String(r.empCode || '-') });
    if (!hideContact) {
      cols.push(
        { key: 'currentCaller', label: 'Current Caller', width: 120, render: (r) => nestedName(r.currentCaller) },
        { key: 'referredCode', label: 'Referred Referral Code', width: 140, render: (r) => String(r.referredCode || '-') },
        { key: 'referralCode', label: 'Referral Code', width: 110, render: (r) => String(r.referralCodeUser || '-') },
      );
    }
    cols.push(
      { key: 'deviceType', label: 'Device Type', width: 90, render: (r) => String(r.deviceType || '-') },
      { key: 'playerAppVersion', label: 'User App Version', width: 110, render: (r) => String(r.currentAppVersion || '-') },
      {
        key: 'appVersion',
        label: 'App Version',
        width: 90,
        render: (r) => display(appVersions[String(pickAppName(r) || '')]),
      },
      {
        key: 'created',
        label: 'Created',
        width: 90,
        render: (r) => formatDisplayDate(r.createdOn || r.createdAt) || '-',
      },
      {
        key: 'time',
        label: 'Time',
        width: 80,
        render: (r) => formatDisplayTime(r.createdOn || r.createdAt) || '-',
      },
      {
        key: 'bonusBalance',
        label: 'Free Points Bonus',
        width: 110,
        align: 'right',
        render: (r) => floorNum(r.bonusWalletBalance ?? 0).toLocaleString('en-IN'),
      },
    );
    if (!hideContact) {
      cols.push(
        { key: 'blockReason', label: 'Block User Reason', width: 140, render: (r) => String(r.blockUserReason || '-') },
        { key: 'aadharAddress', label: 'Aadhar Address', width: 220, render: (r) => formatAadharAddress(r) },
      );
    }
    return cols;
  }, [page, pageSize, hideContact, canShowMobile, appVersions]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>New Registration</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total: {total.toLocaleString('en-IN')}
        {serverCount !== null && serverCount !== rows.length
          ? ` · server sent ${serverCount}, shown ${rows.length}`
          : ''}
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
          setPage(1);
        }}
        appClientName={appClientName}
        onAppChange={(v) => {
          setAppClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        searchFields={newRegistersSearchFields(hideContact)}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setAppliedSearch({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />
      {/* Web-panel quick filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.chip, newRegistration && styles.chipActive]}
          onPress={() => {
            setNewRegistration((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, newRegistration && styles.chipTextActive]}>
            New Registration: {newRegistration ? 'True' : 'False'}
          </Text>
        </TouchableOpacity>
        {(['All', 'Active', 'InActive'] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, activeFilter === opt && styles.chipActive]}
            onPress={() => {
              setActiveFilter(opt);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, activeFilter === opt && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, nonPerforming && styles.chipActive]}
          onPress={() => {
            setNonPerforming((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, nonPerforming && styles.chipTextActive]}>Non-Performing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, otherState && styles.chipActive]}
          onPress={() => {
            setOtherState((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, otherState && styles.chipTextActive]}>Other State</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, showEmpty && styles.chipActive]}
          onPress={() => setShowEmpty((v) => !v)}
        >
          <Text style={[styles.chipText, showEmpty && styles.chipTextActive]}>Show Empty Record</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add to Dialer — sends all users on the current page, like the website */}
      <TouchableOpacity style={styles.dialerHeader} onPress={() => setDialerOpen((o) => !o)}>
        <Text style={styles.dialerHeaderText}>
          Add to Dialer{campaignId ? ` · ${campaignId}` : ''} {dialerOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {dialerOpen && (
        <View style={styles.dialerCard}>
          <Text style={styles.dialerLabel}>Campaign</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
            {CAMPAIGN_LIST.map((c) => {
              const id = c.id.trim();
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, campaignId === id && styles.chipActive]}
                  onPress={() => setCampaignId(campaignId === id ? '' : id)}
                >
                  <Text style={[styles.chipText, campaignId === id && styles.chipTextActive]}>
                    {id} · {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.dialerHint}>
            Sends all {rows.length} users shown below to the selected campaign.
          </Text>
          <TouchableOpacity
            style={[styles.dialerBtn, (pushing || !rows.length || !campaignId) && styles.dialerBtnDisabled]}
            onPress={() => void addToDialer()}
            disabled={pushing || !rows.length || !campaignId}
          >
            <Text style={styles.dialerBtnText}>
              {pushing ? 'Sending…' : `Add ${rows.length} to Dialer`}
            </Text>
          </TouchableOpacity>
          {dialerMsg ? <Text style={styles.dialerMsg}>{dialerMsg}</Text> : null}
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No users found"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.name) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(selected, 0),
                  color: c.color?.(selected),
                }))
            : []
        }
        actions={
          selected && !hideContact && selected.mobile
            ? ([
                {
                  label: calling ? 'Sending to dialer…' : callMsg ? `Call — ${callMsg}` : 'Call (send to dialer)',
                  tone: 'primary',
                  disabled: calling,
                  onPress: () => void singleCall(selected),
                },
              ] satisfies SheetAction[])
            : undefined
        }
        onClose={() => {
          setSelected(null);
          setCallMsg('');
        }}
      />

      <View style={styles.pager}>
        <Text
          style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
          onPress={() => page > 1 && setPage((p) => p - 1)}
        >
          ‹ Prev
        </Text>
        <Text style={styles.pagerLabel}>
          Page {page} / {totalPages}
        </Text>
        <Text
          style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
          onPress={() => page < totalPages && setPage((p) => p + 1)}
        >
          Next ›
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
  dialerHeader: { marginTop: spacing(3) },
  dialerHeaderText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  dialerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(2),
  },
  dialerLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: spacing(1) },
  dialerHint: { color: colors.muted, fontSize: 11, marginTop: spacing(2) },
  dialerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginTop: spacing(2),
  },
  dialerBtnDisabled: { opacity: 0.5 },
  dialerBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  dialerMsg: { color: colors.foreground, fontSize: 12, marginTop: spacing(2), textAlign: 'center' },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
