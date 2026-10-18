/**
 * Users — mobile port of desktop UsersPage.
 * All user types (User / Sub_Admin / Todays_Active / Active_User /
 * Non_Performing_User / In_Active_Deposit / Non_Performing_Active_User /
 * LAXMI_999_Users) with the desktop action + payload mapping, server search,
 * pagination, row detail sheet, OTP-gated block/unblock and Create User.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { BALANCE_RANGE_OPTIONS, USER_TYPES, type UserType } from '@astro/shared/userTypes';
import { colors } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import type { DataTableColumn } from '../dashboards/ui/DataTable';
import {
  nestedDpId,
  nestedName,
  pickAccountNumber,
  pickAadharNumber,
  pickLastActivity,
  pickUserBankName,
} from '../dashboards/userRowUtils';
import { secureApi } from '../api/client';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getSessionUser, hasPermission, isCallerRole } from '../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../utils/dates';
import { DetailFilterBar, type SearchFieldKey } from './dashboards/details/DetailFilterBar';
import { RowDetailSheet, type SheetField } from './dashboards/details/RowDetailSheet';
import { CreateUserScreen } from './CreateUserScreen';
import { mapUsersToBotSettings } from '../utils/dialerHelpers';
import { AddToC2cCampaignPanel } from '../components/AddToC2cCampaignPanel';
import {
  BlockUserModal,
  DumpUserModal,
  useUsersList,
  usersStyles as styles,
} from '../features/users';
import {
  CALLER_HIDDEN,
  PAGE_SIZE,
  display,
  isBlocked,
  maskMobile,
  reasonForUserType,
  searchFieldsFor,
  type Row,
} from '../features/users/helpers';

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
  const canCreate =
    !isCaller &&
    (hasPermission('create_new_user') || hasPermission('create_admin_user'));

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
  const [balanceRange, setBalanceRange] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [blockRow, setBlockRow] = useState<Row | null>(null);
  const [dumpRow, setDumpRow] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

  const adminRec = useMemo(() => (admin ?? {}) as Record<string, unknown>, [admin]);
  const {
    rows,
    total,
    totalPages,
    loading,
    refreshing,
    error,
    refresh: refreshUsers,
  } = useUsersList({
    userType,
    page,
    pageSize,
    dates,
    appClientName,
    blockFilter,
    balanceRange,
    appliedSearch,
    isCaller,
    admin: adminRec,
  });

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

  // Global Add-to-Bot (desktop UsersToolbar parity).
  const canAddToBot = !isCaller && hasPermission('add_to_bot');
  const [dialerOpen, setDialerOpen] = useState(false);
  const [botId, setBotId] = useState('');
  const [dialerBusy, setDialerBusy] = useState(false);
  const [dialerMsg, setDialerMsg] = useState('');

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
        subAdminId: adminRec._id,
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

  // Fresh list from API — clear row sheet when data changes.
  useEffect(() => {
    setSelected(null);
  }, [rows]);

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
    if (!isCaller) {
      cols.push({
        key: 'bank',
        label: 'User Bank Name',
        width: 140,
        render: (r) => pickUserBankName(r),
      });
    }
    cols.push(
      { key: 'appName', label: 'App', width: 48, render: (r) => appCodeForName(r.clientName) },
      { key: 'empCode', label: 'Emp Code', width: 70, render: (r) => display(r.empCode) },
      { key: 'playIn', label: 'In', width: 60, render: (r) => display(r.played) },
      {
        key: 'encryptedDpId',
        label: 'User Encrypted Dp Id',
        width: 160,
        render: (r) => display(r.encryptedUserName),
      },
    );
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      });
    }
    if (!isCaller) {
      cols.push(
        { key: 'kyc', label: 'Kyc', width: 60, render: (r) => (r.kyc ? 'Yes' : 'No') },
        {
          key: 'account',
          label: 'Account Number',
          width: 140,
          render: (r) => pickAccountNumber(r),
        },
        {
          key: 'aadhaar',
          label: 'Aadhar Number',
          width: 140,
          render: (r) => pickAadharNumber(r),
        },
      );
    }
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
    );
    if (!isCaller) {
      cols.push(
        {
          key: 'prevCaller',
          label: 'Previous Caller Name',
          width: 130,
          render: (r) => nestedName(r.previousCaller),
        },
        {
          key: 'prevCallerDp',
          label: 'Previous Caller Dp_ID',
          width: 150,
          render: (r) => nestedDpId(r.previousCaller),
        },
      );
    }
    cols.push(
      {
        key: 'currCaller',
        label: 'Current Caller',
        width: 130,
        render: (r) => nestedName(r.currentCaller),
      },
      {
        key: 'referredCode',
        label: 'Referred Referral Code',
        width: 140,
        render: (r) => display(r.referredCode),
      },
      {
        key: 'referralCode',
        label: 'Referral Code',
        width: 120,
        render: (r) => display(r.referralCodeUser),
      },
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
        key: 'appVersion',
        label: 'App Version',
        width: 100,
        render: (r) => {
          const key = String(r.clientName || '');
          return key && appVersions[key] ? appVersions[key] : '—';
        },
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
    );
    if (!isCaller) {
      cols.push({
        key: 'totalDeposit',
        label: 'Total Deposit',
        width: 100,
        align: 'right',
        render: (r) => floorNum(r.totalDeposit ?? 0).toLocaleString('en-IN'),
      });
    }
    cols.push(
      {
        key: 'created',
        label: 'Created',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 80,
        render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) || '—' : '—'),
      },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 150,
        render: (r) => pickLastActivity(r),
      },
      {
        key: 'bonusBalance',
        label: 'Bonus Balance',
        width: 110,
        align: 'right',
        render: (r) =>
          floorNum(r.bonusWalletBalance ?? r.bonusBalance ?? r.bonus ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'blocked',
        label: 'Status',
        width: 80,
        render: (r) => (isBlocked(r) ? 'Blocked' : 'Active'),
        color: (r) => (isBlocked(r) ? colors.destructive : undefined),
      },
    );
    return cols;
  }, [page, pageSize, userType, hideContact, canShowMobile, isCaller, appVersions]);

  const showBlockAction = userType !== 'Sub_Admin' && !isCaller;
  // Callers may dump users from the same user types (Laxmi parity).
  const showDumpAction = ['User', 'Non_Performing_User', 'Todays_Active', 'Active_User'].includes(
    userType,
  );

  const renderUserCard = useCallback(
    ({ item: r, index: i }: ListRenderItemInfo<Row>) => (
      <UserCard
        row={r}
        index={i}
        page={page}
        pageSize={pageSize}
        userType={userType}
        hideContact={hideContact}
        canShowMobile={canShowMobile}
        canOpenReport={canOpenReport}
        showBlockAction={showBlockAction}
        onOpenSheet={() => setSelected(r)}
        onOpenReport={() =>
          navigation.navigate('/user-report', {
            userId: String(r._id),
            userName: display(r.name),
          })
        }
        onBlock={() => setBlockRow(r)}
      />
    ),
    [
      page,
      pageSize,
      userType,
      hideContact,
      canShowMobile,
      canOpenReport,
      showBlockAction,
      navigation,
    ],
  );

  const listHeader = (
    <>
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
              setBalanceRange('');
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

      {userType !== 'Sub_Admin' &&
      userType !== 'Non_Performing_Active_User' &&
      userType !== 'LAXMI_999_Users' ? (
        <View style={styles.balanceFilterWrap}>
          <Text style={styles.balanceFilterLabel}>Select Balance Range</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRowPlain}
          >
            {BALANCE_RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value || 'all'}
                style={[styles.chip, balanceRange === opt.value && styles.chipActive]}
                onPress={() => {
                  setBalanceRange(opt.value);
                  setPage(1);
                }}
              >
                <Text
                  style={[styles.chipText, balanceRange === opt.value && styles.chipTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

      {canAddToBot ? (
        <View style={styles.dialerCard}>
          <TouchableOpacity style={styles.dialerToggle} onPress={() => setDialerOpen((v) => !v)}>
            <Text style={styles.dialerToggleText}>Add to Bot {dialerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {dialerOpen ? (
            <View style={styles.dialerBody}>
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
              {dialerMsg ? <Text style={styles.dialerMsg}>{dialerMsg}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <AddToC2cCampaignPanel
        userIds={rows.map((r) => String(r._id || '').trim()).filter(Boolean)}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(r, i) => `user-${i}-${String(r._id || '')}`}
        renderItem={renderUserCard}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.cardEmpty}>{loading ? 'Loading…' : 'No users found'}</Text>
        }
        ListFooterComponent={
          <>
            {rows.length ? <Text style={styles.cardHint}>Tap a card to see all details</Text> : null}
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
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshUsers()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        windowSize={7}
        maxToRenderPerBatch={8}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
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

      <BlockUserModal
        row={blockRow}
        onClose={() => setBlockRow(null)}
        onDone={() => void refreshUsers()}
      />
      <DumpUserModal
        row={dumpRow}
        onClose={() => setDumpRow(null)}
        onDone={(userId) => {
          setSelected((prev) => (prev?._id === userId ? null : prev));
          void refreshUsers();
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
          <CreateUserScreen
            onCreated={() => {
              setCreateOpen(false);
              void refreshUsers();
            }}
          />
        </View>
      </Modal>
    </>
  );
}

type UserCardProps = {
  row: Row;
  index: number;
  page: number;
  pageSize: number;
  userType: UserType;
  hideContact: boolean;
  canShowMobile: boolean;
  canOpenReport: boolean;
  showBlockAction: boolean;
  onOpenSheet: () => void;
  onOpenReport: () => void;
  onBlock: () => void;
};

const UserCard = memo(function UserCard({
  row: r,
  index: i,
  page,
  pageSize,
  userType,
  hideContact,
  canShowMobile,
  canOpenReport,
  showBlockAction,
  onOpenSheet,
  onOpenReport,
  onBlock,
}: UserCardProps) {
  const blocked = isBlocked(r);
  const name = display(r.name);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const app = appCodeForName(r.clientName);
  const mobileVal = !hideContact || canShowMobile ? display(r.mobile) : '';
  const sub =
    userType === 'Sub_Admin'
      ? display(r.Role_Name)
      : [mobileVal !== '—' ? mobileVal : '', display(r.city) !== '—' ? display(r.city) : '']
          .filter(Boolean)
          .join(' · ') || '—';

  return (
    <TouchableOpacity style={styles.userCard} onPress={onOpenSheet} activeOpacity={0.7}>
      <View style={[styles.avatar, blocked && styles.avatarBlocked]}>
        <Text style={[styles.avatarText, blocked && styles.avatarTextBlocked]}>{initial}</Text>
      </View>
      <View style={styles.userCardMid}>
        <Text
          style={[styles.userCardName, canOpenReport && r._id ? styles.userCardNameLink : null]}
          numberOfLines={1}
          onPress={canOpenReport && r._id ? onOpenReport : undefined}
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
          <View style={[styles.tagStatus, blocked ? styles.tagBlocked : styles.tagActive]}>
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
      </View>
      <View style={styles.userCardRight}>
        <Text style={styles.userCardBalance}>
          ₹{floorNum(r.balance ?? 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.userCardIdx}>#{(page - 1) * pageSize + i + 1}</Text>
        {showBlockAction ? (
          <TouchableOpacity
            style={[styles.blockBtn, blocked ? styles.blockBtnUnblock : null]}
            onPress={onBlock}
          >
            <Text style={[styles.blockBtnText, blocked ? styles.blockBtnUnblockText : null]}>
              {blocked ? 'Unblock' : 'Block'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
