/**
 * Indian Divas Settle — mobile port of Laxmi / desktop IndianDivasSettleModal.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  formatIndianDivasMoney,
  indianDivasStatusLabel,
  normalizeIndianDivasPendingBets,
  type IndianDivasBetStatus,
  type IndianDivasPendingBet,
} from '@astro/shared/indianDivasSettle';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';

export function IndianDivasSettleTab({ userId }: { userId: string }) {
  const [bets, setBets] = useState<IndianDivasPendingBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<IndianDivasPendingBet | null>(null);
  const [winAmount, setWinAmount] = useState('');
  const [msg, setMsg] = useState('');

  const busy = Boolean(actionKey);

  const fetchPendingBets = useCallback(async () => {
    if (!userId) {
      setMsg('User id missing');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await secureApi('userReport.indianDivasPendingBets', { userId });
      if (!res.ok) {
        setBets([]);
        setMsg(res.message || 'Failed to fetch pending bets');
        return;
      }
      setBets(normalizeIndianDivasPendingBets(res.data));
    } catch (error) {
      setBets([]);
      setMsg(error instanceof Error ? error.message : 'Failed to fetch pending bets');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchPendingBets();
  }, [fetchPendingBets]);

  const updateBetStatus = useCallback(
    async (bet: IndianDivasPendingBet, status: IndianDivasBetStatus, amount?: number) => {
      const key = `${bet.transactionId}-${status}`;
      setActionKey(key);
      setMsg('');
      try {
        const body: Record<string, unknown> = {
          transactionId: bet.transactionId,
          status,
        };
        if (status === 'W') body.amount = Number(amount);

        const res = await secureApi('userReport.indianDivasUpdateBetStatus', body);
        if (!res.ok) {
          setMsg(res.message || 'Failed to update bet');
          return;
        }
        setMsg(`Bet marked as ${indianDivasStatusLabel(status)}`);
        setWinOpen(false);
        setSelectedBet(null);
        setWinAmount('');
        await fetchPendingBets();
      } catch (error) {
        setMsg(error instanceof Error ? error.message : 'Failed to update bet status');
      } finally {
        setActionKey(null);
      }
    },
    [fetchPendingBets],
  );

  const openWinDialog = (bet: IndianDivasPendingBet) => {
    setSelectedBet(bet);
    setWinAmount(
      bet.amount != null ? String(bet.amount) : bet.stake != null ? String(bet.stake) : '',
    );
    setWinOpen(true);
  };

  const handleWinSubmit = () => {
    if (!selectedBet) return;
    const amount = Number(winAmount);
    if (!winAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setMsg('Enter a valid win amount');
      return;
    }
    void updateBetStatus(selectedBet, 'W', amount);
  };

  const handleRollbackAll = useCallback(() => {
    if (!userId) {
      setMsg('User id missing');
      return;
    }
    Alert.alert(
      'Rollback all pending?',
      'This refunds stake for every pending Indian Divas bet for this user. This cannot be undone from here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rollback All',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionKey('rollback-all');
              setMsg('');
              try {
                const res = await secureApi('userReport.indianDivasRollbackAll', { userId });
                if (!res.ok) {
                  setMsg(res.message || 'Rollback failed');
                  return;
                }
                setMsg('All pending bets rolled back');
                await fetchPendingBets();
              } catch (error) {
                setMsg(
                  error instanceof Error ? error.message : 'Failed to rollback pending bets',
                );
              } finally {
                setActionKey(null);
              }
            })();
          },
        },
      ],
    );
  }, [fetchPendingBets, userId]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Indian Divas Settle</Text>
          <Text style={styles.sub}>
            {loading
              ? 'Loading pending bets…'
              : `${bets.length} pending bet${bets.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, (loading || busy) && styles.disabled]}
          onPress={() => void fetchPendingBets()}
          disabled={loading || busy}
        >
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Fetching pending bets</Text>
        </View>
      ) : bets.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.emptyTitle}>No pending bets</Text>
          <Text style={styles.muted}>This user has no open Indian Divas bets to settle.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {bets.map((bet, index) => {
            const winBusy = actionKey === `${bet.transactionId}-W`;
            const lossBusy = actionKey === `${bet.transactionId}-L`;
            const rollbackBusy = actionKey === `${bet.transactionId}-R`;
            return (
              <View key={bet.transactionId} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.index}>#{index + 1}</Text>
                  {(bet.gameName || bet.marketName) && (
                    <Text style={styles.game} numberOfLines={1}>
                      {[bet.gameName, bet.marketName].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <Text style={styles.txn} selectable>
                  {bet.transactionId}
                </Text>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Stake</Text>
                    <Text style={styles.statValue}>{formatIndianDivasMoney(bet.stake)}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Amount</Text>
                    <Text style={styles.statValue}>{formatIndianDivasMoney(bet.amount)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnWin, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() => openWinDialog(bet)}
                  >
                    <Text style={styles.btnTextLight}>{winBusy ? '…' : 'Win'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnLoss, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() => void updateBetStatus(bet, 'L')}
                  >
                    <Text style={styles.btnTextLight}>{lossBusy ? '…' : 'Loss'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnRollback, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() => void updateBetStatus(bet, 'R')}
                  >
                    <Text style={styles.btnTextDark}>{rollbackBusy ? '…' : 'Rollback'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[
          styles.rollbackAll,
          (loading || busy || bets.length === 0) && styles.disabled,
        ]}
        disabled={loading || busy || bets.length === 0}
        onPress={handleRollbackAll}
      >
        <Text style={styles.rollbackAllText}>
          {actionKey === 'rollback-all' ? 'Rolling back…' : 'Rollback All Pending'}
        </Text>
      </TouchableOpacity>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Modal
        visible={winOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setWinOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark as Win</Text>
            <Text style={styles.muted}>Credits this amount to the wallet with Win history.</Text>
            {selectedBet ? (
              <Text style={styles.txn} selectable>
                {selectedBet.transactionId}
              </Text>
            ) : null}
            <Text style={styles.formLabel}>Win Amount</Text>
            <TextInput
              style={styles.input}
              value={winAmount}
              onChangeText={setWinAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              editable={!busy}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                disabled={busy}
                onPress={() => setWinOpen(false)}
              >
                <Text style={styles.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnWin, busy && styles.disabled]}
                disabled={busy}
                onPress={handleWinSubmit}
              >
                <Text style={styles.btnTextLight}>
                  {actionKey?.endsWith('-W') ? 'Updating…' : 'Confirm Win'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(2) },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12 },
  refreshBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  refreshBtnText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  state: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  emptyTitle: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  list: { gap: spacing(2), paddingBottom: spacing(1) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(2),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1),
  },
  index: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  game: { flex: 1, color: colors.muted, fontSize: 12, textAlign: 'right' },
  txn: {
    color: colors.foreground,
    fontFamily: 'monospace',
    fontSize: 11,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
  },
  stats: { flexDirection: 'row', gap: spacing(2) },
  stat: { flex: 1 },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing(1), flexWrap: 'wrap' },
  btn: {
    flex: 1,
    minWidth: 72,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnWin: { backgroundColor: '#16a34a' },
  btnLoss: { backgroundColor: '#dc2626' },
  btnRollback: { backgroundColor: '#f59e0b' },
  btnTextLight: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnTextDark: { color: '#111827', fontWeight: '700', fontSize: 12 },
  rollbackAll: {
    backgroundColor: '#dc2626',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rollbackAllText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.5 },
  msg: { color: colors.muted, fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(2),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  formLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  modalActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  modalBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
