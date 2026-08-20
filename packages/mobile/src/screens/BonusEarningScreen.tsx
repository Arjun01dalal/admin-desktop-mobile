/**
 * Bonus Earning / Referral / Availed Bonus — Laxmi BonusWalletReferralEarning.
 * Opened from User Report summary cards (full page, not a modal).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { type DataTableColumn } from '../dashboards/ui/DataTable';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
import { secureApi } from '../api/client';
import { formatDisplayDate, formatDisplayTime } from '../utils/dates';

type Rec = Record<string, unknown>;
type BonusKind = 'bonus' | 'referral' | 'availedBonus';

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
  return floorNum(Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
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

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    const maskMobile = (v: unknown) => {
      if (v == null || v === '') return '—';
      return canShowMobile ? String(v) : '**********';
    };
    const pct = (v: unknown) => {
      if (v == null || v === '') return '—';
      return `${v}%`;
    };
    return [
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name) },
      { key: 'mobile', label: 'Mobile', width: 110, render: (r) => maskMobile(r.mobile) },
      { key: 'app', label: 'App Name', width: 110, render: (r) => display(r.clientName ?? r.appName) },
      {
        key: 'open',
        label: 'Opening Balance',
        width: 120,
        render: (r) => money(r.bonusWalletOpenBalance),
      },
      { key: 'amount', label: 'Amount', width: 90, render: (r) => money(r.amount) },
      {
        key: 'close',
        label: 'Closing Balance',
        width: 120,
        render: (r) => money(r.bonusWalletClosingBalance),
      },
      { key: 'refBy', label: 'Referred By Name', width: 130, render: (r) => display(r.referredByName) },
      {
        key: 'refByM',
        label: 'Referred By Mobile',
        width: 130,
        render: (r) => maskMobile(r.referredByMobile),
      },
      { key: 'refTo', label: 'Referred To Name', width: 130, render: (r) => display(r.referredToName) },
      {
        key: 'refToM',
        label: 'Referred To Mobile',
        width: 130,
        render: (r) => maskMobile(r.referredToMobile),
      },
      {
        key: 'fdPct',
        label: 'First Deposit %',
        width: 110,
        render: (r) => pct(r.firstDepositPercentage),
      },
      { key: 'refPct', label: 'Referral %', width: 100, render: (r) => pct(r.referralPercentage) },
      { key: 'bonusBy', label: 'Bonus By', width: 120, render: (r) => display(bonusByField(r, 'name')) },
      {
        key: 'bonusType',
        label: 'Bonus Type',
        width: 120,
        render: (r) => display(bonusByField(r, 'type') ?? r.type),
      },
      { key: 'remark', label: 'Remark', width: 140, render: (r) => display(r.remark) },
      { key: 'createdOn', label: 'Created on', width: 150, render: (r) => stamp(r.createdOn) },
      { key: 'updatedOn', label: 'Updated on', width: 150, render: (r) => stamp(r.updatedOn) },
    ];
  }, [canShowMobile]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.wrap} contentContainerStyle={styles.content}>
      {userName ? <Text style={styles.pageTitle}>{userName}</Text> : null}
      {userId ? <Text style={styles.sub}>ID: {userId}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : msg ? (
        <Text style={styles.muted}>{msg}</Text>
      ) : (
        <>
          <ResponsiveTable
            forceCards
            columns={columns}
            rows={rows}
            keyFor={(r, i) => String(r._id ?? i)}
            emptyMessage="No bonus details"
          />
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
});
