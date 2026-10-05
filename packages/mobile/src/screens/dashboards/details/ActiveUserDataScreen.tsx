/**
 * Provider-wise active players — port of laxminarayan ActiveUserData /
 * desktop ActiveUserDataPage.
 * Phone UI: compact cards (not a horizontal table).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors } from '../../../theme';
import { secureApi } from '../../../api/client';
import { providerWiseActive, toNum } from '../../../dashboards/mergeMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './ActiveUserDataScreen.styles';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  state?: string;
  city?: string;
  balance?: number;
  kyc?: boolean;
  [key: string]: unknown;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function ActiveUserDataScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const customerKey = String(params.customerKey || '').trim();
  const appClientName = String(params.appClientName || '');
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    if (!customerKey) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: 50,
        pageNo: page,
        activeUserStart: startDate,
        activeUserEnd: endDate,
        filter,
      };
      if (appClientName) {
        filter.clientName = appClientName;
        payload.app = [appClientName];
      }

      const res = await secureApi('dashboard.activeCustomersCategory', payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load active users');
        setRows([]);
        setTotalPages(1);
        return;
      }

      const providerWise = providerWiseActive(res.data);
      const keyLower = customerKey.toLowerCase();
      const entry =
        (providerWise[customerKey] as Record<string, unknown> | undefined) ||
        (Object.entries(providerWise).find(([k]) => k.toLowerCase() === keyLower)?.[1] as
          Record<string, unknown> | undefined) ||
        {};

      setRows(Array.isArray(entry.list) ? (entry.list as UserRow[]) : []);
      setTotalPages(Math.max(1, toNum(entry.totalPages) || 1));
    } finally {
      setLoading(false);
    }
  }, [appClientName, customerKey, endDate, page, startDate]);

  useEffect(() => {
    setPage(1);
  }, [customerKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return [
      { label: 'Name', value: display(selected.name) },
      { label: 'Mobile', value: display(selected.mobile) },
      { label: 'State', value: display(selected.state) },
      { label: 'City', value: display(selected.city) },
      { label: 'Balance', value: toNum(selected.balance).toFixed(2) },
      { label: 'KYC', value: selected.kyc ? 'Yes' : 'No' },
    ];
  }, [selected]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Active User Data')}</Text>
      <Text style={styles.description}>
        {toDisplayText(customerKey || 'provider')} · {startDate} → {endDate}
      </Text>

      {!customerKey ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Open this screen from a provider card player count.</Text>
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
          setPage(1);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && rows.length === 0 && customerKey ? (
        <Text style={styles.emptyTextCenter}>No Data Found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSelected(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * 50 + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              <Text style={[styles.kycPill, row.kyc ? styles.kycYes : styles.kycNo]}>
                {row.kyc ? 'KYC' : 'No KYC'}
              </Text>
            </View>
            <View style={styles.cardGrid}>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.mobile)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Balance</Text>
                <Text style={[styles.cardValue, styles.cardAmount]} numberOfLines={1}>
                  ₹{toNum(row.balance).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>State</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.state)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>City</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.city)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardHint}>Tap for all details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={String(selected?.name || 'User Details')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />

      {totalPages > 1 ? (
        <View style={styles.pager}>
          <TouchableOpacity
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>
            Page {page} / {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page >= totalPages || loading}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

