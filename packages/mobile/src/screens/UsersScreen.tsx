/**
 * Users — mobile port of desktop UsersPage.
 * All user types (User / Sub_Admin / Todays_Active / Active_User /
 * Non_Performing_User / In_Active_Deposit / Non_Performing_Active_User /
 * LAXMI_999_Users) with the desktop action + payload mapping, server search,
 * pagination, row detail sheet, OTP-gated block/unblock and Create User.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { USER_TYPES, type UserType } from '@astro/shared/userTypes';
import { colors } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import type { DataTableColumn } from '../dashboards/ui/DataTable';
import { pickLastActivity } from '../dashboards/userRowUtils';
import { secureApi } from '../api/client';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getSessionUser, hasPermission, isCallerRole } from '../auth/permissions';
import { formatDisplayDate, todayIST } from '../utils/dates';
import { DetailFilterBar, type SearchFieldKey } from './dashboards/details/DetailFilterBar';
import { RowDetailSheet, type SheetField } from './dashboards/details/RowDetailSheet';
import { CreateUserScreen } from './CreateUserScreen';
import { mapUsersToBotSettings } from '../utils/dialerHelpers';
import { CAMPAIGN_LIST } from '../utils/campaignList';
import { addToDialerBatch, singleCallToDialer } from '../utils/externalDialer';
import { BlockUserModal } from './users/BlockUserModal';
import { DumpUserModal } from './users/DumpUserModal';
import {
  CALLER_HIDDEN,
  PAGE_SIZE,
  TYPE_ACTION,
  display,
  filterCallerEmpScope,
  isBlocked,
  maskMobile,
  reasonForUserType,
  searchFieldsFor,
  type Row,
} from './users/helpers';
import { styles } from './UsersScreen.styles';

type UsersListResponse = {
  items?: Row[];
  users?: Row[];
  user?: Row[];
  data?: Row[];
  totalPages?: number;
  total?: number;
  count?: number;
};

type UsersRouteParams = {
  selectActiveCustomers?: boolean;
  startDate?: string;
  endDate?: string;
};

export function UsersScreen() {
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');
  const admin = useMemo(() => getSessionUser(), []);
  const isCaller = useMemo(() => isCallerRole(admin), [admin]);
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const route = useRoute();
  const routeParams = (route.params || {}) as UsersRouteParams;
  const canOpenReport = hasPermission('wallet_history');
  const canCreate = !isCaller && hasPermission('create_new_user');

  const typeOptions = useMemo(
    () =>
      USER_TYPES.filter((t) => {
        if (t === 'Sub_Admin' && !hasPermission('View_Subadmin_User')) return false;
        if (isCaller && CALLER_HIDDEN.includes(t)) return false;
        return true;
      }),
    [isCaller],
  );

  const [userType, setUserType] = useState<UserType>(() =>
    routeParams.selectActiveCustomers && !isCaller ? 'Todays_Active' : 'User',
  );
  const [draftStart, setDraftStart] = useState(
    () => (routeParams.selectActiveCustomers && routeParams.startDate) || todayIST(),
  );
  const [draftEnd, setDraftEnd] = useState(
    () => (routeParams.selectActiveCustomers && routeParams.endDate) || todayIST(),
  );
  const [dates, setDates] = useState<{ start: string; end: string } | null>(() =>
    routeParams.selectActiveCustomers
      ? {
          start: String(routeParams.startDate || todayIST()),
          end: String(routeParams.endDate || todayIST()),
        }
      : null,
  );
  const [appClientName, setAppClientName] = useState('');
  const [blockFilter, setBlockFilter] = useState<'' | 'block' | 'unblock'>('');
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
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [blockRow, setBlockRow] = useState<Row | null>(null);
  const [dumpRow, setDumpRow] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Dashboard Today's Active → Users with selectActiveCustomers
  useEffect(() => {
    if (!routeParams.selectActiveCustomers || isCaller) return;
    setUserType('Todays_Active');
    const start = String(routeParams.startDate || todayIST());
    const end = String(routeParams.endDate || todayIST());
    setDraftStart(start);
    setDraftEnd(end);
    setDates({ start, end });
    setPage(1);
  }, [
    isCaller,
    routeParams.endDate,
    routeParams.selectActiveCustomers,
    routeParams.startDate,
  ]);

  // Global Add-to-Bot / Add-to-Dialer (desktop UsersToolbar parity).
  const canAddToBot = !isCaller && hasPermission('add_to_bot');
  const canAddToDialer = !isCaller && hasPermission('add_to_dilaler');
  /** Laxmi CallingBtn column — hidden only with contact_visibility_none. */
  const showCalling = !hideContact;
  const [dialerOpen, setDialerOpen] = useState(false);
  const [botId, setBotId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [dialerBusy, setDialerBusy] = useState(false);
  const [dialerMsg, setDialerMsg] = useState('');
  const [callConfirmRow, setCallConfirmRow] = useState<Row | null>(null);
  const [callBusy, setCallBusy] = useState(false);

  const adminRec = useMemo(() => (admin ?? {}) as Record<string, unknown>, [admin]);
  const extensionIds = useMemo(() => {
    const raw = adminRec.extensionId;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [] as string[];
  }, [adminRec.extensionId]);
  const numericCampaignId = useMemo(
    () => extensionIds.find((val) => /^\d+$/.test(val)) || '',
    [extensionIds],
  );
  const dialerListId = numericCampaignId ? `9${numericCampaignId}` : '—';
  const dialerListName = `${String(adminRec.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`;

  const confirmManualCall = useCallback(async () => {
    const row = callConfirmRow;
    if (!row) return;
    const mobile = String(row.mobile || '').trim();
    if (!mobile) {
      Alert.alert('No mobile number for this user');
      return;
    }
    if (!numericCampaignId) {
      Alert.alert('Dialer extension / campaign ID not found for this admin');
      return;
    }
    setCallBusy(true);
    try {
      const res = await singleCallToDialer({
        lead: {
          _id: String(row._id || ''),
          name: row.name,
          mobile,
          city: row.city,
          state: row.state,
          clientName: row.clientName,
        },
        extensionId: extensionIds,
        adminName: typeof adminRec.name === 'string' ? adminRec.name : 'ADMIN',
        serverId: adminRec.serverId,
      });
      Alert.alert(res.ok ? 'Dialer' : 'Dialer failed', res.message);
      if (res.ok) setCallConfirmRow(null);
    } finally {
      setCallBusy(false);
    }
  }, [adminRec, callConfirmRow, extensionIds, numericCampaignId]);

  const handleAddToBot = useCallback(async () => {
    setDialerMsg('');
    if (!botId.trim()) {
      setDialerMsg('Bot ID should not be empty.');
      return;
    }
    if (!rows.length) {
      setDialerMsg('No users available for bot');
      return;
    }
    setDialerBusy(true);
    try {
      const adminRec = (admin ?? {}) as Record<string, unknown>;
      const res = await secureApi('callLogs.addToBotDialer', {
        userId: adminRec._id,
        created_by: adminRec.name,
        dialout_settings: mapUsersToBotSettings(rows, botId.trim(), reasonForUserType(userType)),
      });
      setDialerMsg(
        res.ok
          ? res.message || 'Call Initiated Successfully.'
          : res.message || 'Failed to add to bot',
      );
    } finally {
      setDialerBusy(false);
    }
  }, [admin, botId, rows, userType]);

  const handleAddToDialer = useCallback(async () => {
    setDialerMsg('');
    if (!campaignId) {
      setDialerMsg('Campaign Name should not be empty');
      return;
    }
    if (!rows.length) {
      setDialerMsg('No users available for dialer');
      return;
    }
    const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId.trim());
    setDialerBusy(true);
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
      if (res.ok) {
        const adminRec = (admin ?? {}) as Record<string, unknown>;
        await secureApi('ops.savePerformanceData', {
          subAdminId: adminRec._id,
          dialledUserIds: rows.map((r) => r._id).filter(Boolean),
          extensionId: campaignId,
        });
      }
      setDialerMsg(res.message || (res.ok ? 'Dialer call queued' : 'Dialer call failed'));
    } finally {
      setDialerBusy(false);
    }
  }, [admin, campaignId, rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const adminRec = (admin ?? {}) as Record<string, unknown>;
      const loginEmpCode = String(adminRec.empCode || '').trim();
      const callerEmpScoped = isCaller && userType !== 'Sub_Admin';
      if (callerEmpScoped && !loginEmpCode) {
        setError('No empCode on this login. Ask admin to assign empCode.');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      const filter: Record<string, unknown> = {};
      if (
        userType !== 'Sub_Admin' &&
        userType !== 'LAXMI_999_Users' &&
        userType !== 'Active_User'
      ) {
        filter.uniqueUser = false;
      }
      if (appliedSearch.text.trim() && !(callerEmpScoped && appliedSearch.field === 'empCode')) {
        filter[appliedSearch.field] = appliedSearch.text.trim();
      }
      if (blockFilter && userType === 'User') filter.blockUser = blockFilter === 'block';
      // Caller default list = own emp; when searching DP ID / name / etc. omit empCode
      // so 001 (unassigned) users can be returned, then scoped client-side.
      const callerSearchingOther =
        callerEmpScoped &&
        Boolean(appliedSearch.text.trim()) &&
        appliedSearch.field !== 'empCode';
      const searchingDpId =
        Boolean(appliedSearch.text.trim()) &&
        (appliedSearch.field === '_id' || appliedSearch.field === 'dpId');
      if (
        callerEmpScoped &&
        loginEmpCode &&
        userType !== 'In_Active_Deposit' &&
        !callerSearchingOther
      ) {
        filter.empCode = loginEmpCode;
      }

      // Operator scoping (desktop UsersPage): allotted apps + per-app states.
      // Exact DP ID lookup skips app scope so 001 leads outside appWithState still resolve.
      const allottedApps = (adminRec.clientName || adminRec.allotedApps) as
        string | string[] | undefined;
      const app =
        userType !== 'User' && allottedApps && !searchingDpId ? { app: allottedApps } : {};
      let withAppState: Record<string, unknown> = {};
      const aws = adminRec.appWithState;
      if (
        !searchingDpId &&
        userType !== 'User' &&
        userType !== 'Sub_Admin' &&
        aws &&
        typeof aws === 'object' &&
        !Array.isArray(aws)
      ) {
        const map = aws as Record<string, unknown>;
        const scoped: Record<string, string[]> = {};
        if (appClientName && Array.isArray(map[appClientName])) {
          scoped[appClientName] = [...(map[appClientName] as string[])];
        } else {
          for (const [key, states] of Object.entries(map)) {
            if (Array.isArray(states)) scoped[key] = [...(states as string[])];
          }
        }
        if (Object.keys(scoped).length > 0) withAppState = { appWithState: scoped };
      }

      if (appClientName && userType !== 'Sub_Admin' && userType !== 'LAXMI_999_Users' && !searchingDpId) {
        filter.clientName = appClientName;
      }

      let payload: Record<string, unknown>;
      switch (userType) {
        case 'Sub_Admin':
          payload = {
            pageNo: page,
            itemPerPage: pageSize,
            ...(Object.keys(filter).length ? { filter } : {}),
          };
          break;
        case 'Non_Performing_User':
          payload = {
            pageNo: page,
            itemPerPage: pageSize,
            filter,
            ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
            ...app,
            ...withAppState,
          };
          break;
        case 'Non_Performing_Active_User':
          payload = { filter };
          break;
        case 'LAXMI_999_Users':
          payload = { pageNo: page, itemsPerPage: pageSize, filter };
          break;
        case 'Active_User':
          payload = {
            pageNo: page,
            itemsPerPage: pageSize,
            filter,
            ...(dates ? { activeUserStartDate: dates.start, activeUserEndDate: dates.end } : {}),
            ...app,
            ...withAppState,
          };
          break;
        default:
          // User / Todays_Active / In_Active_Deposit
          payload = {
            pageNo: page,
            itemsPerPage: pageSize,
            filter,
            ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
            ...(userType === 'User'
              ? { activeUserStart: '', activeUserEnd: '' }
              : { ...app, ...withAppState }),
          };
      }
      const res = await secureApi<UsersListResponse | Row[]>(TYPE_ACTION[userType], payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      const raw = Array.isArray(res.data) ? {} : (res.data ?? {});
      let list = Array.isArray(res.data)
        ? res.data
        : (raw.items ?? raw.users ?? raw.user ?? raw.data ?? []);
      if (callerEmpScoped && loginEmpCode) {
        list = filterCallerEmpScope(list, loginEmpCode, Boolean(callerSearchingOther));
      }
      setSelected(null);
      setRows(list);
      setTotalPages(Math.max(1, Number(raw.totalPages ?? 1) || 1));
      setTotal(Number(raw.total ?? raw.count ?? list.length) || 0);
    } finally {
      setLoading(false);
    }
  }, [admin, appClientName, appliedSearch, blockFilter, dates, isCaller, page, pageSize, userType]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
    ];
    if (userType === 'Sub_Admin') {
      cols.push(
        {
          key: 'mobile',
          label: 'Mobile',
          width: 110,
          render: (r) => maskMobile(r.mobile, canShowMobile),
        },
        { key: 'role', label: 'Role', width: 120, render: (r) => display(r.Role_Name) },
        {
          key: 'telegram',
          label: 'Telegram',
          width: 120,
          render: (r) => display(r.telegramUsername),
        },
        { key: 'email', label: 'Email', width: 160, render: (r) => display(r.email) },
        {
          key: 'lastActivity',
          label: 'Last Activity',
          width: 150,
          render: (r) => pickLastActivity(r),
        },
      );
      return cols;
    }
    cols.push({ key: 'dpId', label: 'Dp Id', width: 150, render: (r) => display(r._id) });
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      });
    }
    cols.push(
      { key: 'appName', label: 'App', width: 48, render: (r) => appCodeForName(r.clientName) },
      { key: 'empCode', label: 'Emp Code', width: 70, render: (r) => display(r.empCode) },
      { key: 'playIn', label: 'In', width: 60, render: (r) => display(r.played) },
      { key: 'kyc', label: 'Kyc', width: 60, render: (r) => (r.kyc ? 'Yes' : 'No') },
    );
    if (!hideContact) {
      cols.push({
        key: 'email',
        label: 'Email',
        width: 160,
        render: (r) => (canShowMobile ? display(r.email) : '**********'),
      });
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'deviceType',
        label: 'Device Type',
        width: 90,
        render: (r) => display(r.deviceType),
      },
      {
        key: 'playerAppVersion',
        label: 'Player App Ver',
        width: 100,
        render: (r) => display(r.currentAppVersion),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'totalDeposit',
        label: 'Total Deposit',
        width: 100,
        align: 'right',
        render: (r) => floorNum(r.totalDeposit ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'blocked',
        label: 'Status',
        width: 80,
        render: (r) => (isBlocked(r) ? 'Blocked' : 'Active'),
        color: (r) => (isBlocked(r) ? colors.destructive : undefined),
      },
      {
        key: 'created',
        label: 'Created',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
    );
    return cols;
  }, [page, pageSize, userType, hideContact, canShowMobile]);

  const showBlockAction = userType !== 'Sub_Admin' && !isCaller;
  // Callers may dump users from the same user types (Laxmi parity).
  const showDumpAction = ['User', 'Non_Performing_User', 'Todays_Active', 'Active_User'].includes(
    userType,
  );

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
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>
        </View>
        {canCreate ? (
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createBtnText}>＋ Create</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {typeOptions.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, userType === t && styles.chipActive]}
            onPress={() => {
              setUserType(t);
              setPage(1);
              setSearchField('name');
              setSearchDraft('');
              setAppliedSearch({ field: 'name', text: '' });
            }}
          >
            <Text style={[styles.chipText, userType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {userType === 'User' ? (
        <View style={styles.chipRowPlain}>
          {(
            [
              ['', 'All'],
              ['block', 'Blocked'],
              ['unblock', 'Unblocked'],
            ] as const
          ).map(([v, label]) => (
            <TouchableOpacity
              key={label}
              style={[styles.chip, blockFilter === v && styles.chipActive]}
              onPress={() => {
                setBlockFilter(v);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, blockFilter === v && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setDates({ start: draftStart, end: draftEnd });
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
        searchFields={searchFieldsFor(userType, hideContact, isCaller)}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setAppliedSearch({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />

      {canAddToBot || canAddToDialer ? (
        <View style={styles.dialerCard}>
          <TouchableOpacity style={styles.dialerToggle} onPress={() => setDialerOpen((v) => !v)}>
            <Text style={styles.dialerToggleText}>
              Add to Bot / Dialer {dialerOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {dialerOpen ? (
            <View style={styles.dialerBody}>
              {canAddToBot ? (
                <View style={styles.dialerRow}>
                  <TextInput
                    style={styles.dialerInput}
                    value={botId}
                    onChangeText={setBotId}
                    placeholder="Bot ID"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[
                      styles.dialerBtn,
                      (dialerBusy || !rows.length) && styles.dialerBtnDisabled,
                    ]}
                    onPress={() => void handleAddToBot()}
                    disabled={dialerBusy || !rows.length}
                  >
                    <Text style={styles.dialerBtnText}>
                      {dialerBusy ? 'Sending…' : `Add to Bot (${rows.length})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {canAddToDialer ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {CAMPAIGN_LIST.map((c, ci) => {
                      const id = c.id.trim();
                      return (
                        <TouchableOpacity
                          key={`camp-${ci}`}
                          style={[styles.chip, campaignId === id && styles.chipActive]}
                          onPress={() => setCampaignId(campaignId === id ? '' : id)}
                        >
                          <Text
                            style={[styles.chipText, campaignId === id && styles.chipTextActive]}
                          >
                            {c.name} ({id})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    style={[
                      styles.dialerBtn,
                      (dialerBusy || !rows.length || !campaignId) && styles.dialerBtnDisabled,
                    ]}
                    onPress={() => void handleAddToDialer()}
                    disabled={dialerBusy || !rows.length || !campaignId}
                  >
                    <Text style={styles.dialerBtnText}>
                      {dialerBusy ? 'Sending…' : `Add to Dialer (${rows.length})`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
              {dialerMsg ? <Text style={styles.dialerMsg}>{dialerMsg}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.cardList}>
        {loading && !rows.length ? (
          <Text style={styles.cardEmpty}>Loading…</Text>
        ) : !rows.length ? (
          <Text style={styles.cardEmpty}>No users found</Text>
        ) : (
          rows.map((r, i) => {
            const blocked = isBlocked(r);
            const name = display(r.name);
            const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
            const app = appCodeForName(r.clientName);
            const mobileVal = !hideContact || canShowMobile ? display(r.mobile) : '';
            const sub =
              userType === 'Sub_Admin'
                ? display(r.Role_Name)
                : [
                    mobileVal !== '—' ? mobileVal : '',
                    display(r.city) !== '—' ? display(r.city) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—';
            return (
              <TouchableOpacity
                key={`user-${i}-${String(r._id || '')}`}
                style={styles.userCard}
                onPress={() => setSelected(r)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, blocked && styles.avatarBlocked]}>
                  <Text style={[styles.avatarText, blocked && styles.avatarTextBlocked]}>
                    {initial}
                  </Text>
                </View>
                <View style={styles.userCardMid}>
                  <Text
                    style={[
                      styles.userCardName,
                      canOpenReport && r._id ? styles.userCardNameLink : null,
                    ]}
                    numberOfLines={1}
                    onPress={
                      canOpenReport && r._id
                        ? () =>
                            navigation.navigate('/user-report', {
                              userId: String(r._id),
                              userName: name,
                            })
                        : undefined
                    }
                  >
                    {name}
                  </Text>
                  <Text style={styles.userCardSub} numberOfLines={1}>
                    {sub}
                  </Text>
                  <View style={styles.userCardTags}>
                    {app ? (
                      <View style={styles.tagApp}>
                        <Text style={styles.tagAppText} numberOfLines={1}>
                          {app}
                        </Text>
                      </View>
                    ) : null}
                    {display(r.empCode) !== '—' ? (
                      <View style={styles.tagApp}>
                        <Text style={styles.tagAppText} numberOfLines={1}>
                          Emp {display(r.empCode)}
                        </Text>
                      </View>
                    ) : null}
                    {display(r.state) !== '—' ? (
                      <View style={[styles.tagApp, styles.tagState]}>
                        <Text style={styles.tagAppText} numberOfLines={1}>
                          {display(r.state)}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[styles.tagStatus, blocked ? styles.tagBlocked : styles.tagActive]}
                    >
                      <Text
                        style={[
                          styles.tagStatusText,
                          blocked ? styles.tagBlockedText : styles.tagActiveText,
                        ]}
                        numberOfLines={1}
                      >
                        {blocked ? 'Blocked' : 'Active'}
                      </Text>
                    </View>
                  </View>
                  {showCalling && userType !== 'Sub_Admin' && String(r.mobile || '').trim() ? (
                    <View style={styles.callBtnRow}>
                      <TouchableOpacity
                        style={[styles.callBtn, callBusy && styles.dialerBtnDisabled]}
                        disabled={callBusy}
                        onPress={() => {
                          setSelected(null);
                          setCallConfirmRow(r);
                        }}
                      >
                        <Text style={styles.callBtnText}>Call</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <View style={styles.userCardRight}>
                  <Text style={styles.userCardBalance}>
                    ₹{floorNum(r.balance ?? 0).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.userCardIdx}>#{(page - 1) * pageSize + i + 1}</Text>
                  {showBlockAction ? (
                    <TouchableOpacity
                      style={[styles.blockBtn, blocked ? styles.blockBtnUnblock : null]}
                      onPress={() => setBlockRow(r)}
                    >
                      <Text
                        style={[styles.blockBtnText, blocked ? styles.blockBtnUnblockText : null]}
                      >
                        {blocked ? 'Unblock' : 'Block'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {rows.length ? <Text style={styles.cardHint}>Tap a card to see all details</Text> : null}
      </View>

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
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                ...(canOpenReport && selected._id
                  ? [
                      {
                        label: 'View Details',
                        tone: 'primary' as const,
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          navigation.navigate('/user-report', {
                            userId: String(row._id),
                            userName: display(row.name),
                          });
                        },
                      },
                    ]
                  : []),
                ...(showCalling && userType !== 'Sub_Admin' && String(selected.mobile || '').trim()
                  ? [
                      {
                        label: 'Call (Add to Dialer)',
                        tone: 'primary' as const,
                        disabled: callBusy,
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          setCallConfirmRow(row);
                        },
                      },
                    ]
                  : []),
                ...(showBlockAction
                  ? [
                      {
                        label: isBlocked(selected) ? 'Unblock User' : 'Block User',
                        tone: isBlocked(selected) ? ('primary' as const) : ('warning' as const),
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          setBlockRow(row);
                        },
                      },
                    ]
                  : []),
                ...(showDumpAction
                  ? [
                      {
                        label: 'Dump User',
                        tone: 'warning' as const,
                        onPress: () => {
                          const row = selected;
                          setSelected(null);
                          setDumpRow(row);
                        },
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />

      <Modal
        visible={callConfirmRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !callBusy && setCallConfirmRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Details</Text>
            <Text style={styles.modalSub}>
              {display(callConfirmRow?.name)} · {display(callConfirmRow?.mobile)}
            </Text>
            <View style={styles.callConfirmBox}>
              <Text style={styles.callConfirmLabel}>CAMPAIGN ID</Text>
              <Text style={styles.callConfirmValue}>{numericCampaignId || '—'}</Text>
              <Text style={styles.callConfirmLabel}>LIST ID</Text>
              <Text style={styles.callConfirmValue}>{dialerListId}</Text>
              <Text style={styles.callConfirmLabel}>LIST NAME</Text>
              <Text style={styles.callConfirmValue}>{dialerListName}</Text>
            </View>
            <Text style={styles.modalSub}>Do you want to proceed with this details?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.mBtn, styles.mBtnGhost]}
                onPress={() => setCallConfirmRow(null)}
                disabled={callBusy}
              >
                <Text style={styles.mBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.mBtn,
                  styles.mBtnPrimary,
                  (callBusy || !numericCampaignId) && styles.disabled,
                ]}
                onPress={() => void confirmManualCall()}
                disabled={callBusy || !numericCampaignId}
              >
                <Text style={styles.mBtnPrimaryText}>{callBusy ? 'Sending…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BlockUserModal row={blockRow} onClose={() => setBlockRow(null)} onDone={() => void load()} />
      <DumpUserModal
        row={dumpRow}
        onClose={() => setDumpRow(null)}
        onDone={(userId) => {
          // Local remove only — full reload after dump freezes the list.
          setRows((prev) => prev.filter((r) => r._id !== userId));
          setTotal((prev) => Math.max(0, prev - 1));
          setSelected((prev) => (prev?._id === userId ? null : prev));
        }}
      />

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.createWrap}>
          <View style={styles.createHead}>
            <Text style={styles.createTitle}>Create User</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)} hitSlop={8}>
              <Text style={styles.createClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <CreateUserScreen />
        </View>
      </Modal>

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
