/**
 * Casino Top-up Balance — Qtech remaining balance (new API) + Qtech history.
 * Mirrors desktop CasinoTopupBalancePage.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { secureApi } from '../../../api/client';
import { hasPermission, canAccessNavItem } from '../../../auth/permissions';
import { NAV_ITEMS } from '../../../navigation/navItems';
import {
  type RemainingBreakdownRow,
  type QtechRemainingSummary,
  type RemainingFormState,
  type RemainingFormErrors,
  emptyRemainingSummary,
  emptyRemainingForm,
  emptyRemainingFormErrors,
  buildRemainingSubmitPayload,
  formatMoney,
  parseQtechRemaining,
  mergeRemainingAfterSubmit,
  remainingRowLabel,
  remainingRowCode,
  remainingRowGgrUsd,
  remainingRowGgrInr,
  remainingRowConsumed,
} from '@astro/shared/casinoTopup';

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
  if (value == null || value === '') return '—';
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

function MetricChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

export function CasinoTopupBalanceScreen() {
  const canView = (() => {
    const item = NAV_ITEMS.find((n) => n.path === '/casino-topup-balance');
    return item ? canAccessNavItem(item) : hasPermission('view_casino_balance');
  })();
  const [providers, setProviders] = useState<Record<ProviderKey, ProviderState>>(emptyProviders);
  const [remaining, setRemaining] = useState<QtechRemainingSummary>(emptyRemainingSummary);
  const [remainingLoading, setRemainingLoading] = useState(false);
  const [remainingTab, setRemainingTab] = useState<'provider' | 'game'>('provider');
  const [tabLoading, setTabLoading] = useState(false);
  const tabLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [dateTime, setDateTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [remainingForm, setRemainingForm] = useState<RemainingFormState>(emptyRemainingForm);
  const [remainingFormErrors, setRemainingFormErrors] =
    useState<RemainingFormErrors>(emptyRemainingFormErrors);
  const [remainingSubmitting, setRemainingSubmitting] = useState(false);
  const [remainingMsg, setRemainingMsg] = useState('');
  const genRef = useRef(0);

  const loadBalances = useCallback(async () => {
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

  const loadRemaining = useCallback(async () => {
    setRemainingLoading(true);
    try {
      const res = await secureApi<unknown>('casinoTopup.qtechRemaining', {});
      if (!res.ok) {
        setRemaining(emptyRemainingSummary());
        setError((prev) => prev || res.message || 'Failed to load Qtech remaining balance');
        return;
      }
      setRemaining(parseQtechRemaining(res.data));
    } finally {
      setRemainingLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBalances(), loadRemaining()]);
  }, [loadBalances, loadRemaining]);

  useEffect(() => {
    if (canView) void refreshAll();
  }, [canView, refreshAll]);

  const switchRemainingTab = useCallback((tab: 'provider' | 'game') => {
    setRemainingTab((prev) => (prev === tab ? prev : tab));
  }, []);

  const skipTabLoaderRef = useRef(true);
  useEffect(() => {
    if (skipTabLoaderRef.current) {
      skipTabLoaderRef.current = false;
      return;
    }
    setTabLoading(true);
    if (tabLoadTimerRef.current) clearTimeout(tabLoadTimerRef.current);
    tabLoadTimerRef.current = setTimeout(() => {
      setTabLoading(false);
      tabLoadTimerRef.current = null;
    }, 350);
    return () => {
      if (tabLoadTimerRef.current) clearTimeout(tabLoadTimerRef.current);
    };
  }, [remainingTab]);

  const openAdd = useCallback(() => {
    setAddOpen(true);
    setAmount('');
    setCurrency('USD');
    setDateTime(currentIstDateTime());
    setNote(PROVIDER_CONFIG.qtech.defaultNote);
    setFormMsg('');
  }, []);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setFormMsg('');
  }, []);

  const openRemainingModal = useCallback(() => {
    setRemainingForm(emptyRemainingForm());
    setRemainingFormErrors(emptyRemainingFormErrors());
    setRemainingMsg('');
    setRemainingOpen(true);
  }, []);

  const closeRemainingModal = useCallback(() => {
    setRemainingOpen(false);
    setRemainingMsg('');
  }, []);

  const submitRemaining = useCallback(async () => {
    const built = buildRemainingSubmitPayload(remainingForm);
    if (!built.ok) {
      setRemainingFormErrors(built.errors);
      setRemainingMsg('Please fill required fields');
      return;
    }
    setRemainingSubmitting(true);
    setRemainingMsg('');
    try {
      const res = await secureApi<unknown>('casinoTopup.qtechRemaining', {
        amount: built.payload.amount,
        date: built.payload.date,
        time: built.payload.time,
      });
      if (!res.ok) {
        setRemainingMsg(res.message || 'Failed to submit remaining balance');
        return;
      }
      setRemaining(mergeRemainingAfterSubmit(res.data, built.payload));
      setRemainingOpen(false);
      void loadRemaining();
    } finally {
      setRemainingSubmitting(false);
    }
  }, [remainingForm, loadRemaining]);

  const submitAdd = useCallback(async () => {
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
      const config = PROVIDER_CONFIG.qtech;
      const res = await secureApi<unknown>('casinoTopup.addQtech', {
        amount: amountNum,
        currency,
        toppedUpAtIst: toApiDateTime(dateTime),
        note: note.trim() || config.defaultNote,
      });
      if (!res.ok) {
        setFormMsg(res.message || `Failed to add ${config.title} top-up`);
        return;
      }
      setAddOpen(false);
      void loadBalances();
      void loadRemaining();
    } finally {
      setSubmitting(false);
    }
  }, [amount, currency, dateTime, note, loadBalances, loadRemaining]);

  const remainingRows = remainingTab === 'provider' ? remaining.byProvider : remaining.byGame;

  if (!canView) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{toDisplayText('Casino Top-up Balance')}</Text>
        <View style={styles.mutedBox}>
          <Text style={styles.mutedText}>You do not have permission to view this page.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading || remainingLoading}
          onRefresh={() => void refreshAll()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Casino Top-up Balance')}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Qtech Remaining Balance</Text>
            <Text style={styles.sectionSub}>
              {remaining.toppedUpAtIst
                ? `Topped up: ${remaining.toppedUpAtIst}`
                : 'From /Qtech/topup-balance-remaining'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => void loadRemaining()}
            disabled={remainingLoading}
          >
            <Text style={styles.actionBtnText}>{remainingLoading ? '…' : 'Refresh'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setHistoryOpen(true);
              void loadBalances();
            }}
          >
            <Text style={styles.actionBtnText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={openRemainingModal}
            disabled={remainingSubmitting || remainingLoading}
          >
            <Text style={styles.actionBtnText}>Remaining Balance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openAdd()}>
            <Text style={styles.actionBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {remainingLoading && remaining.remainingUsd == null ? (
          <Text style={styles.mutedText}>Loading remaining balance…</Text>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricChip label="Remaining (USD)" value={formatMoney(remaining.remainingUsd)} accent="#2dd4bf" />
              <MetricChip label="Topped Up (USD)" value={formatMoney(remaining.toppedUpUsd)} accent="#60a5fa" />
              <MetricChip label="Consumed (USD)" value={formatMoney(remaining.consumedUsd)} accent="#fbbf24" />
              <MetricChip label="Currency" value={remaining.currency || 'USD'} />
              <MetricChip label="USD → INR" value={formatMoney(remaining.usdToInr)} />
              <MetricChip label="Fee (INR)" value={formatMoney(remaining.feeInr)} />
              <MetricChip label="GGR (USD)" value={formatMoney(remaining.ggrUsd)} />
              <MetricChip label="GGR (INR)" value={formatMoney(remaining.ggrInr)} />
              <MetricChip
                label="Unmatched Games"
                value={
                  remaining.unmatchedGamesCount != null
                    ? String(remaining.unmatchedGamesCount)
                    : '—'
                }
              />
            </View>

            {(remaining.rangeStart || remaining.rangeEnd) && (
              <Text style={styles.rangeText}>
                Range:{' '}
                {remaining.rangeStart ? new Date(remaining.rangeStart).toLocaleString() : '—'} →{' '}
                {remaining.rangeEnd ? new Date(remaining.rangeEnd).toLocaleString() : '—'}
              </Text>
            )}

            <View style={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.chip, remainingTab === 'provider' && styles.chipActive]}
                onPress={() => switchRemainingTab('provider')}
                disabled={tabLoading}
              >
                <Text
                  style={[styles.chipText, remainingTab === 'provider' && styles.chipTextActive]}
                >
                  By Provider ({remaining.byProvider.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, remainingTab === 'game' && styles.chipActive]}
                onPress={() => switchRemainingTab('game')}
                disabled={tabLoading}
              >
                <Text style={[styles.chipText, remainingTab === 'game' && styles.chipTextActive]}>
                  By Game ({remaining.byGame.length})
                </Text>
              </TouchableOpacity>
            </View>

            {tabLoading || (remainingLoading && remainingRows.length === 0) ? (
              <View style={styles.tabLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.listHint}>Loading…</Text>
              </View>
            ) : remainingRows.length === 0 ? (
              <Text style={styles.listHint}>No data found</Text>
            ) : (
              <View style={styles.list}>
                {remainingRows.map((row, index) => (
                  <View
                    key={`row-${index}-${String(row._id || row.id || row.gameId || row.provider || '')}`}
                    style={styles.card}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardIndex}>#{index + 1}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {remainingRowLabel(row, remainingTab)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        ID: {remainingRowCode(row)}
                      </Text>
                      <Text style={styles.cardSplitRight} numberOfLines={1}>
                        Consumed: {remainingRowConsumed(row)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        GGR USD: {remainingRowGgrUsd(row)}
                      </Text>
                      <Text style={styles.cardSplitRight} numberOfLines={1}>
                        GGR INR: {remainingRowGgrInr(row)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <Modal visible={historyOpen} transparent animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => setHistoryOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Qtech Top-up History</Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}>
              {providers.qtech.loading && providers.qtech.records.length === 0 ? (
                <Text style={styles.listHint}>Loading…</Text>
              ) : null}
              {!providers.qtech.loading && providers.qtech.records.length === 0 ? (
                <Text style={styles.listHint}>No top-up records found</Text>
              ) : null}
              <View style={styles.list}>
                {providers.qtech.records.map((row, index) => (
                  <View key={`row-${index}-${String(row._id ?? '')}`} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardIndex}>#{index + 1}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {row.amount != null ? Number(row.amount).toLocaleString('en-IN') : '—'}{' '}
                        {display(row.currency)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        {display(row.toppedUpAtIst || row.createdAt || row.toppedUpAt)}
                      </Text>
                    </View>
                    {row.note ? (
                      <Text style={styles.cardNote} numberOfLines={2}>
                        {display(row.note)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={closeAdd}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={closeAdd}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {PROVIDER_CONFIG.qtech.title} Top-up</Text>
              <TouchableOpacity onPress={closeAdd}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.chipsRow}>
                {CURRENCY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, currency === c && styles.chipActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Top-up date/time (IST) *</Text>
              <TextInput
                style={styles.input}
                value={dateTime}
                onChangeText={setDateTime}
                placeholder="YYYY-MM-DD HH:mm:ss"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={note}
                onChangeText={setNote}
                multiline
                placeholderTextColor={colors.muted}
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

      <Modal
        visible={remainingOpen}
        transparent
        animationType="slide"
        onRequestClose={closeRemainingModal}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={closeRemainingModal}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Remaining Balance</Text>
              <TouchableOpacity onPress={closeRemainingModal}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Amount *</Text>
              <TextInput
                style={[styles.input, remainingFormErrors.amount && styles.inputError]}
                value={remainingForm.amount}
                onChangeText={(v) => {
                  setRemainingForm((prev) => ({ ...prev, amount: v }));
                  setRemainingFormErrors((prev) => ({ ...prev, amount: false }));
                }}
                keyboardType="decimal-pad"
                placeholder="e.g. 850.25"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput
                style={[styles.input, remainingFormErrors.date && styles.inputError]}
                value={remainingForm.date}
                onChangeText={(v) => {
                  setRemainingForm((prev) => ({ ...prev, date: v }));
                  setRemainingFormErrors((prev) => ({ ...prev, date: false }));
                }}
                placeholder="e.g. 24-08-2026"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Time *</Text>
              <TextInput
                style={[styles.input, remainingFormErrors.time && styles.inputError]}
                value={remainingForm.time}
                onChangeText={(v) => {
                  setRemainingForm((prev) => ({ ...prev, time: v }));
                  setRemainingFormErrors((prev) => ({ ...prev, time: false }));
                }}
                placeholder="e.g. 05:44 p.m."
                placeholderTextColor={colors.muted}
              />
              {remainingMsg ? <Text style={styles.modalMsg}>{remainingMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, remainingSubmitting && styles.btnDisabled]}
                disabled={remainingSubmitting}
                onPress={() => void submitRemaining()}
              >
                <Text style={styles.submitBtnText}>
                  {remainingSubmitting ? 'Submitting…' : 'Submit'}
                </Text>
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
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(2) },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  actionBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 12 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing(1.5),
  },
  metricChip: {
    width: '32%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(1.5),
  },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  metricValue: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing(0.5),
  },
  list: { gap: spacing(2), marginTop: spacing(2) },
  listHint: { color: colors.muted, marginTop: spacing(2), marginBottom: spacing(1), fontSize: 13 },
  tabLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(8),
    gap: spacing(2),
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  cardNote: { color: colors.muted, fontSize: 11, marginTop: spacing(0.5) },
  rangeText: { color: colors.muted, fontSize: 12, marginTop: spacing(2), marginBottom: spacing(1) },
  balanceBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(2),
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
  inputError: {
    borderColor: colors.destructive,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2), marginBottom: spacing(1) },
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
