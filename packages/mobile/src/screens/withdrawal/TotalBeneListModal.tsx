/**
 * Total Bene List — mobile port of Laxmi / desktop TotalBeneListDialog.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  normalizeBeneAccountCountSummary,
  type BeneAccountCountItem,
} from '@astro/shared/beneficiaryAccountCounts';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';

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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(5),
    paddingBottom: spacing(4),
    gap: spacing(2.5),
  },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: spacing(0.5) },
  state: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  scroll: { maxHeight: 420 },
  summaryRow: {
    gap: spacing(1),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  summaryText: { color: colors.foreground, fontSize: 13 },
  bold: { fontWeight: '700' },
  error: { color: '#dc2626', fontSize: 12, marginBottom: spacing(1) },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: spacing(4) },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    marginBottom: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  rowTitle: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  rowMeta: { color: colors.muted, fontSize: 12 },
  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing(1),
  },
  closeBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
});
