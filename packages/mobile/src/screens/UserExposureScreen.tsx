/**
 * User Exposure — Laxmi UserExposure page.
 * Opened from User Report summary (full page, not a modal).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getSessionUser } from '../auth/permissions';
import { colors, radius, spacing } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import { type DataTableColumn } from '../dashboards/ui/DataTable';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
import { secureApi } from '../api/client';
import { formatDisplayDate, formatDisplayTime } from '../utils/dates';

type Rec = Record<string, unknown>;
type ExposureProvider =
  | 'SattaMatka'
  | 'Falcon'
  | 'Jetfair'
  | 'WCO'
  | 'AAA Exchange'
  | 'Plutus Gaming';

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
  let cur: unknown = data;
  for (let i = 0; i < 6; i += 1) {
    if (Array.isArray(cur)) return cur as Rec[];
    if (!cur || typeof cur !== 'object') break;
    const obj = cur as Rec;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as Rec[];
    }
    if (Array.isArray(obj.items)) return obj.items as Rec[];
    if (Array.isArray(obj.payload)) return obj.payload as Rec[];
    if (obj.payload != null && typeof obj.payload === 'object') {
      cur = obj.payload;
      continue;
    }
    if (obj.data != null) {
      cur = obj.data;
      continue;
    }
    break;
  }
  const obj = unwrap(data);
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return [];
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

const EXPOSURE_STATUS: Record<ExposureProvider, { value: string; label: string }[]> = {
  SattaMatka: [
    { value: 'w', label: 'Win' },
    { value: 'l', label: 'Loss' },
  ],
  Falcon: [
    { value: 'C', label: 'Cancel' },
    { value: 'W', label: 'Win' },
    { value: 'L', label: 'Loss' },
  ],
  Jetfair: [
    { value: 'settle', label: 'Settle' },
    { value: 'Cancel', label: 'Cancel' },
  ],
  WCO: [
    { value: 'L', label: 'Loss' },
    { value: 'W', label: 'Win' },
    { value: 'R', label: 'Rollback' },
    { value: 'C', label: 'Completed' },
  ],
  'AAA Exchange': [
    { value: 'Cancel', label: 'Cancel' },
    { value: 'Resettle Market', label: 'Resettle Market' },
    { value: 'C', label: 'Completed' },
  ],
  'Plutus Gaming': [],
};

type ExposureColDef = {
  label: string;
  key: string;
  kind?: 'date' | 'layBack' | 'amount';
  width?: number;
};

const EXPOSURE_TABLE_COLS: Record<ExposureProvider, ExposureColDef[]> = {
  SattaMatka: [
    { label: 'Bazar Name', key: 'bazar_name', width: 130 },
    { label: 'Bazar ID', key: 'bazar_id', width: 110 },
    { label: 'Game Name', key: 'gameName', width: 120 },
    { label: 'Game ID', key: 'game_id', width: 100 },
    { label: 'Game', key: 'game', width: 80 },
    { label: 'Game Type', key: 'game_type', width: 110 },
    { label: 'Result Date', key: 'result_date', width: 110 },
    { label: 'Transaction ID', key: 'transaction_id', width: 140 },
    { label: 'Customer ID', key: 'customer_id', width: 120 },
    { label: 'Point', key: 'point', width: 80 },
    { label: 'Status', key: 'status', width: 80 },
    { label: 'Created On', key: 'createdOn', kind: 'date', width: 150 },
    { label: 'Updated On', key: 'updatedOn', kind: 'date', width: 150 },
  ],
  Falcon: [
    { label: 'Event Name', key: 'Eventname', width: 140 },
    { label: 'Event Type Name', key: 'Eventtypename', width: 130 },
    { label: 'Market ID', key: 'MarketID', width: 120 },
    { label: 'Market Name', key: 'Marketname', width: 140 },
    { label: 'Market Type', key: 'Markettype', width: 110 },
    { label: 'Runner ID', key: 'RunnerID', width: 110 },
    { label: 'Runner Name', key: 'Runnername', width: 130 },
    { label: 'TransactionID', key: 'TransactionID', width: 140 },
    { label: 'Amount', key: 'Amount', kind: 'amount', width: 90 },
    { label: 'Commission Amount', key: 'CommissionAmount', kind: 'amount', width: 130 },
    { label: 'Cashout Amount', key: 'cashoutAmount', kind: 'amount', width: 120 },
    { label: 'Payable Amount', key: 'PayableAmount', kind: 'amount', width: 90 },
    { label: 'Session Point', key: 'SessionPoint', width: 110 },
    { label: 'Point', key: 'Point', width: 80 },
    { label: 'NetPL', key: 'NetPL', width: 90 },
    { label: 'Rate', key: 'Rate', width: 70 },
    { label: 'Stake', key: 'Stake', width: 80 },
    { label: 'betStatus', key: 'betStatus', width: 90 },
    { label: 'Bet Type', key: 'BetType', width: 90 },
    { label: 'Updated On', key: 'updatedOn', kind: 'date', width: 150 },
  ],
  Jetfair: [
    { label: 'Game Name', key: 'gameName', width: 120 },
    { label: 'Runner Name', key: 'runnerName', width: 120 },
    { label: 'Market Name', key: 'marketName', width: 130 },
    { label: 'Market ID', key: 'marketId', width: 120 },
    { label: 'Transaction ID', key: 'transactionId', width: 140 },
    { label: 'Transaction Code', key: 'transactionCode', width: 130 },
    { label: 'Transaction Type', key: 'transactionType', width: 120 },
    { label: 'Amount', key: 'amount', kind: 'amount', width: 90 },
    { label: 'Commission', key: 'commissionAmount', kind: 'amount', width: 110 },
    { label: 'Rate', key: 'rate', width: 70 },
    { label: 'Stake', key: 'stake', width: 80 },
    { label: 'Net P/L', key: 'netPL', width: 90 },
    { label: 'Status', key: 'betStatus', width: 90 },
    { label: 'Bet Type', key: 'betType', width: 90 },
    { label: 'Updated On', key: 'updatedOn', kind: 'date', width: 150 },
  ],
  WCO: [
    { label: 'Provider Name', key: 'providerName', width: 130 },
    { label: 'Game Name', key: 'gameName', width: 120 },
    { label: 'Name', key: 'Name', width: 110 },
    { label: 'Transaction ID', key: 'transactionId', width: 140 },
    { label: 'Provider Transaction ID', key: 'providerTransactionId', width: 160 },
    { label: 'Round ID', key: 'roundId', width: 120 },
    { label: 'Action', key: 'action', width: 90 },
    { label: 'Amount', key: 'amount', kind: 'amount', width: 90 },
    { label: 'Winning', key: 'wining', kind: 'amount', width: 90 },
    { label: 'Status', key: 'status', width: 90 },
    { label: 'Created On', key: 'createdOn', kind: 'date', width: 150 },
    { label: 'Updated On', key: 'updatedOn', kind: 'date', width: 150 },
  ],
  'AAA Exchange': [
    { label: 'User ID', key: 'userId', width: 120 },
    { label: 'Transaction ID', key: 'transactionId', width: 140 },
    { label: 'Transaction Type', key: 'transactionType', width: 120 },
    { label: 'Sport Name', key: 'sportName', width: 110 },
    { label: 'Tournament Name', key: 'tournamentName', width: 140 },
    { label: 'Game ID', key: 'gameId', width: 110 },
    { label: 'Game Name', key: 'gameName', width: 120 },
    { label: 'Game Name Exch', key: 'gameNameExchange', width: 130 },
    { label: 'Market ID', key: 'marketId', width: 120 },
    { label: 'Market Name', key: 'marketName', width: 130 },
    { label: 'Market Type', key: 'marketType', width: 110 },
    { label: 'Runner', key: 'runner', width: 110 },
    { label: 'Bet Type', key: 'isBack', kind: 'layBack', width: 90 },
    { label: 'Rate', key: 'rate', width: 70 },
    { label: 'Run', key: 'run', width: 70 },
    { label: 'Amount', key: 'amount', kind: 'amount', width: 90 },
    { label: 'Balance', key: 'balance', kind: 'amount', width: 90 },
    { label: 'Update On', key: 'updatedOn', kind: 'date', width: 150 },
    { label: 'Status', key: 'status', width: 90 },
    { label: 'Action', key: 'action', width: 90 },
  ],
  'Plutus Gaming': [
    { label: 'Created On', key: 'createdOn', kind: 'date', width: 150 },
    { label: 'Updated On', key: 'updatedOn', kind: 'date', width: 150 },
  ],
};

function exposureCell(row: Rec, col: ExposureColDef): string {
  const raw = row[col.key];
  if (col.kind === 'date') return stamp(raw);
  if (col.kind === 'layBack') {
    if (raw === undefined || raw === null || raw === '') return '—';
    return raw ? 'Back' : 'Lay';
  }
  if (col.kind === 'amount') return money(raw);
  if (typeof raw === 'boolean') return String(raw);
  if (
    raw !== null &&
    raw !== undefined &&
    raw !== '' &&
    typeof raw !== 'object' &&
    !Number.isNaN(Number(raw)) &&
    (typeof raw === 'number' ||
      (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw.trim())))
  ) {
    return String(Math.round(Number(raw)));
  }
  if (raw != null && typeof raw === 'object') {
    const serialized = JSON.stringify(raw);
    return serialized.length > 220 ? `${serialized.slice(0, 220)}…` : serialized;
  }
  return display(raw);
}

function buildPlutusCols(rows: Rec[]): ExposureColDef[] {
  if (!rows.length) return EXPOSURE_TABLE_COLS['Plutus Gaming'];
  const keys = Object.keys(rows[0]).filter(
    (k) => k !== 'txnState' && k !== 'age' && k !== 'rawPayload',
  );
  return [
    { label: 'Sr. No', key: '__srNo', width: 70 },
    ...keys.map((k) => ({
      label: k,
      key: k,
      kind: (['createdOn', 'updatedOn'].includes(k) ? 'date' : undefined) as
        | ExposureColDef['kind']
        | undefined,
      width: 130,
    })),
  ];
}

const PROVIDERS: ExposureProvider[] = [
  'SattaMatka',
  'Falcon',
  'Jetfair',
  'WCO',
  'AAA Exchange',
  'Plutus Gaming',
];

export function UserExposureScreen() {
  const navigation = useNavigation();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const userId = String(params.userId ?? params.User_ID ?? '');
  const userName = String(params.userName ?? '');

  const [provider, setProvider] = useState<ExposureProvider>('SattaMatka');
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [plutusPage, setPlutusPage] = useState(1);
  const [plutusPerPage, setPlutusPerPage] = useState(20);
  const [edit, setEdit] = useState<{
    row: Rec;
    status: string;
    amount: string;
    winning: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'User Exposure' });
  }, [navigation]);

  const load = useCallback(
    async (next: ExposureProvider) => {
      if (!userId) return;
      setProvider(next);
      setEdit(null);
      setPlutusPage(1);
      setLoading(true);
      setMsg('');
      try {
        if (next === 'Plutus Gaming') {
          const res = await secureApi('userReport.plutusPendingBets', {
            userId,
            itemsPerPage: 100,
            pageNo: 1,
          });
          if (!res.ok) {
            setRows([]);
            setMsg(res.message || 'Failed to load Plutus Gaming');
            return;
          }
          setRows(listOf(res.data, 'items', 'payload'));
          return;
        }

        const action =
          next === 'WCO'
            ? 'userReport.wcoPendingBet'
            : next === 'AAA Exchange'
              ? 'userReport.exchangePendingBet'
              : 'userReport.userExposureLists';
        const payload =
          next === 'WCO' || next === 'AAA Exchange' ? { userId } : { _id: userId };
        const res = await secureApi(action, payload);
        if (!res.ok) {
          setRows([]);
          setMsg(res.message || 'Failed to load exposure details');
          return;
        }
        const data = unwrap(res.data);
        if (next === 'SattaMatka') {
          setRows(Array.isArray(data._sattaMatka) ? (data._sattaMatka as Rec[]) : []);
        } else if (next === 'Falcon') {
          setRows(Array.isArray(data._falcon) ? (data._falcon as Rec[]) : []);
        } else if (next === 'Jetfair') {
          setRows(Array.isArray(data._jetfair) ? (data._jetfair as Rec[]) : []);
        } else {
          setRows(listOf(res.data, 'payload', 'items'));
        }
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load('SattaMatka');
  }, [load]);

  const openEdit = useCallback(
    (row: Rec) => {
      if (provider === 'Plutus Gaming') return;
      setEdit({
        row,
        status: provider === 'SattaMatka' ? 'l' : '',
        amount: '',
        winning: '0',
      });
    },
    [provider],
  );

  const submit = useCallback(async () => {
    if (!edit || !userId || provider === 'Plutus Gaming') return;
    const status = edit.status.trim();
    if (!status) {
      Alert.alert('Select status', 'Please select a status before submitting.');
      return;
    }
    const admin = getSessionUser();
    const updatedBy = {
      _id: admin?._id,
      name: admin?.name,
      mobile: admin?.mobile,
    };
    setSaving(true);
    try {
      let action:
        | 'userReport.updateBetsAdmin'
        | 'userReport.updateBetsFalcon'
        | 'userReport.updateBetsJetfair'
        | 'userReport.updateWcoWinning'
        | 'userReport.updateExchangePendingBet';
      let payload: Rec;
      if (provider === 'WCO') {
        action = 'userReport.updateWcoWinning';
        payload = {
          userId,
          transactionId: edit.row.transactionId ?? edit.row.TransactionID,
          wining: Number(edit.winning) || 0,
          status,
          updatedBy,
        };
      } else if (provider === 'AAA Exchange') {
        action = 'userReport.updateExchangePendingBet';
        payload = {
          userId,
          transactionId: edit.row.transactionId ?? edit.row.TransactionID,
          status,
          updatedBy,
        };
      } else if (provider === 'Falcon') {
        action = 'userReport.updateBetsFalcon';
        payload = { status, _id: edit.row._id, updatedBy };
      } else if (provider === 'Jetfair') {
        action = 'userReport.updateBetsJetfair';
        payload = { status, _id: edit.row._id, updatedBy };
      } else {
        action = 'userReport.updateBetsAdmin';
        payload = {
          _id: edit.row._id,
          status,
          amount: edit.amount,
          updatedBy: { _id: admin?._id, name: admin?.name },
        };
      }
      const res = await secureApi(action, payload);
      if (!res.ok) {
        Alert.alert('Update failed', res.message || 'Could not update this bet.');
        return;
      }
      setEdit(null);
      Alert.alert('Updated', `${provider} updated successfully.`);
      await load(provider);
    } finally {
      setSaving(false);
    }
  }, [edit, load, provider, userId]);

  const isPlutus = provider === 'Plutus Gaming';
  const totalPages = isPlutus
    ? Math.max(1, Math.ceil(rows.length / plutusPerPage))
    : 1;
  const pageRows = isPlutus
    ? rows.slice((plutusPage - 1) * plutusPerPage, plutusPage * plutusPerPage)
    : rows;
  const colDefs = isPlutus ? buildPlutusCols(rows) : EXPOSURE_TABLE_COLS[provider];

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    const dataCols: DataTableColumn<Rec>[] = colDefs.map((col) => ({
      key: col.key,
      label: col.label,
      width: col.width ?? 120,
      render: (r: Rec, index?: number) => {
        if (col.key === '__srNo') {
          return String((plutusPage - 1) * plutusPerPage + (index ?? 0) + 1);
        }
        return exposureCell(r, col);
      },
    }));
    if (isPlutus) return dataCols;
    return [
      ...dataCols,
      {
        key: 'edit',
        label: 'Edit',
        width: 72,
        align: 'center' as const,
        render: () => '✎',
        onCellPress: (r: Rec) => openEdit(r),
      },
    ];
  }, [colDefs, isPlutus, openEdit, plutusPage, plutusPerPage]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.wrap} contentContainerStyle={styles.content}>
      {userName ? <Text style={styles.pageTitle}>{userName}</Text> : null}
      {userId ? <Text style={styles.sub}>ID: {userId}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {PROVIDERS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, provider === p && styles.chipActive]}
            onPress={() => void load(p)}
          >
            <Text style={[styles.chipText, provider === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isPlutus ? (
        <View style={styles.pagerRow}>
          <Text style={styles.muted}>Items / page</Text>
          {[10, 20, 50, 100].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, plutusPerPage === n && styles.chipActive]}
              onPress={() => {
                setPlutusPerPage(n);
                setPlutusPage(1);
              }}
            >
              <Text style={[styles.chipText, plutusPerPage === n && styles.chipTextActive]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : msg ? (
        <Text style={styles.muted}>{msg}</Text>
      ) : (
        <ResponsiveTable
          forceCards
          columns={columns}
          rows={pageRows}
          keyFor={(r, i) => String(r._id ?? r.transactionId ?? r.TransactionID ?? i)}
          emptyMessage="No exposure details"
        />
      )}

      {isPlutus && totalPages > 1 ? (
        <View style={styles.pagerRow}>
          <TouchableOpacity
            style={[styles.pagerBtn, plutusPage <= 1 && styles.disabled]}
            disabled={plutusPage <= 1}
            onPress={() => setPlutusPage((p) => Math.max(1, p - 1))}
          >
            <Text style={styles.pagerBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.muted}>
            {plutusPage} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pagerBtn, plutusPage >= totalPages && styles.disabled]}
            disabled={plutusPage >= totalPages}
            onPress={() => setPlutusPage((p) => Math.min(totalPages, p + 1))}
          >
            <Text style={styles.pagerBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={edit != null} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update {provider}</Text>
            <Text style={styles.formLabel}>Select Status</Text>
            <View style={styles.chipRow}>
              {EXPOSURE_STATUS[provider].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, edit?.status === opt.value && styles.chipActive]}
                  onPress={() => setEdit((prev) => (prev ? { ...prev, status: opt.value } : prev))}
                >
                  <Text style={[styles.chipText, edit?.status === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {provider === 'WCO' && (edit?.status === 'W' || edit?.status === 'R') ? (
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Winning Amount"
                placeholderTextColor={colors.muted}
                value={edit?.winning}
                onChangeText={(winning) => setEdit((prev) => (prev ? { ...prev, winning } : prev))}
              />
            ) : null}
            {provider === 'SattaMatka' && edit?.status === 'w' ? (
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Enter Amount"
                placeholderTextColor={colors.muted}
                value={edit?.amount}
                onChangeText={(amount) => setEdit((prev) => (prev ? { ...prev, amount } : prev))}
              />
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setEdit(null)}
                disabled={saving}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.disabled]}
                onPress={() => void submit()}
                disabled={saving}
              >
                <Text style={styles.submitBtnText}>{saving ? 'Updating…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
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
  sub: { color: colors.muted, fontSize: 12, marginBottom: spacing(2.5) },
  muted: { color: colors.muted, fontSize: 12 },
  loader: { marginVertical: spacing(8) },
  chipRow: {
    gap: spacing(1.5),
    paddingBottom: spacing(1),
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.75),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginBottom: spacing(2),
    marginTop: spacing(1),
  },
  formLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing(1.5),
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    marginTop: spacing(2),
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(2), marginTop: spacing(3) },
  pagerBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(5),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: spacing(3) },
});
