/**
 * Choose MID for Withdrawal — mobile port of desktop DepositWithdrawalMidModal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  buildDepositWithdrawalReportRequest,
  filterWithdrawalRoutingMidRows,
  mergeMidDepositRatioRows,
  mergeMidReportWithCatalog,
  parseDepositWithdrawalMidReport,
  resolveWithdrawalReportUserId,
  type MergedMidReportRow,
} from '@astro/shared/depositWithdrawalReport';
import { secureApi } from '../../api/client';
import { Button } from '../../components/UI';
import { colors, radius, spacing } from '../../theme';

type Rec = Record<string, unknown>;

type Props = {
  open: boolean;
  row: Rec | null;
  catalogMids: string[];
  onClose: () => void;
};

function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtAmount(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n).toLocaleString('en-IN') : '—';
}

export function DepositWithdrawalMidModal({ open, row, catalogMids, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MergedMidReportRow[]>([]);
  const [error, setError] = useState('');

  const userId = row ? resolveWithdrawalReportUserId(row) : '';
  const userLabel = String(row?.userName || row?.accountHolderName || userId || 'User').trim();
  const requestAmount = Number(row?.amount ?? 0);

  useEffect(() => {
    if (!open || !userId) {
      setRows([]);
      setError('');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const res = await secureApi<unknown>(
          'depositList.report',
          buildDepositWithdrawalReportRequest(userId),
        );
        if (!active) return;
        if (!res.ok) {
          setError(res.message || 'Failed to load deposit MID report');
          setRows([]);
          return;
        }
        const parsed = parseDepositWithdrawalMidReport(res.data);
        const merged = mergeMidDepositRatioRows(
          parsed.approvedDepositAmountByMid,
          parsed.approvedWithdrawalAmountByMid,
          parsed.depositWithdrawalRatioMidWise,
        );
        setRows(mergeMidReportWithCatalog(catalogMids, merged));
      } catch {
        if (active) {
          setError('Failed to load deposit MID report');
          setRows([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, userId, catalogMids]);

  const routingRows = useMemo(() => filterWithdrawalRoutingMidRows(rows), [rows]);

  const subtitle = useMemo(() => {
    if (!userId) return 'No user selected';
    const parts = [`User Id: ${userId}`];
    if (requestAmount > 0) parts.push(`Withdrawal: ₹${fmtAmount(requestAmount)}`);
    return parts.join(' · ');
  }, [userId, requestAmount]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose MID for Withdrawal</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {userLabel} · {subtitle}
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Loading MID list…</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : !routingRows.length ? (
              <View style={styles.centerState}>
                <Text style={styles.emptyTitle}>No routing MID available</Text>
                <Text style={styles.muted}>
                  User has deposited on all configured MIDs. Use a MID where the user has not
                  deposited.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.headCell, styles.midCol]}>MID</Text>
                  <Text style={[styles.headCell, styles.amountCol]}>User Deposit</Text>
                  <Text style={[styles.headCell, styles.amountCol]}>User Withdrawal</Text>
                </View>
                {routingRows.map((item) => (
                  <View key={item.mid} style={styles.tableRow}>
                    <Text style={[styles.bodyCell, styles.midCol, styles.midText]} numberOfLines={2}>
                      {display(item.mid)}
                    </Text>
                    <Text style={[styles.bodyCell, styles.amountCol]}>—</Text>
                    <Text style={[styles.bodyCell, styles.amountCol]}>
                      {Number(item.withdrawalAmount ?? 0) > 0
                        ? fmtAmount(item.withdrawalAmount ?? 0)
                        : '—'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: spacing(3) },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingVertical: spacing(8),
    paddingHorizontal: spacing(3),
  },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  errorText: { color: colors.destructive, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#ff9f0a',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  headCell: {
    color: '#1a1200',
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  bodyCell: {
    color: colors.foreground,
    fontSize: 13,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  midCol: { flex: 1.2 },
  amountCol: { flex: 1, textAlign: 'right' },
  midText: { fontWeight: '700' },
  footer: {
    padding: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
});
