/**
 * Total Bene List — mobile port of Laxmi / desktop TotalBeneListDialog.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  normalizeBeneAccountCountSummary,
  type BeneAccountCountItem,
} from '@astro/shared/beneficiaryAccountCounts';
import { secureApi } from '../../api/client';
import { colors} from '../../theme';
import { styles } from './TotalBeneListModal.styles';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TotalBeneListModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalUsersWithAny, setTotalUsersWithAny] = useState(0);
  const [items, setItems] = useState<BeneAccountCountItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await secureApi('withdrawals.beneficiaryAccountsUserCount', {});
        if (cancelled) return;
        if (!res.ok) {
          setError(res.message || 'Failed to load beneficiary list');
          setItems([]);
          setTotalAccounts(0);
          setTotalUsersWithAny(0);
          return;
        }
        const summary = normalizeBeneAccountCountSummary(res.data);
        setTotalAccounts(summary.totalAccounts);
        setTotalUsersWithAny(summary.totalUsersWithAny);
        setItems(summary.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load beneficiary list');
          setItems([]);
          setTotalAccounts(0);
          setTotalUsersWithAny(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Total Bene List</Text>
          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>
                  <Text style={styles.bold}>Total Accounts:</Text> {totalAccounts}
                </Text>
                <Text style={styles.summaryText}>
                  <Text style={styles.bold}>Total Users With Any:</Text> {totalUsersWithAny}
                </Text>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {items.length === 0 && !error ? (
                <Text style={styles.empty}>No beneficiary data found</Text>
              ) : (
                items.map((row, index) => (
                  <View key={`${row.beneficiaryAccount}-${index}`} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      #{index + 1} · {row.beneficiaryAccount || '—'}
                    </Text>
                    <Text style={styles.rowMeta}>Users: {row.userCount}</Text>
                    <Text style={styles.rowMeta}>
                      Pending: {row.pendingWithdrawalCount} · Approved:{' '}
                      {row.approvedWithdrawalCount}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

