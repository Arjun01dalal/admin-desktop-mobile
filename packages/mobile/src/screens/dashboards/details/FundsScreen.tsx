/**
 * Funds — port of desktop FundsPage.
 * funds.upiPaymentApproved { startDate, endDate } builds the fund-name rows;
 * fundRequests.depositWithdrawal { startDate, endDate } supplies the Total Deposits
 * chip (gated on show_gateway_and_total). Row tap opens a detail sheet with every
 * column. Desktop's MID drill-down navigation is desktop-only (no /funds/mid route
 * on mobile) — the MID list is shown in the sheet instead.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  name: string;
  totalFinalAmount?: number;
  totalTransactionAmount?: number;
  totalCoinRemove?: number;
  mids?: unknown;
  [key: string]: unknown;
};

const MAIN_KEYS = new Set(['idx', 'name', 'totalFinalAmount', 'totalTransactionAmount']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function roundAmt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 0;
  return Math.round(num);
}

function formatAmt(value: unknown): string {
  return roundAmt(value).toLocaleString('en-IN');
}

/** Mirror desktop unpackPayload: unwrap a single `.payload` object. */
function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function formatFundRows(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([name, data]) =>
    typeof data === 'object' && data !== null
      ? { name, ...(data as Record<string, unknown>) }
      : { name },
  );
}

function normalizeMids(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object',
  );
}

export function FundsScreen() {
  const user = getSessionUser();
  const canShowTotal = hasPermission(Permissions.show_gateway_and_total);

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const [fundsRes, depositRes] = await Promise.all([
        secureApi<unknown>('funds.upiPaymentApproved', {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        }),
        secureApi<unknown>('fundRequests.depositWithdrawal', {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        }),
      ]);
      if (gen !== genRef.current) return;

      if (!fundsRes.ok) {
        setError(fundsRes.message || 'Failed to load funds');
        setRows([]);
      } else {
        const payload = unpackPayload(fundsRes.data);
        const formatted = formatFundRows(payload);
        const canShowGateway =
          hasPermission(Permissions.show_gateway_and_total) ||
          hasPermission(Permissions.show_gateway_only);
        const gateways = Array.isArray((user as { gateway?: unknown })?.gateway)
          ? ((user as { gateway?: string[] }).gateway as string[])
          : [];

        let filtered = formatted;
        if (gateways.length > 0) {
          filtered = formatted.filter((item) => gateways.includes(item.name));
        } else if (!canShowGateway) {
          filtered = formatted.filter((item) => item.name !== 'gateway');
        }
        setSheetRow(null);
        setRows(filtered);
      }

      if (depositRes.ok) {
        const dw = unpackPayload(depositRes.data);
        setTotalDeposit(Number(dw.totalDeposit ?? 0));
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: 'Sr No', width: 56, render: (_r, i) => String(i + 1) },
      {
        key: 'name',
        label: 'Name',
        width: 150,
        color: () => colors.primary,
        render: (r) => (r.name === 'coinRemove' ? 'Other Removal' : display(r.name)),
      },
      {
        key: 'totalFinalAmount',
        label: 'Total Amount',
        width: 130,
        align: 'right',
        render: (r) => formatAmt(r.totalFinalAmount),
      },
      {
        key: 'totalTransactionAmount',
        label: 'Automatic',
        width: 120,
        align: 'right',
        render: (r) => formatAmt(r.totalTransactionAmount),
      },
      {
        key: 'totalCoinRemove',
        label: 'Points Remove',
        width: 130,
        align: 'right',
        render: (r) => formatAmt(r.totalCoinRemove),
      },
    ],
    [],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const base = columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }));
    const mids = normalizeMids(sheetRow.mids);
    base.push({ label: 'MID Count', value: String(mids.length) });
    if (mids.length) {
      base.push({
        label: 'MIDs',
        multiline: true,
        value: mids
          .map((m) => String(m.mid ?? m.MID ?? m.midName ?? ''))
          .filter(Boolean)
          .join(', '),
      });
    }
    return base;
  }, [sheetRow, columns]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Funds</Text>

      {canShowTotal ? (
        <View style={styles.totalBox}>
          <Text style={styles.totalText}>Total Deposits: ₹ {formatAmt(totalDeposit)}</Text>
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => `${r.name}-${i}`}
        loading={loading}
        emptyMessage="No data"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={
          sheetRow
            ? sheetRow.name === 'coinRemove'
              ? 'Other Removal'
              : display(sheetRow.name)
            : ''
        }
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  totalBox: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  totalText: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
