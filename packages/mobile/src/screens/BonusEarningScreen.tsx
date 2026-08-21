/**
 * Bonus Earning / Referral / Availed Bonus — Laxmi BonusWalletReferralEarning.
 * Opened from User Report summary cards (full page, not a modal).
 * Row UI matches Users list cards; tap opens a CompactStat-style detail modal.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { hasPermission } from '../auth/permissions';
import { colors, radius, spacing } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import { secureApi } from '../api/client';
import { formatDisplayDate, formatDisplayTime } from '../utils/dates';

type Rec = Record<string, unknown>;
type BonusKind = 'bonus' | 'referral' | 'availedBonus';
type FieldChip = { label: string; value: string };

const display = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

function unwrap(data: unknown): Rec {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Rec;
  const nested = obj.payload ?? obj.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Rec;
  return obj;
}

function listOf(data: unknown, ...keys: string[]): Rec[] {
  if (Array.isArray(data)) return data as Rec[];
  const obj = unwrap(data);
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return [];
}

function pagesOf(data: unknown): number {
  const obj = unwrap(data);
  const n = Number(obj.totalPages ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function stamp(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const d = formatDisplayDate(raw);
  const t = formatDisplayTime(raw);
  if (!d) return display(raw);
  return t ? `${d} , ${t}` : d;
}

function money(v: unknown): string {
  const n = Number(v ?? 0);
  return `₹${floorNum(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
}

function bonusByField(r: Rec, key: 'name' | 'type'): unknown {
  const b = r.bonusBy;
  if (b && typeof b === 'object' && !Array.isArray(b)) return (b as Rec)[key];
  return undefined;
}

function titleFor(kind: BonusKind): string {
  if (kind === 'bonus') return 'Bonus Earning Data';
  if (kind === 'availedBonus') return 'Availed Bonus Data';
  return 'Bonus Referral Earning Data';
}

function bonusFields(r: Rec, canShowMobile: boolean): FieldChip[] {
  const maskMobile = (v: unknown) => {
    if (v == null || v === '') return '—';
    return canShowMobile ? String(v) : '**********';
  };
  const pct = (v: unknown) => {
    if (v == null || v === '') return '—';
    return `${v}%`;
  };
  return [
    { label: 'Name', value: display(r.name) },
    { label: 'Mobile', value: maskMobile(r.mobile) },
    { label: 'App Name', value: display(r.clientName ?? r.appName) },
    { label: 'Opening Balance', value: money(r.bonusWalletOpenBalance) },
    { label: 'Amount', value: money(r.amount) },
    { label: 'Closing Balance', value: money(r.bonusWalletClosingBalance) },
    { label: 'Referred By Name', value: display(r.referredByName) },
    { label: 'Referred By Mobile', value: maskMobile(r.referredByMobile) },
    { label: 'Referred To Name', value: display(r.referredToName) },
    { label: 'Referred To Mobile', value: maskMobile(r.referredToMobile) },
    { label: 'First Deposit %', value: pct(r.firstDepositPercentage) },
    { label: 'Referral %', value: pct(r.referralPercentage) },
    { label: 'Bonus By', value: display(bonusByField(r, 'name')) },
    { label: 'Bonus Type', value: display(bonusByField(r, 'type') ?? r.type) },
    { label: 'Remark', value: display(r.remark) },
    { label: 'Created on', value: stamp(r.createdOn) },
    { label: 'Updated on', value: stamp(r.updatedOn) },
  ].filter((f) => f.value !== '—');
}

export function BonusEarningScreen() {
  const navigation = useNavigation();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const userId = String(params.userId ?? params.User_ID ?? '');
  const userName = String(params.userName ?? '');
  const kind: BonusKind =
    params.Type === 'availedBonus' || params.Type === 'lapsedBonus'
      ? 'availedBonus'
      : params.Type === 'referral'
        ? 'referral'
        : 'bonus';
  const passedItems = Array.isArray(params.items) ? (params.items as Rec[]) : undefined;
  const canShowMobile = hasPermission('show_mobile');

  const [rows, setRows] = useState<Rec[]>(kind === 'availedBonus' ? passedItems ?? [] : []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(kind !== 'availedBonus');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<{
    title: string;
    fields: FieldChip[];
  } | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: titleFor(kind) });
  }, [kind, navigation]);

  const load = useCallback(
    async (nextPage = 1) => {
      if (!userId || kind === 'availedBonus') return;
      setLoading(true);
      setMsg('');
      setPage(nextPage);
      try {
        const action =
          kind === 'bonus'
            ? 'userReport.bonusWalletHistory'
            : 'userReport.bonusWalletHistoryReferral';
        const res = await secureApi(action, {
          pageNo: nextPage,
          itemsPerPage: 20,
          filter: { userId },
          sort: { createdOn: -1 },
        });
        if (!res.ok) {
          setRows([]);
          setTotalPages(1);
          setMsg(res.message || 'Failed to load bonus history');
          return;
        }
        setRows(listOf(res.data, 'items'));
        setTotalPages(pagesOf(res.data));
      } finally {
        setLoading(false);
      }
    },
    [kind, userId],
  );

  useEffect(() => {
    if (kind === 'availedBonus') {
      setRows(passedItems ?? []);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    void load(1);
  }, [kind, load, passedItems]);

  const openDetail = useCallback(
    (r: Rec, index: number) => {
      const name = display(r.name);
      setDetail({
        title: name !== '—' ? name : `Entry #${index + 1}`,
        fields: bonusFields(r, canShowMobile),
      });
    },
    [canShowMobile],
  );

  const cards = useMemo(
    () =>
      rows.map((r, i) => {
        const name = display(r.name);
        const initial = (name !== '—' ? name : '?').trim().charAt(0).toUpperCase() || '?';
        const mobile =
          r.mobile == null || r.mobile === ''
            ? ''
            : canShowMobile
              ? String(r.mobile)
              : '**********';
        const amount = money(r.amount);
        const bonusType = display(bonusByField(r, 'type') ?? r.type);
        const created = stamp(r.createdOn);
        const sub = [mobile, amount !== '₹0' ? amount : ''].filter(Boolean).join(' · ') || '—';
        return { r, i, name, initial, sub, bonusType, created, amount };
      }),
    [canShowMobile, rows],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.content}
    >
      {userName ? <Text style={styles.pageTitle}>{userName}</Text> : null}
      {userId ? <Text style={styles.sub}>ID: {userId}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : msg ? (
        <Text style={styles.muted}>{msg}</Text>
      ) : cards.length === 0 ? (
        <Text style={styles.muted}>No bonus details</Text>
      ) : (
        <>
          <View style={styles.cardList}>
            {cards.map(({ r, i, name, initial, sub, bonusType, created, amount }) => (
              <TouchableOpacity
                key={String(r._id ?? i)}
                style={styles.userCard}
                onPress={() => openDetail(r, i)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userCardMid}>
                  <Text style={styles.userCardName} numberOfLines={1}>
                    {name !== '—' ? name : `Entry #${i + 1}`}
                  </Text>
                  <Text style={styles.userCardSub} numberOfLines={1}>
                    {sub}
                  </Text>
                  <View style={styles.userCardTags}>
                    <View style={styles.tagApp}>
                      <Text style={styles.tagAppText} numberOfLines={1}>
                        {amount}
                      </Text>
                    </View>
                    {bonusType !== '—' ? (
                      <View style={styles.tagApp}>
                        <Text style={styles.tagAppText} numberOfLines={1}>
                          {bonusType}
                        </Text>
                      </View>
                    ) : null}
                    {created !== '—' ? (
                      <View style={[styles.tagApp, styles.tagState]}>
                        <Text style={styles.tagAppText} numberOfLines={1}>
                          {created}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rows.length ? (
            <Text style={styles.cardHint}>Tap a card to see all details</Text>
          ) : null}
          {kind !== 'availedBonus' && totalPages > 1 ? (
            <View style={styles.pagerRow}>
              <TouchableOpacity
                style={[styles.pagerBtn, page <= 1 && styles.disabled]}
                disabled={page <= 1}
                onPress={() => void load(page - 1)}
              >
                <Text style={styles.pagerBtnText}>‹ Prev</Text>
              </TouchableOpacity>
              <Text style={styles.muted}>
                Page {page} / {totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.pagerBtn, page >= totalPages && styles.disabled]}
                disabled={page >= totalPages}
                onPress={() => void load(page + 1)}
              >
                <Text style={styles.pagerBtnText}>Next ›</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}

      <Modal
        visible={detail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={2}>
              {detail?.title ?? ''}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.fieldGrid}
              showsVerticalScrollIndicator={false}
            >
              {(detail?.fields ?? []).map((f) => (
                <View key={f.label} style={styles.fieldChip}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>
                    {f.label}
                  </Text>
                  <Text style={styles.fieldValue} numberOfLines={3}>
                    {f.value}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDetail(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: spacing(3), paddingBottom: spacing(8) },
  pageTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sub: { color: colors.muted, fontSize: 12, marginBottom: spacing(2) },
  muted: { color: colors.muted, fontSize: 12 },
  loader: { marginVertical: spacing(8) },
  cardList: { gap: spacing(2) },
  cardHint: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing(1.5),
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
  userCardMid: { flex: 1, minWidth: 0, gap: 2 },
  userCardName: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 14,
  },
  userCardSub: { color: colors.muted, fontSize: 12 },
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
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    maxWidth: '100%',
  },
  tagState: { backgroundColor: 'rgba(59, 130, 246, 0.08)' },
  tagAppText: { color: colors.foreground, fontSize: 10, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 22, fontWeight: '300' },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(2),
  },
  pagerBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  pagerBtnText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    maxHeight: '80%',
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing(2),
  },
  modalScroll: { maxHeight: 420 },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  fieldChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2),
    minWidth: '46%',
    flexGrow: 1,
  },
  fieldLabel: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  fieldValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  modalClose: {
    marginTop: spacing(3),
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  modalCloseText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
  },
});
