/**
 * Active Bot Users — card list (mobile).
 * Uses `/SubAdmin/active-users-from-calls-by-automation-bot` (payload.bots[].users).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  flattenActiveBotUsersPayload,
  formatAutomationBotLabel,
  type ActiveBotSummaryItem,
  type ActiveBotUserRow,
} from '@astro/shared';
import { secureApi } from '../../../api/client';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { DateField } from '../../../components/DateField';
import { colors } from '../../../theme';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './ActiveBotUsersScreen.styles';
import { maskMobile } from '../../../utils/display';

type ListParams = {
  activeBotUsers?: ActiveBotUserRow[];
  activeBotUsersCount?: number;
  botSummary?: ActiveBotSummaryItem[];
  startDate?: string;
  endDate?: string;
};

/** Yesterday IST — previous-activity filter max (web parity). */
function previousActivityMaxDate(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function toDateKey(value?: unknown): string {
  if (value == null || value === '') return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatBalance(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function firstBotId(row: ActiveBotUserRow): string {
  const ids = row.botIds;
  if (Array.isArray(ids) && ids.length > 0) return String(ids[0] ?? '-');
  if (ids != null && ids !== '') return String(ids);
  return '-';
}

function lastActivity(row: ActiveBotUserRow): string {
  const raw = row.activeUser ?? row.lastActivity ?? row.updatedOn ?? row.updatedAt;
  return raw ? formatDisplayDate(String(raw)) : '-';
}

function previousActivity(row: ActiveBotUserRow): string {
  const raw = row.lastSecondActivity ?? row.previousActivity ?? row.prevActivity;
  return raw ? formatDisplayDate(String(raw)) : '-';
}

function playedLabel(row: ActiveBotUserRow): string {
  const played = row.played;
  if (Array.isArray(played) && played.length) return played.map(String).join(', ');
  if (played != null && played !== '') return String(played);
  return '—';
}

type BotTone = 'new' | 'active' | 'nonPerf' | 'inactive' | 'default';

function botTone(bot: string): BotTone {
  const key = String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_user' || key === 'new_register' || key.includes('new')) return 'new';
  if (key === 'non_performing' || key.includes('non_perform')) return 'nonPerf';
  if (key === 'inactive') return 'inactive';
  if (key === 'active') return 'active';
  return 'default';
}

function botPillStyles(tone: BotTone) {
  switch (tone) {
    case 'new':
      return { pill: styles.botPillNew, text: styles.botPillTextNew };
    case 'active':
      return { pill: styles.botPillActive, text: styles.botPillTextActive };
    case 'nonPerf':
      return { pill: styles.botPillNonPerf, text: styles.botPillTextNonPerf };
    case 'inactive':
      return { pill: styles.botPillInactive, text: styles.botPillTextInactive };
    default:
      return { pill: styles.botPillDefault, text: styles.botPillTextDefault };
  }
}

function botFilterChipStyles(tone: BotTone, selected: boolean) {
  if (!selected) return { chip: null, text: null };
  switch (tone) {
    case 'new':
      return { chip: styles.filterChipNew, text: styles.filterChipTextNew };
    case 'active':
      return { chip: styles.filterChipActiveBot, text: styles.filterChipTextActiveBot };
    case 'nonPerf':
      return { chip: styles.filterChipNonPerf, text: styles.filterChipTextNonPerf };
    case 'inactive':
      return { chip: styles.filterChipInactive, text: styles.filterChipTextInactive };
    default:
      return { chip: styles.filterChipActive, text: null };
  }
}

const BotUserCard = memo(function BotUserCard({
  row,
  index,
  canShowMobile,
  onPress,
}: {
  row: ActiveBotUserRow;
  index: number;
  canShowMobile: boolean;
  onPress: () => void;
}) {
  const name = String(row.name || row.userName || '-');
  const botKey = String(row.botType || firstBotId(row));
  const botLabel = formatAutomationBotLabel(botKey);
  const tone = botTone(botKey);
  const pillStyle = botPillStyles(tone);
  const dpId = String(row._id || row.userId || '');
  return (
    <TouchableOpacity
      style={[styles.card, styles.cardGap]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {String(row.clientName || row.appName || '—')}
        </Text>
      </View>

      <View style={[styles.botPill, pillStyle.pill]}>
        <Text style={[styles.botPillText, pillStyle.text]}>{botLabel}</Text>
      </View>

      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          Emp Code: {String(row.empCode || row.emp_code || '—')}
        </Text>
        <Text style={[styles.cardSplitRight, styles.balanceValue]} numberOfLines={1}>
          ₹ {formatBalance(row.balance)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          DP: {dpId || '—'}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          Bot ID: {firstBotId(row)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          Mobile: {maskMobile(row.mobile || row.userMobile, canShowMobile)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          App: {String(row.clientName || row.appName || '—')}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          Played: {playedLabel(row)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          Last: {lastActivity(row)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          Prev Activity: {previousActivity(row)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          {String(row.city || '—')}, {String(row.state || '—')}
        </Text>
      </View>
      <Text style={styles.cardHint}>Tap card for full details</Text>
    </TouchableOpacity>
  );
});

export function ActiveBotUsersScreen() {
  const params = (useRoute().params ?? {}) as ListParams;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, getSessionUser());
  const hadNavUsers = Array.isArray(params.activeBotUsers) && params.activeBotUsers.length > 0;
  const prevMax = useMemo(() => previousActivityMaxDate(), []);

  const [draftStart, setDraftStart] = useState(() => params.startDate || todayIST());
  const [draftEnd, setDraftEnd] = useState(() => params.endDate || todayIST());
  const [startDate, setStartDate] = useState(() => params.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => params.endDate || todayIST());
  const [rows, setRows] = useState<ActiveBotUserRow[]>(() => params.activeBotUsers || []);
  const [total, setTotal] = useState(() =>
    Number(params.activeBotUsersCount ?? params.activeBotUsers?.length ?? 0),
  );
  const [botSummary, setBotSummary] = useState<ActiveBotSummaryItem[]>(
    () => params.botSummary || [],
  );
  const [botFilter, setBotFilter] = useState('');
  const [previousActivityDate, setPreviousActivityDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ row: ActiveBotUserRow; index: number } | null>(null);
  const loadGenRef = useRef(0);
  const skipInitial = useRef(hadNavUsers);

  const fetchBots = useCallback(async (from: string, to: string) => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const res = await secureApi('caller.activeUsersFromCallsByAutomationBot', {
        startDate: from,
        endDate: to,
      });
      if (gen !== loadGenRef.current) return;
      if (!res.ok || res.success === false) {
        setRows([]);
        setTotal(0);
        setBotSummary([]);
        return;
      }
      const flat = flattenActiveBotUsersPayload(res.data);
      setRows(flat.users);
      setTotal(flat.total);
      setBotSummary(flat.summary);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipInitial.current) return;
    void fetchBots(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    void fetchBots(draftStart, draftEnd);
  }, [draftStart, draftEnd, fetchBots]);

  const onPreviousActivityChange = useCallback(
    (value: string) => {
      if (value && value > prevMax) return;
      setPreviousActivityDate(value);
    },
    [prevMax],
  );

  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      if (botFilter && String(r.botType || '') !== botFilter) return false;
      if (previousActivityDate) {
        const key = toDateKey(r.lastSecondActivity ?? r.previousActivity ?? r.prevActivity);
        if (key !== previousActivityDate) return false;
      }
      return true;
    });
  }, [rows, botFilter, previousActivityDate]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    const r = selected.row;
    const dpId = String(r._id || r.userId || '');
    return [
      { label: 'SR.No', value: String(selected.index + 1) },
      { label: 'Name', value: String(r.name || r.userName || '-') },
      { label: 'Emp Code', value: String(r.empCode || r.emp_code || '-') },
      {
        label: 'DP ID',
        value: dpId || '-',
        copyable: Boolean(dpId),
        copyValue: dpId,
      },
      { label: 'Bot', value: formatAutomationBotLabel(String(r.botType || '')) },
      { label: 'Bot ID', value: firstBotId(r) },
      { label: 'App Name', value: String(r.clientName || r.appName || '-') },
      { label: 'Mobile No', value: maskMobile(r.mobile || r.userMobile, canShowMobile) },
      { label: 'Balance', value: formatBalance(r.balance) },
      { label: 'Played', value: playedLabel(r) },
      { label: 'Last Activity', value: lastActivity(r) },
      { label: 'Previous Activity', value: previousActivity(r) },
      { label: 'City', value: String(r.city || '-') },
      { label: 'State', value: String(r.state || '-') },
    ];
  }, [selected, canShowMobile]);

  const listHeader = useMemo(
    () => (
      <View>
        <Text style={styles.title}>
          Active Bot Users ({filteredRows.length}
          {filteredRows.length !== total ? ` / ${total}` : ''})
        </Text>
        <DetailFilterBar
          startDate={draftStart}
          endDate={draftEnd}
          loading={loading}
          onStartDateChange={setDraftStart}
          onEndDateChange={setDraftEnd}
          onApply={applyDates}
        />
        <View style={styles.prevFilterRow}>
          <Text style={styles.prevFilterLabel}>Prev Activity</Text>
          <View style={styles.prevFilterField}>
            <DateField
              value={previousActivityDate}
              onChange={onPreviousActivityChange}
              placeholder="Filter date"
            />
          </View>
          {previousActivityDate ? (
            <TouchableOpacity style={styles.clearPrevBtn} onPress={() => setPreviousActivityDate('')}>
              <Text style={styles.clearPrevBtnText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, !botFilter && styles.filterChipActive]}
            onPress={() => setBotFilter('')}
          >
            <Text style={styles.filterChipText}>All</Text>
          </TouchableOpacity>
          {botSummary.map((b) => {
            const selected = botFilter === b.bot;
            const tone = botTone(b.bot);
            const chipStyle = botFilterChipStyles(tone, selected);
            const idlePill = botPillStyles(tone);
            return (
              <TouchableOpacity
                key={b.bot}
                style={[
                  styles.filterChip,
                  selected ? chipStyle.chip : idlePill.pill,
                ]}
                onPress={() => setBotFilter((prev) => (prev === b.bot ? '' : b.bot))}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected ? chipStyle.text : idlePill.text,
                  ]}
                >
                  {formatAutomationBotLabel(b.bot)}: {b.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {loading && filteredRows.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}
      </View>
    ),
    [
      filteredRows.length,
      total,
      previousActivityDate,
      botFilter,
      draftStart,
      draftEnd,
      loading,
      applyDates,
      onPreviousActivityChange,
      botSummary,
    ],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ActiveBotUserRow>) => (
      <BotUserCard
        row={item}
        index={index}
        canShowMobile={canShowMobile}
        onPress={() => setSelected({ row: item, index })}
      />
    ),
    [canShowMobile],
  );

  return (
    <View style={styles.root}>
      <ScreenFlatList
        data={loading && filteredRows.length === 0 ? [] : filteredRows}
        keyExtractor={(r, i) => String(r._id || r.userId || i)}
        renderItem={renderItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No bot users"
        refreshing={loading}
        onRefresh={() => void fetchBots(startDate, endDate)}
        contentContainerStyle={styles.content}
        style={styles.root}
        extraData={`${botFilter}|${previousActivityDate}|${filteredRows.length}`}
      />

      <RowDetailSheet
        visible={!!selected}
        title={String(selected?.row.name || selected?.row.userName || 'Bot user')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
