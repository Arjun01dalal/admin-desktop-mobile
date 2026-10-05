/**
 * Indian Divas Settle — mobile port of Laxmi / desktop IndianDivasSettleModal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
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
import { colors} from '../../theme';
import { styles } from './IndianDivasSettleTab.styles';

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

