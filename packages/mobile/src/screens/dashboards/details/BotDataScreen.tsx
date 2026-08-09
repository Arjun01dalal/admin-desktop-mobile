/**
 * Bot Data — port of desktop BotDataPage.
 * botData.filteredUsersByBots { type, bots, totalRecord, states, startDate?, endDate?,
 * played?, min?, max? } builds per-bot user counts; callLogs.addToBotDialer pushes the
 * matched leads to the dialer. No native file picker is involved (desktop uploads none
 * here — it filters + pushes), so nothing is skipped for that reason.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import { todayIST } from '../../../utils/dates';
import { mapUsersToBotSettings } from '../../../utils/dialerHelpers';
import { DateField } from '../../../components/DateField';

type BotUser = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  state?: string;
  city?: string;
  email?: string;
  activeUser?: string;
};

const USER_TYPES = [
  { value: 'User', label: 'User' },
  { value: 'Todays_Active', label: "Today's Active" },
  { value: 'Active_User', label: 'Active User' },
  { value: 'Non_Performing_User', label: 'Non Performing User' },
  { value: 'In_Active_Deposit', label: 'Inactive Deposit' },
] as const;

const PLAYED_OPTIONS = ['C', 'E', 'S'] as const;

/** Allowed BOT IDs (user-provided allowlist). */
const BOT_ID_OPTIONS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '31', '33', '34', '39', '46', '47',
  '55', '56', '63', '64', '65', '69', '73', '74', '84', '85',
  '86', '92', '97', '104', '105', '106', '114', '126',
];

/** Mirrors desktop INDIA_STATES (users/constants). */
const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
  'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
] as const;

function asBotMap(raw: unknown): Record<string, BotUser[]> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const nested =
    (obj.users_by_bots as Record<string, BotUser[]> | undefined) ||
    (obj.payload && typeof obj.payload === 'object'
      ? ((obj.payload as Record<string, unknown>).users_by_bots as
          | Record<string, BotUser[]>
          | undefined)
      : undefined) ||
    obj;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return {};
  const out: Record<string, BotUser[]> = {};
  for (const [key, value] of Object.entries(nested)) {
    if (Array.isArray(value)) out[key] = value as BotUser[];
  }
  return out;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function BotDataScreen() {
  // Read once — getStoredUser returns a fresh object each call (hook-dep safety).
  const user = useMemo(() => getStoredUser<{ _id?: string; name?: string }>(), []);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [userType, setUserType] = useState('User');
  const [played, setPlayed] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [bots, setBots] = useState<string[]>([]);
  const [totalRecord, setTotalRecord] = useState('10000');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [botMap, setBotMap] = useState<Record<string, BotUser[]>>({});
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which multi-select picker modal is open.
  const [picker, setPicker] = useState<null | 'states' | 'bots'>(null);
  const genRef = useRef(0);

  const cards = useMemo(
    () =>
      Object.entries(botMap)
        .map(([botId, users]) => ({ botId, count: users.length }))
        .sort((a, b) => Number(a.botId) - Number(b.botId)),
    [botMap],
  );

  const totalUsers = useMemo(
    () => cards.reduce((sum, c) => sum + c.count, 0),
    [cards],
  );

  const load = useCallback(async () => {
    if (!userType || !bots.length || !states.length) {
      setError('Select User Type, Bot IDs and States');
      return;
    }
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        type: userType,
        bots,
        totalRecord: Number(totalRecord) || 10000,
        states,
      };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }
      if (played.length) payload.played = played;
      if (minAmt) payload.min = Number(minAmt);
      if (maxAmt) payload.max = Number(maxAmt);

      const res = await secureApi<unknown>('botData.filteredUsersByBots', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load bot data');
        setBotMap({});
        return;
      }
      setBotMap(asBotMap(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [userType, bots, states, totalRecord, startDate, endDate, played, minAmt, maxAmt]);

  const addToDialer = useCallback(() => {
    const entries = Object.entries(botMap);
    if (!entries.length) {
      setError('No data to push. Apply filters first.');
      return;
    }
    Alert.alert(
      'Add Data To Bot',
      `Push ${totalUsers} leads to the dialer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Push',
          onPress: () => {
            void (async () => {
              setPushing(true);
              setError(null);
              try {
                const dialout_settings = entries.flatMap(([botId, users]) =>
                  mapUsersToBotSettings(users, botId, userType),
                );
                const res = await secureApi<unknown>('callLogs.addToBotDialer', {
                  userId: user?._id,
                  created_by: user?.name,
                  dialout_settings,
                });
                if (!res.ok) {
                  setError(res.message || 'Failed to add to dialer');
                  return;
                }
                setBotMap({});
              } finally {
                setPushing(false);
              }
            })();
          },
        },
      ],
    );
  }, [botMap, totalUsers, userType, user]);

  const pickerOptions = picker === 'states' ? INDIA_STATES : BOT_ID_OPTIONS;
  const pickerSelected = picker === 'states' ? states : bots;
  const setPickerSelected = picker === 'states' ? setStates : setBots;

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
      <Text style={styles.title}>Bot Data</Text>

      <View style={styles.panel}>
        {/* Dates */}
        <View style={styles.rowTwo}>
          <View style={styles.field}>
            <Text style={styles.label}>From Date</Text>
            <DateField style={styles.input} value={startDate} onChange={setStartDate} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>To Date</Text>
            <DateField style={styles.input} value={endDate} onChange={setEndDate} />
          </View>
        </View>

        {/* User Type */}
        <Text style={styles.label}>User Type</Text>
        <View style={styles.chipsWrap}>
          {USER_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, userType === t.value && styles.chipActive]}
              onPress={() => setUserType(t.value)}
            >
              <Text style={[styles.chipText, userType === t.value && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Played */}
        <Text style={styles.label}>Played</Text>
        <View style={styles.chipsWrap}>
          {PLAYED_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, played.includes(p) && styles.chipActive]}
              onPress={() => setPlayed((prev) => toggle(prev, p))}
            >
              <Text style={[styles.chipText, played.includes(p) && styles.chipTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* States + Bots pickers */}
        <View style={styles.rowTwo}>
          <View style={styles.field}>
            <Text style={styles.label}>States</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setPicker('states')}>
              <Text style={styles.selectBtnText} numberOfLines={1}>
                {states.length ? `${states.length} selected` : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Bot IDs</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setPicker('bots')}>
              <Text style={styles.selectBtnText} numberOfLines={1}>
                {bots.length ? `${bots.length} selected` : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Records / amounts */}
        <View style={styles.rowTwo}>
          <View style={styles.field}>
            <Text style={styles.label}>Total Records</Text>
            <TextInput
              style={styles.input}
              value={totalRecord}
              onChangeText={setTotalRecord}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Min Amount</Text>
            <TextInput
              style={styles.input}
              value={minAmt}
              onChangeText={setMinAmt}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Max Amount</Text>
          <TextInput
            style={styles.input}
            value={maxAmt}
            onChangeText={setMaxAmt}
            keyboardType="number-pad"
            placeholderTextColor={colors.muted}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={() => void load()}
          >
            <Text style={styles.actionBtnText}>{loading ? 'Loading…' : 'Apply'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={() => void load()}
          >
            <Text style={styles.actionBtnText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, (pushing || !cards.length) && styles.btnDisabled]}
            disabled={pushing || !cards.length}
            onPress={addToDialer}
          >
            <Text style={styles.actionBtnText}>{pushing ? 'Pushing…' : 'Add Data To Bot'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.totalUsers}>
          Total Users: <Text style={styles.bold}>{totalUsers}</Text>
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : !cards.length ? (
        <Text style={styles.muted}>No bot data for selected filters</Text>
      ) : (
        <View style={styles.cardsGrid}>
          {cards.map((card) => (
            <View key={card.botId} style={styles.botCard}>
              <Text style={styles.botCardLabel}>Bot ID</Text>
              <Text style={styles.botCardId}>{card.botId}</Text>
              <Text style={styles.botCardCount}>
                Count: <Text style={styles.bold}>{card.count}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Multi-select picker modal */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {picker === 'states' ? 'Select States' : 'Select Bot IDs'}
              </Text>
              <TouchableOpacity
                onPress={() => setPicker(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.pickerChips}>
              {pickerOptions.map((opt) => {
                const active = pickerSelected.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setPickerSelected((prev) => toggle(prev, opt))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setPicker(null)}>
              <Text style={styles.doneBtnText}>Done ({pickerSelected.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  panel: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(2),
  },
  rowTwo: { flexDirection: 'row', gap: spacing(2) },
  field: { flex: 1, gap: spacing(1) },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  selectBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  selectBtnText: { color: colors.foreground, fontSize: 13 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
  },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  totalUsers: { color: colors.foreground, fontSize: 13, marginTop: spacing(1) },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, marginTop: spacing(3) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(3),
    marginTop: spacing(3),
  },
  botCard: {
    width: '30%',
    minWidth: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.35)',
    borderRadius: radius.md,
    padding: spacing(3),
  },
  botCardLabel: { color: colors.muted, fontSize: 11 },
  botCardId: { color: '#ffd28a', fontSize: 18, fontWeight: '700' },
  botCardCount: { color: colors.foreground, fontSize: 13, marginTop: spacing(1) },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  pickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    paddingVertical: spacing(3),
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(1),
  },
  doneBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
