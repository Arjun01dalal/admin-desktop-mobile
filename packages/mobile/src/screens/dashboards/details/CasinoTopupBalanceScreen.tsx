/**
 * Casino Top-up Balance — port of desktop CasinoTopupBalancePage + casinoTopup/helpers.
 * casinoTopup.get {} → parses qtech + betconstruct sections. Each section shows the
 * current balance and a history table; an "Add top-up" modal posts a new record.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission, canAccessNavItem } from '../../../auth/permissions';
import { NAV_ITEMS } from '../../../navigation/navItems';

type ProviderKey = 'qtech' | 'betconstruct';

type TopupRecord = {
  _id?: string;
  amount?: number;
  currency?: string;
  toppedUpAtIst?: string;
  toppedUpAt?: string;
  createdAt?: string;
  note?: string;
  [key: string]: unknown;
};

type ProviderState = {
  records: TopupRecord[];
  balance: number | null;
  currency: string;
  loading: boolean;
};

const PROVIDER_CONFIG: Record<ProviderKey, { title: string; defaultNote: string }> = {
  qtech: { title: 'Qtech', defaultNote: 'Qtech wallet top-up' },
  betconstruct: { title: 'Betconstruct', defaultNote: 'Betconstruct wallet top-up' },
};

const CURRENCY_OPTIONS = ['USD', 'INR', 'EUR'] as const;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Current IST as "YYYY-MM-DD HH:mm:ss". */
function currentIstDateTime(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(Date.now()));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Normalise a datetime input into "YYYY-MM-DD HH:mm:ss". */
function toApiDateTime(value: string): string {
  if (!value) return '';
  const normalized = value.trim().replace('T', ' ').replace('Z', '');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return normalized;
  const [, date, hours, minutes, seconds = '00'] = match;
  return `${date} ${hours}:${minutes}:${seconds}`;
}

function recordTimestamp(item: TopupRecord): number {
  const raw = item.toppedUpAt || item.createdAt || item.toppedUpAtIst || '';
  const normalized = String(raw).replace(' IST', '').replace(' ', 'T');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

function emptyProvider(): Omit<ProviderState, 'loading'> {
  return { records: [], balance: null, currency: 'USD' };
}

/** Parse a single provider document tolerantly. */
function parseTopupDocument(doc: unknown): Omit<ProviderState, 'loading'> {
  if (!doc || typeof doc !== 'object') return emptyProvider();
  const root = doc as Record<string, unknown>;
  const wallet =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const records = Array.isArray(wallet.history)
    ? (wallet.history as TopupRecord[])
    : Array.isArray(wallet.records)
      ? (wallet.records as TopupRecord[])
      : Array.isArray(root.history)
        ? (root.history as TopupRecord[])
        : [];

  const sorted = [...records].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));

  return {
    records: sorted,
    balance:
      toNumber(wallet.amount) ??
      toNumber(wallet.balance) ??
      toNumber(wallet.toppedUpBalance) ??
      null,
    currency: String(wallet.currency || sorted[0]?.currency || 'USD'),
  };
}

function providerFromType(type: unknown): ProviderKey | null {
  const value = String(type || '').toLowerCase();
  if (value.includes('qtech')) return 'qtech';
  if (value.includes('betconstruct') || value.includes('bet construct')) return 'betconstruct';
  return null;
}

function resolveRootPayload(decrypted: unknown): unknown {
  if (decrypted == null) return null;
  if (Array.isArray(decrypted)) return decrypted;
  if (typeof decrypted !== 'object') return decrypted;
  const obj = decrypted as Record<string, unknown>;
  const nestedData =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null;
  return obj.payload ?? nestedData?.payload ?? obj.data ?? obj.result ?? decrypted;
}

function parseBothProviders(
  decrypted: unknown,
): Record<ProviderKey, Omit<ProviderState, 'loading'>> {
  const payload = resolveRootPayload(decrypted);
  const result: Record<ProviderKey, Omit<ProviderState, 'loading'>> = {
    qtech: emptyProvider(),
    betconstruct: emptyProvider(),
  };

  const applyDoc = (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return false;
    const obj = doc as Record<string, unknown>;
    const key =
      providerFromType(obj.type) ||
      providerFromType(obj.provider) ||
      providerFromType(obj.providerName);
    if (!key) return false;
    result[key] = parseTopupDocument(doc);
    return true;
  };

  if (Array.isArray(payload)) {
    payload.forEach(applyDoc);
    return result;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (obj.data && (obj.type || (obj.data as Record<string, unknown>)?.amount != null)) {
      const matched = applyDoc(payload);
      if (matched) return result;
      result.qtech = parseTopupDocument(payload);
      return result;
    }

    if (obj.qtech != null) result.qtech = parseTopupDocument(obj.qtech);
    if (obj.Qtech != null) result.qtech = parseTopupDocument(obj.Qtech);
    if (obj.betconstruct != null) result.betconstruct = parseTopupDocument(obj.betconstruct);
    if (obj.betConstruct != null) result.betconstruct = parseTopupDocument(obj.betConstruct);
    if (obj.Betconstruct != null) result.betconstruct = parseTopupDocument(obj.Betconstruct);

    if (
      result.qtech.balance != null ||
      result.qtech.records.length ||
      result.betconstruct.balance != null ||
      result.betconstruct.records.length
    ) {
      return result;
    }

    if (obj.amount != null || Array.isArray(obj.history)) {
      result.qtech = parseTopupDocument(payload);
      return result;
    }
  }

  return result;
}

const emptyProviders = (): Record<ProviderKey, ProviderState> => ({
  qtech: { records: [], balance: null, currency: 'USD', loading: false },
  betconstruct: { records: [], balance: null, currency: 'USD', loading: false },
});

export function CasinoTopupBalanceScreen() {
  const canView = (() => {
    const item = NAV_ITEMS.find((n) => n.path === '/casino-topup-balance');
    return item ? canAccessNavItem(item) : hasPermission('view_casino_balance');
  })();
  const [providers, setProviders] = useState<Record<ProviderKey, ProviderState>>(emptyProviders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add top-up modal.
  const [addProvider, setAddProvider] = useState<ProviderKey | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [dateTime, setDateTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    setProviders((prev) => ({
      qtech: { ...prev.qtech, loading: true },
      betconstruct: { ...prev.betconstruct, loading: true },
    }));
    try {
      const res = await secureApi<unknown>('casinoTopup.get', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load casino top-up balance');
        setProviders(emptyProviders());
        return;
      }
      const parsed = parseBothProviders(res.data);
      setProviders({
        qtech: { ...parsed.qtech, loading: false },
        betconstruct: { ...parsed.betconstruct, loading: false },
      });
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const openAdd = useCallback((key: ProviderKey) => {
    setAddProvider(key);
    setAmount('');
    setCurrency('USD');
    setDateTime(currentIstDateTime());
    setNote(PROVIDER_CONFIG[key].defaultNote);
    setFormMsg('');
  }, []);

  const closeAdd = useCallback(() => {
    setAddProvider(null);
    setFormMsg('');
  }, []);

  const submitAdd = useCallback(async () => {
    if (!addProvider) return;
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setFormMsg('Please enter a valid amount');
      return;
    }
    if (!dateTime.trim()) {
      setFormMsg('Top-up date/time is required');
      return;
    }
    setSubmitting(true);
    setFormMsg('');
    try {
      const config = PROVIDER_CONFIG[addProvider];
      const action =
        addProvider === 'qtech' ? 'casinoTopup.addQtech' : 'casinoTopup.addBetconstruct';
      const res = await secureApi<unknown>(action, {
        amount: amountNum,
        currency,
        toppedUpAtIst: toApiDateTime(dateTime),
        note: note.trim() || config.defaultNote,
      });
      if (!res.ok) {
        setFormMsg(res.message || `Failed to add ${config.title} top-up`);
        return;
      }
      setAddProvider(null);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [addProvider, amount, currency, dateTime, note, load]);

  const columns = useMemo<DataTableColumn<TopupRecord>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      {
        key: 'amount',
        label: 'Amount',
        width: 110,
        align: 'right',
        render: (r) => (r.amount != null ? Number(r.amount).toLocaleString('en-IN') : '—'),
      },
      { key: 'currency', label: 'Currency', width: 90, render: (r) => display(r.currency) },
      {
        key: 'toppedUpAtIst',
        label: 'Topped Up At (IST)',
        width: 170,
        render: (r) => display(r.toppedUpAtIst || r.createdAt || r.toppedUpAt),
      },
      { key: 'note', label: 'Note', width: 180, render: (r) => display(r.note) },
    ],
    [],
  );

  if (!canView) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{toDisplayText('Casino Top-up Balance')}</Text>
        <View style={styles.mutedBox}>
          <Text style={styles.mutedText}>You do not have permission to view this page.</Text>
        </View>
      </ScrollView>
    );
  }

  const renderSection = (key: ProviderKey) => {
    const config = PROVIDER_CONFIG[key];
    const state = providers[key];
    return (
      <View key={key} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{config.title}</Text>
            <Text style={styles.sectionSub}>Topped-up balance</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAdd(key)}>
            <Text style={styles.addBtnText}>+ Add top-up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {state.loading && state.balance == null
              ? '…'
              : state.balance != null
                ? `${Number(state.balance).toLocaleString('en-IN')} `
                : '—'}
            {state.balance != null ? (
              <Text style={styles.balanceCurrency}>{state.currency}</Text>
            ) : null}
          </Text>
        </View>

        <DataTable
          columns={columns}
          rows={state.records}
          keyFor={(r, i) => String(r._id || i)}
          loading={state.loading && state.records.length === 0}
          emptyMessage="No top-up records found"
          hint="Swipe sideways to see all columns →"
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('Casino Top-up Balance')}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {renderSection('qtech')}
      {renderSection('betconstruct')}

      {/* Add top-up modal */}
      <Modal
        visible={addProvider !== null}
        transparent
        animationType="slide"
        onRequestClose={closeAdd}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={closeAdd}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Add {addProvider ? PROVIDER_CONFIG[addProvider].title : ''} Top-up
              </Text>
              <TouchableOpacity
                onPress={closeAdd}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="e.g. 1000"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Currency *</Text>
              <View style={styles.chipsRow}>
                {CURRENCY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, currency === c && styles.chipActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Topped Up At (IST) *</Text>
              <TextInput
                style={styles.input}
                value={dateTime}
                onChangeText={setDateTime}
                placeholder="YYYY-MM-DD HH:mm:ss"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={note}
                onChangeText={setNote}
                placeholder="Optional note"
                placeholderTextColor={colors.muted}
                multiline
              />

              {formMsg ? <Text style={styles.modalMsg}>{formMsg}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                disabled={submitting}
                onPress={() => void submitAdd()}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  mutedBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  mutedText: { color: colors.muted, fontSize: 13 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2) },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  sectionSub: { color: colors.muted, fontSize: 12, marginTop: spacing(0.5) },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  balanceBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  balanceLabel: { color: colors.muted, fontSize: 12 },
  balanceValue: { color: colors.foreground, fontSize: 24, fontWeight: '700', marginTop: spacing(1) },
  balanceCurrency: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(3), marginBottom: spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  btnDisabled: { opacity: 0.5 },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
