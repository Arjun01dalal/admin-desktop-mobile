/**
 * Caller Responsibility — port of desktop CallerResponsibilityPage with the
 * mobile screen structure: date/caller-head/location filters, Summary card,
 * By Office Location table and Caller Data cards with a bottom detail sheet.
 * (Desktop's CSV validate + drill-down subpages are not ported yet.)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  flattenActiveBotUsersPayload,
  formatAutomationBotLabel,
  getActiveBotCountByType,
  parseAutomationBotCallsSummary,
  toDdMmYyyy,
  type ActiveBotSummaryItem,
  type ActiveBotUserRow,
  type AutomationBotCallsSummary,
} from '@astro/shared';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  FULL_ALLOTMENT_ROLE_IDS,
  OFFICE_LOCATIONS,
  RESP_TOTAL_DEPOSIT,
  type CallerRow,
} from '../../../auth/callerRoles';
import { hasPermission, Permissions } from '../../../auth/permissions';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { colors } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './CallerResponsibilityScreen.styles';

function botSummaryIcon(bot: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const key = String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_user' || key.includes('new')) return 'account-plus';
  if (key === 'non_performing' || key.includes('non_perform')) return 'alert-circle-outline';
  if (key === 'inactive') return 'pause-circle-outline';
  if (key === 'active') return 'trending-up';
  return 'robot-outline';
}

function botSummaryAccent(bot: string): string {
  const key = String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_user' || key.includes('new')) return '#60a5fa';
  if (key === 'non_performing' || key.includes('non_perform')) return '#fbbf24';
  if (key === 'inactive') return '#94a3b8';
  if (key === 'active') return '#34d399';
  return colors.primary;
}

type StoredCallerUser = {
  _id?: string;
  name?: string;
  Role_ID?: string;
  empCode?: string;
  Responsibilities?: string[];
};

function roleFlags(roleId?: string) {
  const id = String(roleId || '');
  const isCaller = CALLER_ROLE_IDS.has(id);
  const isCallerHead = CALLER_HEAD_ROLE_IDS.has(id);
  const isCallerOrHead = isCaller || isCallerHead;
  const isFullAllotment = FULL_ALLOTMENT_ROLE_IDS.has(id);
  return { isCaller, isCallerHead, isCallerOrHead, isFullAllotment };
}

function canSeeTotalDeposit(user: StoredCallerUser | null): boolean {
  const list = user?.Responsibilities;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(RESP_TOTAL_DEPOSIT);
}

function filterCallerRows(
  rows: CallerRow[],
  user: StoredCallerUser | null,
  isCaller: boolean,
  showCompany: boolean,
): CallerRow[] {
  return rows
    .filter((v) => (isCaller ? v.empCode === user?.empCode : !v.block))
    .filter((v) => (showCompany ? true : v.officeLocation !== 'Company'));
}

function roundAmt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-IN');
}

function cellText(value: unknown, empty = '-'): string {
  if (value === null || value === undefined || value === '') return empty;
  return String(value);
}

function pnl(deposit: unknown, withdrawApproved: unknown): string {
  const d = Number(deposit);
  const w = Number(withdrawApproved);
  if (!Number.isFinite(d) || !Number.isFinite(w)) return '-';
  return Math.round(d - w).toLocaleString('en-IN');
}

function displayName(value: unknown, empty = '-'): string {
  const s = String(value ?? '').trim();
  if (!s || s === 'not_assigned' || s === 'not assigned') return empty;
  return s;
}

function formatCallerHeads(value: unknown, empty = '-'): string {
  const parts = Array.isArray(value)
    ? value
    : value == null || value === ''
      ? []
      : String(value).split(/[,|]/);
  const names = parts
    .map((entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const rec = entry as Record<string, unknown>;
        return String(rec.name ?? rec.realName ?? '').trim();
      }
      return String(entry ?? '').trim();
    })
    .filter((s) => s && s !== 'not_assigned' && s !== 'not assigned');
  return names.length ? names.join(', ') : empty;
}

function ecs(row: CallerRow): Record<string, unknown> {
  return (row.activePlayersECS || {}) as Record<string, unknown>;
}

/** Full column set for the detail sheet. */
export function CallerResponsibilityScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();
  const { width: windowWidth } = useWindowDimensions();
  const user = getStoredUser<StoredCallerUser>();
  const { isCaller, isCallerHead, isCallerOrHead, isFullAllotment } = roleFlags(user?.Role_ID);
  const showTotalDeposit = canSeeTotalDeposit(user);
  const showCallerHead = !isCallerOrHead || isFullAllotment;
  const showLocation = !isCaller || isFullAllotment;
  const canShowBotAutomaticData = hasPermission(Permissions.show_bot_automatic_data, user);
  // Phone: 2 cols · tablet+: 3 cols
  const autoSummaryThreeCol = windowWidth >= 520;

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [callerHead, setCallerHead] = useState('');
  const [office, setOffice] = useState('');
  const [heads, setHeads] = useState<CallerRow[]>([]);
  const [callerRows, setCallerRows] = useState<CallerRow[]>([]);
  const [locationRows, setLocationRows] = useState<CallerRow[]>([]);
  const [payload, setPayload] = useState<CallerRow>({});
  const [botUsers, setBotUsers] = useState<ActiveBotUserRow[]>([]);
  const [botCount, setBotCount] = useState(0);
  const [botSummary, setBotSummary] = useState<ActiveBotSummaryItem[]>([]);
  const [automationBotCallsSummary, setAutomationBotCallsSummary] =
    useState<AutomationBotCallsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(null);
  const genRef = useRef(0);
  const didInitialLoad = useRef(false);

  const openDepositList = useCallback(
    (row: CallerRow, type: 'deposit' | 'withdrawal' | 'uniquePending' = 'deposit') => {
      openPanelTarget(navigation, {
        href: '/caller-responsibility/deposit-list',
        state: {
          list: row,
          type,
          empCode: row.empCode,
          startDate,
          endDate,
        },
      });
      setSelected(null);
    },
    [navigation, startDate, endDate],
  );

  const openCallerDetails = useCallback(
    (row: CallerRow) => {
      openPanelTarget(navigation, {
        href: '/caller-responsibility/details',
        state: {
          empCode: row.empCode,
          deposit: row.totalDeposit,
          activePlayersECS: row.activePlayersECS,
          list: row,
          startDate,
          endDate,
        },
      });
      setSelected(null);
    },
    [navigation, startDate, endDate],
  );

  const loadHeads = useCallback(async () => {
    const res = await secureApi('caller.subadminsByRole', { filter: {} });
    if (!res.ok || res.success === false) return;
    const byRole = (res.data as { byRole?: Array<{ roleId?: string; subAdmins?: CallerRow[] }> })
      ?.byRole;
    const merged = (byRole ?? [])
      .filter((r) => CALLER_HEAD_ROLE_IDS.has(String(r.roleId)))
      .flatMap((r) => r.subAdmins ?? [])
      .filter((v) => !v.block);
    setHeads(merged);
  }, []);

  const loadMain = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        startDate,
        endDate,
        callerHead: isCallerHead ? user?.name || '' : callerHead,
      };
      if (office) body.officeLocation = office;

      const botTasks = canShowBotAutomaticData
        ? ([
            secureApi('caller.activeUsersFromCallsByAutomationBot', { startDate, endDate }),
            secureApi('caller.automationBotCallsSummary', {
              startDate: toDdMmYyyy(startDate),
              endDate: toDdMmYyyy(endDate),
            }),
          ] as const)
        : null;

      const [depRes, botRes, summaryRes] = await Promise.all([
        secureApi('caller.depositByEmpcodeOffice', body),
        botTasks ? botTasks[0] : Promise.resolve(null),
        botTasks ? botTasks[1] : Promise.resolve(null),
      ]);
      if (gen !== genRef.current) return; // stale response

      if (!depRes.ok || depRes.success === false) {
        setError(depRes.message || 'Failed to load caller data');
        setCallerRows([]);
        setLocationRows([]);
        setPayload({});
      } else {
        const data = (depRes.data || {}) as CallerRow;
        const byEmp = Array.isArray(data.byEmpCode) ? (data.byEmpCode as CallerRow[]) : [];
        setCallerRows(filterCallerRows(byEmp, user, isCaller, showTotalDeposit));
        setLocationRows(
          Array.isArray(data.byOfficeLocation) ? (data.byOfficeLocation as CallerRow[]) : [],
        );
        setPayload(data);
        setError('');
      }

      if (botRes && botRes.ok && botRes.success !== false) {
        const flat = flattenActiveBotUsersPayload(botRes.data);
        setBotUsers(flat.users);
        setBotCount(flat.total);
        setBotSummary(flat.summary);
      } else if (canShowBotAutomaticData) {
        setBotUsers([]);
        setBotCount(0);
        setBotSummary([]);
      }

      if (summaryRes && summaryRes.ok && summaryRes.success !== false) {
        setAutomationBotCallsSummary(parseAutomationBotCallsSummary(summaryRes.data));
      } else if (canShowBotAutomaticData) {
        setAutomationBotCallsSummary(null);
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    startDate,
    endDate,
    callerHead,
    office,
    isCallerHead,
    isCaller,
    showTotalDeposit,
    canShowBotAutomaticData,
  ]);

  useEffect(() => {
    void loadHeads();
  }, [loadHeads]);

  // Mount once + when applied filters change (Apply). Avoid double fire from Strict Mode.
  useEffect(() => {
    if (!didInitialLoad.current) {
      didInitialLoad.current = true;
      void loadMain();
      return;
    }
    void loadMain();
  }, [startDate, endDate, callerHead, office]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedBotCount = isCaller ? 0 : botCount;
  const newUserBotCount = isCaller
    ? 0
    : getActiveBotCountByType(botSummary, 'new_user', 'new user');
  const activeBotTypeCount = isCaller
    ? 0
    : getActiveBotCountByType(botSummary, 'active', 'non_performing', 'non performing');
  const inactiveBotCount = isCaller ? 0 : getActiveBotCountByType(botSummary, 'inactive');

  const openBotUsers = useCallback(() => {
    if (isCaller || displayedBotCount <= 0) return;
    openPanelTarget(navigation, {
      href: '/caller-responsibility/bot-users',
      state: {
        activeBotUsers: botUsers,
        activeBotUsersCount: botCount,
        botSummary,
        startDate,
        endDate,
      },
    });
  }, [isCaller, displayedBotCount, navigation, botUsers, botCount, botSummary, startDate, endDate]);

  const summaryItems = useMemo(() => {
    const summary = (payload.summary || {}) as CallerRow;
    const items: { label: string; value: string }[] = [
      {
        label: "Total Employee (Caller's)",
        value: cellText(isCallerOrHead ? 0 : summary.totalEmpCodes),
      },
    ];
    if (showLocation) {
      items.push({
        label: 'Total Office Location',
        value: cellText(isCallerOrHead ? 0 : summary.totalOfficeLocations),
      });
    }
    items.push(
      {
        label: 'Total Transaction',
        value: cellText(isCallerOrHead ? 0 : summary.totalTransactions),
      },
      {
        label: 'Total Active Customers',
        value: cellText(isCallerOrHead ? 0 : payload.totalActiveUsers),
      },
      {
        label: 'Total Transaction Count',
        value: String(isCallerOrHead ? 0 : roundAmt(payload.totalDeposit)),
      },
      { label: 'Active Customers By Bot', value: String(displayedBotCount) },
    );
    return items;
  }, [isCallerOrHead, payload, displayedBotCount, showLocation]);

  const locationColumns = useMemo<DataTableColumn<CallerRow>[]>(
    () => [
      {
        key: 'office',
        label: 'Office Location',
        width: 120,
        render: (r) => cellText(r.officeLocation),
      },
      {
        key: 'txn',
        label: 'Txn Count',
        width: 90,
        align: 'right',
        render: (r) => cellText(r.transactionCount),
      },
      {
        key: 'active',
        label: 'Active Customers',
        width: 110,
        align: 'right',
        render: (r) => cellText(r.activeUserCount),
      },
      {
        key: 'deposit',
        label: 'Total Deposit',
        width: 110,
        align: 'right',
        render: (r) => roundAmt(r.totalDeposit),
      },
      {
        key: 'wApp',
        label: 'Refund Approved Amt',
        width: 130,
        align: 'right',
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        key: 'pnl',
        label: 'PNL',
        width: 100,
        align: 'right',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        key: 'wPend',
        label: 'Refund Pending Amt',
        width: 130,
        align: 'right',
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        key: 'wAppC',
        label: 'Refund Approved Count',
        width: 130,
        align: 'right',
        render: (r) => cellText(r.withdrawalApprovedCount),
      },
      {
        key: 'wPendC',
        label: 'Refund Pending Count',
        width: 130,
        align: 'right',
        render: (r) => cellText(r.withdrawalPendingCount),
      },
    ],
    [],
  );

  const callerColumns = useMemo<DataTableColumn<CallerRow>[]>(() => {
    const cols: DataTableColumn<CallerRow>[] = [
      { key: 'sr', label: 'SR. No', width: 60, render: (_r, i) => String(i + 1) },
      {
        key: 'pseudo',
        label: 'Pseudo Name',
        width: 130,
        render: (r) => String(r.subAdminName ?? 'Company'),
      },
    ];
    // Callers must not see employee real names — Pseudo Name only.
    if (!isCaller) {
      cols.push({
        key: 'real',
        label: 'Real Name',
        width: 130,
        render: (r) => displayName(r.realName),
      });
    }
    if (showLocation) {
      cols.push({
        key: 'office',
        label: 'Office Location',
        width: 110,
        render: (r) => cellText(r.officeLocation),
      });
    }
    cols.push(
      {
        key: 'deposit',
        label: 'Total Deposit',
        width: 110,
        align: 'right',
        render: (r) => roundAmt(r.totalDeposit),
      },
      {
        key: 'wAppAmt',
        label: 'Refund Approved Amt',
        width: 130,
        align: 'right',
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        key: 'pnl',
        label: 'PNL',
        width: 100,
        align: 'right',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        key: 'wPendAmt',
        label: 'Refund Pending Amt',
        width: 130,
        align: 'right',
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        key: 'wAppCnt',
        label: 'Refund Approved Count',
        width: 130,
        align: 'right',
        render: (r) => cellText(r.withdrawalApprovedCount),
      },
      {
        key: 'wPendCnt',
        label: 'Refund Pending Count',
        width: 130,
        align: 'right',
        render: (r) => cellText(r.withdrawalPendingCount),
      },
      {
        key: 'activeCust',
        label: 'Active Customers',
        width: 110,
        align: 'right',
        render: (r) => cellText(r.transactionCount),
      },
      {
        key: 'ex',
        label: 'E',
        width: 60,
        align: 'right',
        render: (r) => cellText(r.activeUserCount),
      },
      { key: 'casino', label: 'C', width: 60, align: 'right', render: (r) => cellText(ecs(r).E) },
      { key: 'matka', label: 'S', width: 60, align: 'right', render: (r) => cellText(ecs(r).C) },
    );
    cols.push({
      key: 'daily',
      label: 'Daily Deposit',
      width: 100,
      align: 'right',
      render: (r) => roundAmt(ecs(r).S),
    });
    if (!isCaller) {
      cols.push({ key: 'status', label: 'Status', width: 100, render: (r) => cellText(r.time) });
    }
    cols.push({ key: 'emp', label: 'Emp Code', width: 100, render: (r) => cellText(r.empCode) });
    cols.push({
      key: 'head',
      label: 'Caller Head',
      width: 130,
      render: (r) => formatCallerHeads(r.callerHead),
    });
    return cols;
  }, [isCaller, showLocation]);

  const applyAll = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }, [draftStart, draftEnd]);

  const onCallerPress = useCallback((row: CallerRow, index: number) => {
    setSelected({ row, index });
  }, []);

  const header = useMemo(
    () => (
      <View>
        <Text style={styles.title}>Caller Responsibility</Text>
        <Text style={styles.sub}>
          {isCaller
            ? 'Tap a caller row for details & view lists'
            : `${startDate} → ${endDate} · Tap a caller row for details & view lists`}
        </Text>

        {!isCaller ? (
          <DetailFilterBar
            startDate={draftStart}
            endDate={draftEnd}
            loading={loading}
            onStartDateChange={setDraftStart}
            onEndDateChange={setDraftEnd}
            onApply={applyAll}
          />
        ) : null}

        {!isCaller && (
          <>
            {showCallerHead && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                <View style={styles.chipRow}>
                  <Text style={styles.chipRowLabel}>Caller Head</Text>
                  <TouchableOpacity
                    style={[styles.chip, callerHead === '' && styles.chipActive]}
                    onPress={() => setCallerHead('')}
                  >
                    <Text style={[styles.chipText, callerHead === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {heads.map((h) => {
                    const name = String(h.name || '');
                    return (
                      <TouchableOpacity
                        key={String(h._id || name)}
                        style={[styles.chip, callerHead === name && styles.chipActive]}
                        onPress={() => setCallerHead(name)}
                      >
                        <Text
                          style={[styles.chipText, callerHead === name && styles.chipTextActive]}
                        >
                          {name || cellText(h.empCode)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {showLocation && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                <View style={styles.chipRow}>
                  <Text style={styles.chipRowLabel}>Location</Text>
                  <TouchableOpacity
                    style={[styles.chip, office === '' && styles.chipActive]}
                    onPress={() => setOffice('')}
                  >
                    <Text style={[styles.chipText, office === '' && styles.chipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {OFFICE_LOCATIONS.map((o) => (
                    <TouchableOpacity
                      key={o}
                      style={[styles.chip, office === o && styles.chipActive]}
                      onPress={() => setOffice(o)}
                    >
                      <Text style={[styles.chipText, office === o && styles.chipTextActive]}>
                        {o}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {canShowBotAutomaticData ? (
              <View style={styles.botPanel}>
                <TouchableOpacity
                  onPress={openBotUsers}
                  disabled={isCaller || displayedBotCount <= 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.botLine}>
                    Active Customer (By Bots):{' '}
                    <Text style={styles.botCount}>{displayedBotCount}</Text>
                  </Text>
                  <View style={styles.botChipRow}>
                    <Text style={[styles.botChip, styles.botChipNew]}>New User: {newUserBotCount}</Text>
                    <Text style={[styles.botChip, styles.botChipActive]}>
                      Active: {activeBotTypeCount}
                    </Text>
                    <Text style={[styles.botChip, styles.botChipInactive]}>
                      Inactive: {inactiveBotCount}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.autoSummaryHeader}>
                  <MaterialCommunityIcons name="robot" size={18} color={colors.primary} />
                  <View style={styles.autoSummaryHeaderText}>
                    <Text style={styles.autoSummaryTitle}>Automation Bot Calls Summary</Text>
                    <View style={styles.autoSummaryMetaRow}>
                      <Text style={styles.autoSummaryMeta}>
                        {automationBotCallsSummary?.startDate
                          ? `${automationBotCallsSummary.startDate} – ${automationBotCallsSummary.endDate}`
                          : `${startDate} – ${endDate}`}
                      </Text>
                      <Text style={styles.autoSummaryMeta}>·</Text>
                      <MaterialCommunityIcons name="phone-in-talk" size={13} color={colors.muted} />
                      <Text style={styles.autoSummaryMeta}>
                        Total {automationBotCallsSummary?.total ?? 0}
                      </Text>
                    </View>
                  </View>
                </View>
                {(automationBotCallsSummary?.bots || []).length ? (
                  <View style={styles.autoSummaryGrid}>
                    {(automationBotCallsSummary?.bots || []).map((item) => {
                      const accent = botSummaryAccent(item.bot);
                      return (
                        <View
                          key={item.bot}
                          style={[
                            styles.autoSummaryCard,
                            autoSummaryThreeCol && styles.autoSummaryCardWide,
                          ]}
                        >
                          <View style={styles.autoSummaryBotRow}>
                            <View style={[styles.autoSummaryIconWrap, { backgroundColor: `${accent}22` }]}>
                              <MaterialCommunityIcons
                                name={botSummaryIcon(item.bot)}
                                size={18}
                                color={accent}
                              />
                            </View>
                            <Text style={styles.autoSummaryBot} numberOfLines={1}>
                              {formatAutomationBotLabel(item.bot)}
                            </Text>
                          </View>
                          <View style={styles.autoStatRow}>
                            <MaterialCommunityIcons name="check-circle" size={14} color="#16a34a" />
                            <Text style={styles.autoOk}>Successful: {item.successful}</Text>
                          </View>
                          <View style={styles.autoStatRow}>
                            <MaterialCommunityIcons name="close-circle" size={14} color="#dc2626" />
                            <Text style={styles.autoFail}>Unsuccessful: {item.unsuccessful}</Text>
                          </View>
                          <View style={styles.autoStatRow}>
                            <MaterialCommunityIcons name="phone" size={14} color={colors.foreground} />
                            <Text style={styles.autoTotal}>Total: {item.total}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.autoEmptyRow}>
                    <MaterialCommunityIcons name="robot-off-outline" size={16} color={colors.muted} />
                    <Text style={styles.autoEmpty}>No automation bot call records</Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={openBotUsers}
                disabled={isCaller || displayedBotCount <= 0}
                activeOpacity={0.7}
              >
                <Text style={styles.botLine}>
                  Active Customer (By Bots):{' '}
                  <Text style={styles.botCount}>{displayedBotCount}</Text>
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading data…</Text>
          </View>
        ) : null}

        {!loading && showTotalDeposit && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryGrid}>
              {summaryItems.map((it) => {
                const isBot = it.label === 'Active Customers By Bot';
                const Card = isBot ? TouchableOpacity : View;
                return (
                  <Card
                    key={it.label}
                    style={styles.summaryCard}
                    onPress={isBot ? openBotUsers : undefined}
                    activeOpacity={isBot ? 0.7 : undefined}
                  >
                    <Text style={styles.summaryLabel}>{it.label}</Text>
                    <Text style={[styles.summaryValue, isBot && styles.botCount]}>{it.value}</Text>
                  </Card>
                );
              })}
            </View>
          </>
        )}

        {!loading && showTotalDeposit && showLocation && (
          <>
            <Text style={styles.sectionTitle}>By Office Location</Text>
            <DataTable
              columns={locationColumns}
              rows={locationRows}
              keyFor={(r, i) => String(r.officeLocation || i)}
              emptyMessage={loading ? 'Loading…' : 'No office data'}
            />
          </>
        )}

        {!loading && <Text style={styles.sectionTitle}>Caller Data</Text>}
      </View>
    ),
    [
      startDate,
      endDate,
      isCaller,
      draftStart,
      draftEnd,
      loading,
      applyAll,
      showCallerHead,
      callerHead,
      heads,
      showLocation,
      office,
      displayedBotCount,
      openBotUsers,
      canShowBotAutomaticData,
      newUserBotCount,
      activeBotTypeCount,
      inactiveBotCount,
      automationBotCallsSummary,
      autoSummaryThreeCol,
      startDate,
      endDate,
      error,
      showTotalDeposit,
      summaryItems,
      locationColumns,
      locationRows,
    ],
  );

  return (
    <>
      <FlatList
        showsVerticalScrollIndicator={false}
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={loading ? [] : callerRows}
        keyExtractor={(r, i) => String(r.empCode || r._id || i)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadMain()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={loading ? null : <Text style={styles.emptyList}>No caller data</Text>}
        renderItem={({ item, index }) => {
          const deposit = Number(item.totalDeposit);
          const withdraw = Number(item.withdrawalApprovedAmount);
          const pnlNum =
            Number.isFinite(deposit) && Number.isFinite(withdraw)
              ? Math.round(deposit - withdraw)
              : null;
          return (
            <Pressable
              onPress={() => onCallerPress(item, index)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {String(item.subAdminName ?? 'Company')}
                </Text>
                {showLocation ? (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {cellText(item.officeLocation)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Deposit: {roundAmt(item.totalDeposit)}
                </Text>
                <Text
                  style={[
                    styles.cardSplitRight,
                    pnlNum != null && pnlNum < 0
                      ? { color: colors.destructive }
                      : pnlNum != null
                        ? { color: colors.success }
                        : null,
                  ]}
                  numberOfLines={1}
                >
                  PNL: {pnl(item.totalDeposit, item.withdrawalApprovedAmount)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Refund: {roundAmt(item.withdrawalApprovedAmount)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Active: {cellText(item.transactionCount)}
                </Text>
              </View>
              <Text style={styles.cardHeadLine} numberOfLines={2}>
                Head: {formatCallerHeads(item.callerHead)}
              </Text>
              <Text style={styles.cardHint}>Tap card for details & lists</Text>
            </Pressable>
          );
        }}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={
          selected ? String(selected.row.subAdminName || selected.row.empCode || 'Details') : ''
        }
        fields={
          selected
            ? callerColumns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected.row, selected.index),
              }))
            : []
        }
        actions={
          selected
            ? [
                {
                  label: 'Details',
                  tone: 'primary',
                  onPress: () => openCallerDetails(selected.row),
                },
                {
                  label: 'View Deposit',
                  onPress: () => openDepositList(selected.row, 'deposit'),
                },
                {
                  label: 'View Refund List',
                  onPress: () => openDepositList(selected.row, 'withdrawal'),
                },
                {
                  label: 'View Unique Pending',
                  onPress: () => openDepositList(selected.row, 'uniquePending'),
                },
              ]
            : undefined
        }
        onClose={() => setSelected(null)}
      />
    </>
  );
}

