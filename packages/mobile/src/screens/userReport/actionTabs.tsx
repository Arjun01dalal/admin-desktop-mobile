/** User Report feature module. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getSessionUser } from '../../auth/permissions';
import { colors } from '../../theme';
import { floorNum } from '../../dashboards/mergeMetrics';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { ResponsiveTable } from '../../dashboards/ui/ResponsiveTable';
import { secureApi } from '../../api/client';
import { formatDisplayDate } from '../../utils/dates';
import { DateField } from '../../components/DateField';
import {
  CollapsibleSection,
} from './HistoryFilterBar';
import { styles } from '../UserReportScreen.styles';
import {
  display,
  num,
  providerList,
  unwrap,
  type Rec,
} from './helpers';

/* ---------------------------- remove bonus tab ---------------------------- */

export function RemoveBonusTab({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = useCallback(async () => {
    setMsg('');
    if (!amount.trim() || !remark.trim()) {
      setMsg('Amount and remark are required');
      return;
    }
    setBusy(true);
    try {
      const admin = (getSessionUser() ?? {}) as Rec;
      const res = await secureApi('userReport.removeBonus', {
        bonusBy: {
          name: String(admin.name ?? ''),
          _id: String(admin._id ?? ''),
          type: 'remove bonus',
          transaction: 'credit',
        },
        userId,
        amount: amount.trim(),
        type: 'remove bonus',
        remark: remark.trim(),
      });
      setMsg(res.message || (res.ok ? 'Bonus removed' : 'Failed to remove bonus'));
      if (res.ok) {
        setAmount('');
        setRemark('');
      }
    } finally {
      setBusy(false);
    }
  }, [userId, amount, remark]);

  return (
    <View style={styles.formCard}>
      <Text style={styles.formLabel}>Amount</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="Bonus amount to remove"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.formLabel}>Remark</Text>
      <TextInput
        style={styles.input}
        value={remark}
        onChangeText={setRemark}
        placeholder="Reason / remark"
        placeholderTextColor={colors.muted}
      />
      <TouchableOpacity
        style={[styles.submitBtn, busy && styles.pagerBtnDisabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        <Text style={styles.submitBtnText}>{busy ? 'Removing…' : 'Remove Bonus'}</Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
    </View>
  );
}

/* ----------------------------- provider tabs ------------------------------ */

type ProviderKind = 'qtech' | 'missing' | 'jetfair' | 'sm';

function todayYmdIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

const SM_MARKET_CODES = ['301', '401', '501', '701', '801'] as const;

type ProviderTotals = {
  providerBet: number;
  providerWin: number;
  platformComm: number;
  platformBet: number;
  platformWin: number;
};

export function ProviderTab({ userId, kind }: { userId: string; kind: ProviderKind }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(todayYmdIST());
  const [endDate, setEndDate] = useState(todayYmdIST());
  const [marketId, setMarketId] = useState('');
  const [marketCode, setMarketCode] = useState('301');
  const [msg, setMsg] = useState('');
  const [totals, setTotals] = useState<ProviderTotals | null>(null);
  const [betCount, setBetCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      let res;
      if (kind === 'qtech' || kind === 'missing') {
        res = await secureApi(
          kind === 'qtech' ? 'userReport.qtechStoreBet' : 'userReport.qtechMissingBets',
          {
            userId,
            startDate,
            endDate,
            size: 100,
            itemsPerPage: 100,
            pageNo: 1,
            filter: { userId, providerName: 'Qtech' },
          },
        );
      } else if (kind === 'jetfair') {
        if (!marketId.trim()) {
          setRows([]);
          setMsg('Enter Market ID and tap Load');
          return;
        }
        res = await secureApi('userReport.jetfairMapping', { userId, marketId: marketId.trim() });
      } else {
        res = await secureApi('userReport.smMapping', {
          userId,
          resultDate: startDate,
          marketCode,
        });
      }
      const list = res.ok ? providerList(res.data) : [];
      setRows(list);
      if (!res.ok) setMsg(res.message || 'Failed to load');
      // Desktop parity: summary totals + bet count come alongside the list.
      const nested = unwrap(res.ok ? res.data : {});
      setTotals({
        providerBet: num(nested.totalBetAmountProvider ?? nested.providerBetAmount ?? 0),
        providerWin: num(nested.totalWinAmountProvider ?? nested.providerWinAmount ?? 0),
        platformComm: num(nested.platformCommissionAmount ?? nested.commissionAmount ?? 0),
        platformBet: num(nested.platformBetAmount ?? nested.totalPlatformBet ?? 0),
        platformWin: num(nested.platformWinAmount ?? nested.totalPlatformWin ?? 0),
      });
      setBetCount(num(nested.totalBets ?? nested.totalNumberOfBets ?? list.length) || list.length);
    } finally {
      setLoading(false);
    }
  }, [userId, kind, startDate, endDate, marketId, marketCode]);

  useEffect(() => {
    if (kind !== 'jetfair') void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const pick = (r: Rec, ...keys: string[]): string => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return String(r[k]);
    }
    return '—';
  };

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    if (kind === 'sm') {
      return [
        {
          key: 'gameName',
          label: 'Game',
          width: 110,
          render: (r) => pick(r, 'game_name', 'gameName'),
        },
        { key: 'bazar', label: 'Bazar', width: 110, render: (r) => pick(r, 'game', 'bazar_name') },
        { key: 'status', label: 'Status', width: 80, render: (r) => pick(r, 'status') },
        {
          key: 'win',
          label: 'Winning',
          width: 80,
          render: (r) => pick(r, 'winning_point', 'winningPoint'),
        },
        { key: 'commission', label: 'Commission', width: 90, render: (r) => pick(r, 'commission') },
        {
          key: 'txn',
          label: 'Txn Id',
          width: 140,
          render: (r) => pick(r, 'transaction_id', 'transactionId'),
        },
        {
          key: 'resultDate',
          label: 'Result Date',
          width: 100,
          render: (r) => pick(r, 'result_date', 'resultDate'),
        },
      ];
    }
    if (kind === 'jetfair') {
      return [
        {
          key: 'runner',
          label: 'Runner',
          width: 130,
          render: (r) => pick(r, 'runnerName', 'Runnername'),
        },
        { key: 'hub', label: 'Hub', width: 90, render: (r) => pick(r, 'hub') },
        { key: 'stake', label: 'Stake', width: 80, render: (r) => pick(r, 'stake', 'Stake') },
        { key: 'rate', label: 'Rate', width: 70, render: (r) => pick(r, 'rate', 'Rate') },
        { key: 'won', label: 'Won?', width: 70, render: (r) => pick(r, 'isBetWon', 'IsBetWon') },
        { key: 'back', label: 'Back?', width: 70, render: (r) => pick(r, 'isback', 'Isback') },
        { key: 'netPL', label: 'Net P/L', width: 90, render: (r) => pick(r, 'netPL', 'NetPL') },
        {
          key: 'created',
          label: 'Created On',
          width: 120,
          render: (r) => {
            const raw = (r.createdOn ?? r.CreatedOn) as string | undefined;
            return raw ? formatDisplayDate(raw) : '—';
          },
        },
      ];
    }
    return [
      { key: 'round', label: 'Round', width: 130, render: (r) => pick(r, 'roundId', 'round_id') },
      { key: 'status', label: 'Status', width: 90, render: (r) => pick(r, 'status') },
      {
        key: 'bet',
        label: 'Bet',
        width: 80,
        render: (r) => pick(r, 'totalBet', 'betAmount', 'amount'),
      },
      {
        key: 'payout',
        label: 'Payout',
        width: 80,
        render: (r) => pick(r, 'totalPayout', 'winAmount', 'payout'),
      },
      {
        key: 'bonusBet',
        label: 'Bonus Bet',
        width: 80,
        render: (r) => pick(r, 'totalBonusBet', 'bonusBet'),
      },
      { key: 'game', label: 'Game', width: 100, render: (r) => pick(r, 'gameId') },
      {
        key: 'category',
        label: 'Category',
        width: 100,
        render: (r) => pick(r, 'gameCategory', 'category'),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: 100,
        render: (r) => pick(r, 'gameProvider', 'providerName'),
      },
      { key: 'device', label: 'Device', width: 80, render: (r) => pick(r, 'device') },
      {
        key: 'initiated',
        label: 'Initiated',
        width: 140,
        render: (r) => pick(r, 'initiated', 'initiatedAt'),
      },
      {
        key: 'completed',
        label: 'Completed',
        width: 140,
        render: (r) => pick(r, 'completed', 'completedAt'),
      },
    ];
  }, [kind]);

  return (
    <View>
      <CollapsibleSection title="Search Filters">
        {kind === 'qtech' || kind === 'missing' ? (
          <View style={styles.filterRow}>
            <View style={styles.dateWrap}>
              <DateField value={startDate} onChange={setStartDate} placeholder="From" />
            </View>
            <View style={styles.dateWrap}>
              <DateField value={endDate} onChange={setEndDate} placeholder="To" />
            </View>
          </View>
        ) : null}
        {kind === 'sm' ? (
          <View>
            <View style={styles.filterRow}>
              <View style={styles.dateWrap}>
                <DateField value={startDate} onChange={setStartDate} placeholder="Result date" />
              </View>
            </View>
            <View style={styles.chipRowPlain}>
              {SM_MARKET_CODES.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.chip, marketCode === code && styles.chipActive]}
                  onPress={() => setMarketCode(code)}
                >
                  <Text style={[styles.chipText, marketCode === code && styles.chipTextActive]}>
                    {code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
        {kind === 'jetfair' ? (
          <View style={styles.filterRow}>
            <TextInput
              style={styles.input}
              value={marketId}
              onChangeText={setMarketId}
              placeholder="Market ID"
              placeholderTextColor={colors.muted}
            />
          </View>
        ) : null}
      </CollapsibleSection>
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.pagerBtnDisabled]}
        onPress={() => void load()}
        disabled={loading}
      >
        <Text style={styles.submitBtnText}>{loading ? 'Loading…' : 'Load'}</Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
      {totals && kind !== 'jetfair' ? (
        <View style={styles.summaryGrid}>
          {(
            [
              ['Total Bet Amount Provider', totals.providerBet],
              ['Total Win Amount Provider', totals.providerWin],
              ['Platform Commission Amount', totals.platformComm],
              ['Platform Bet Amount', totals.platformBet],
              ['Platform Win Amount', totals.platformWin],
            ] as [string, number][]
          ).map(([label, value]) => (
            <View key={label} style={[styles.summaryCard, styles.summaryCardCompact]}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>₹{floorNum(value).toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.muted}>
        {kind === 'missing' ? 'Total Missing Bets' : 'Total Number of bets'}: {betCount}
      </Text>
      <ResponsiveTable
        forceCards
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No records"
      />
    </View>
  );
}

/* --------------------------- qtech bet details ---------------------------- */

export function QtechBetDetailsTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(todayYmdIST());
  const [endDate, setEndDate] = useState(todayYmdIST());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('userReport.qtechRtp', {
        userId,
        startDate: startDate || todayYmdIST(),
        endDate: endDate || todayYmdIST(),
      });
      const obj = unwrap(res.ok ? res.data : {});
      setRows(
        Array.isArray(obj)
          ? (obj as Rec[])
          : Array.isArray(obj.games)
            ? (obj.games as Rec[])
            : providerList(res.data),
      );
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'game', label: 'Game', width: 150, render: (r) => display(r.gameName ?? r.gameId) },
      { key: 'bets', label: 'Total Bets', width: 90, render: (r) => display(r.totalBets) },
      { key: 'wins', label: 'Total Wins', width: 90, render: (r) => display(r.totalWins) },
      { key: 'amount', label: 'Bet Amount', width: 100, render: (r) => display(r.totalAmount) },
      { key: 'winAmount', label: 'Win Amount', width: 100, render: (r) => display(r.winAmount) },
    ],
    [],
  );

  return (
    <View>
      <CollapsibleSection title="Search Filters">
        <View style={styles.filterRow}>
          <View style={styles.dateWrap}>
            <DateField value={startDate} onChange={setStartDate} placeholder="From" />
          </View>
          <View style={styles.dateWrap}>
            <DateField value={endDate} onChange={setEndDate} placeholder="To" />
          </View>
        </View>
      </CollapsibleSection>
      <ResponsiveTable
        forceCards
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r.gameId ?? i)}
        loading={loading}
        emptyMessage="No bet details"
      />
    </View>
  );
}

/* ------------------------------- settle tabs ------------------------------ */

export function SettleTab({ userId, kind }: { userId: string; kind: 'sm' | 'jetfair' }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [json, setJson] = useState('');

  const submit = useCallback(async () => {
    setMsg('');
    setBusy(true);
    try {
      if (kind === 'sm') {
        const res = await secureApi('userReport.settleSmBets', { userId });
        setMsg(res.message || (res.ok ? 'SM bets settled' : 'Failed to settle'));
      } else {
        let payload: Rec;
        try {
          payload = JSON.parse(json) as Rec;
        } catch {
          setMsg('Invalid JSON');
          return;
        }
        const res = await secureApi('userReport.settleJetfair', payload);
        setMsg(res.message || (res.ok ? 'Jetfair market settled' : 'Failed to settle'));
      }
    } finally {
      setBusy(false);
    }
  }, [userId, kind, json]);

  return (
    <View style={styles.formCard}>
      {kind === 'jetfair' ? (
        <>
          <Text style={styles.formLabel}>Settlement JSON</Text>
          <TextInput
            style={[styles.input, styles.jsonInput]}
            value={json}
            onChangeText={setJson}
            placeholder='{"marketId": "..."}'
            placeholderTextColor={colors.muted}
            multiline
          />
        </>
      ) : (
        <Text style={styles.muted}>Settle all pending SM bets for this user.</Text>
      )}
      <TouchableOpacity
        style={[styles.submitBtn, busy && styles.pagerBtnDisabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        <Text style={styles.submitBtnText}>
          {busy ? 'Settling…' : kind === 'sm' ? 'Settle SM Bets' : 'Settle Jetfair Market'}
        </Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
    </View>
  );
}

/* ------------------------------- player RTP ------------------------------- */

export function PlayerRtpLink({ userId }: { userId: string }) {
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
  }>();
  return (
    <View style={styles.formCard}>
      <Text style={styles.muted}>Player RTP report opens on its own page.</Text>
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() =>
          navigation.navigate('panel', {
            screen: 'playerRtp',
            params: { id: userId, fromUserReport: true },
          })
        }
      >
        <Text style={styles.submitBtnText}>Open Player RTP</Text>
      </TouchableOpacity>
    </View>
  );
}
