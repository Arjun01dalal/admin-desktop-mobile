/**
 * New Deposits — port of desktop NewDepositsPage.
 * ops.newDeposits { itemsPerPage, pageNo, startDate, endDate, filter:{ name?, mobile? } }.
 * Date + per-page filter bar; name/mobile search modal; paged table. Row tap opens a
 * detail sheet with every desktop column. Mobile/email masked unless show_mobile.
 * accessibleStates (from stored user) filters rows client-side, mirroring desktop.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { usePagedSecureQuery } from '../../../hooks/usePagedSecureQuery';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display, maskMobile } from '../../../utils/display';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './NewDepositsScreen.styles';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  encryptedUserName?: string;
  previousCaller?: { name?: string; Dp_ID?: string; DP_ID?: string };
  previousCallerName?: string;
  previousCallerDpId?: string;
  currentCaller?: { name?: string };
  referredCode?: string;
  referredReferralCode?: string;
  referralCodeUser?: string;
  referralCode?: string;
  deviceType?: string;
  subDomain?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  balance?: number;
  createdOn?: string;
  updatedAt?: string;
  bonusWalletBalance?: number;
  [key: string]: unknown;
};

type Filters = { name: string; mobile: string };

const EMPTY_FILTERS: Filters = { name: '', mobile: '' };

function formatAmount(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Tolerant paged unpack: list under items/users/docs/payload(.items), count from total/count. */
function unpackNewDeposits(data: unknown): { rows: Row[]; total: number; totalPages: number } {
  if (Array.isArray(data)) {
    return { rows: data as Row[], total: data.length, totalPages: 1 };
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    let list: Row[] = [];
    for (const key of ['items', 'users', 'docs', 'data']) {
      const v = nested[key] ?? obj[key];
      if (Array.isArray(v)) {
        list = v as Row[];
        break;
      }
    }
    const total =
      Number(nested.total ?? nested.count ?? obj.total ?? obj.count ?? 0) || list.length;
    return { rows: list, total, totalPages: 1 };
  }
  return { rows: [], total: 0, totalPages: 1 };
}

export function NewDepositsScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();
  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Search modal.
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);

  const canShowMobile = hasPermission('show_mobile');

  const accessibleStates = useMemo(() => {
    const user = getStoredUser<{ accessibleStates?: unknown }>();
    const raw = user?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
  }, []);

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    return {
      itemsPerPage: pageSize,
      pageNo: page,
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      filter,
    };
  }, [page, pageSize, applied, startDate, endDate]);

  const {
    rows: rawRows,
    total,
    loading,
    error,
    load,
  } = usePagedSecureQuery<Row>({
    action: 'ops.newDeposits',
    buildPayload,
    unpack: unpackNewDeposits,
    autoDeps: [page, pageSize, applied, startDate, endDate],
    errorMessage: 'Failed to load new deposits',
  });

  useEffect(() => {
    setSheetRow(null);
  }, [rawRows]);

  const rows = useMemo(() => {
    if (accessibleStates.length === 0) return rawRows;
    return rawRows.filter((row) =>
      accessibleStates.includes(String(row.state || '').toLowerCase()),
    );
  }, [rawRows, accessibleStates]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const openUserReport = useCallback(
    (row: Row) => {
      if (!row._id) return;
      setSheetRow(null);
      navigation.navigate('/user-report', {
        userId: String(row._id),
        userName: String(row.name || ''),
      });
    },
    [navigation],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      {
        key: 'idx',
        label: 'Sr.No',
        width: 60,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      {
        key: 'name',
        label: 'Name',
        width: 140,
        render: (r) => display(r.name),
      },
      {
        key: 'mobile',
        label: 'Mobile Phone',
        width: 130,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      {
        key: 'userBankName',
        label: 'User Bank Name',
        width: 150,
        render: (r) => display(r.userBankName),
      },
      {
        key: 'encryptedDpId',
        label: 'User Encrypted Dp ID',
        width: 170,
        render: (r) => display(r.encryptedUserName),
      },
      { key: 'account', label: 'Account No', width: 140, render: (r) => display(r.accountNumber) },
      { key: 'aadhar', label: 'Aadhar No', width: 140, render: (r) => display(r.aadhaarNumber) },
      {
        key: 'email',
        label: 'Email',
        width: 170,
        render: (r) => (canShowMobile ? display(r.email) : '**********'),
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'previousCallerName',
        label: 'Previous Caller Name',
        width: 160,
        render: (r) => display(r.previousCaller?.name ?? r.previousCallerName),
      },
      {
        key: 'previousCallerDpId',
        label: 'Previous Caller DP ID',
        width: 160,
        render: (r) =>
          display(r.previousCaller?.Dp_ID ?? r.previousCaller?.DP_ID ?? r.previousCallerDpId),
      },
      {
        key: 'currentCaller',
        label: 'Current Caller',
        width: 140,
        render: (r) => display(r.currentCaller?.name),
      },
      {
        key: 'referredCode',
        label: 'Referred Referral Code',
        width: 170,
        render: (r) => display(r.referredCode ?? r.referredReferralCode),
      },
      {
        key: 'referralCode',
        label: 'Referral Code',
        width: 140,
        render: (r) => display(r.referralCodeUser ?? r.referralCode),
      },
      { key: 'device', label: 'Device Type', width: 120, render: (r) => display(r.deviceType) },
      { key: 'platform', label: 'Platform', width: 120, render: (r) => display(r.subDomain) },
      {
        key: 'currentAppVersion',
        label: 'Current App Version',
        width: 150,
        render: (r) => display(r.currentAppVersion),
      },
      {
        key: 'updatedAppVersion',
        label: 'Updated App Version',
        width: 150,
        render: (r) => display(r.updatedAppVersion),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 110,
        render: (r) => formatAmount(r.balance ?? 0),
      },
      {
        key: 'created',
        label: 'Created',
        width: 120,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 110,
        render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
      },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 180,
        render: (r) =>
          r.updatedAt
            ? `${formatDisplayDate(r.updatedAt)} | ${formatDisplayTime(r.updatedAt)}`
            : '—',
      },
      {
        key: 'bonusBalance',
        label: 'Bonus Balance',
        width: 130,
        render: (r) => formatAmount(r.bonusWalletBalance ?? 0),
      },
    ],
    [page, pageSize, canShowMobile],
  );

  const keyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <NewDepositCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={!!canShowMobile}
        onOpenSheet={() => setSheetRow(row)}
        onOpenReport={() => openUserReport(row)}
      />
    ),
    [page, pageSize, canShowMobile, openUserReport],
  );

  const listHeader = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>New Deposits</Text>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            setDraft(applied);
            setSearchOpen(true);
          }}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

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
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {applied.name || applied.mobile ? (
        <View style={styles.chipsRow}>
          <Text style={styles.chipsLabel}>Filters:</Text>
          {applied.name ? <Text style={styles.activeChip}>Name: {applied.name}</Text> : null}
          {applied.mobile ? <Text style={styles.activeChip}>Mobile: {applied.mobile}</Text> : null}
          <TouchableOpacity
            onPress={() => {
              setApplied(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            <Text style={styles.clearChip}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  const listFooter = (
    <View style={styles.pager}>
      <Text
        style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
        onPress={() => page > 1 && setPage((p) => p - 1)}
      >
        ‹ Prev
      </Text>
      <Text style={styles.pagerLabel}>
        Page {page} / {totalPages}
      </Text>
      <Text
        style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
        onPress={() => page < totalPages && setPage((p) => p + 1)}
      >
        Next ›
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No new deposits found"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={!searchOpen}
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        onClose={() => setSheetRow(null)}
        actions={
          sheetRow?._id
            ? [
                {
                  label: 'User Report',
                  tone: 'primary',
                  onPress: () => openUserReport(sheetRow),
                },
              ]
            : undefined
        }
      />

      {/* Search modal */}
      <Modal
        visible={searchOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setSearchOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Search New Deposits
              </Text>
              <TouchableOpacity
                onPress={() => setSearchOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={draft.name}
              onChangeText={(v) => setDraft((prev) => ({ ...prev, name: v }))}
              placeholder="Search by name"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Mobile</Text>
            <TextInput
              style={styles.modalInput}
              value={draft.mobile}
              onChangeText={(v) => setDraft((prev) => ({ ...prev, mobile: v }))}
              placeholder="Search by mobile"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => {
                setApplied(draft);
                setPage(1);
                setSearchOpen(false);
              }}
            >
              <Text style={styles.submitBtnText}>Apply Search</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

type NewDepositCardProps = {
  row: Row;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  onOpenSheet: () => void;
  onOpenReport: () => void;
};

const NewDepositCard = memo(function NewDepositCard({
  row,
  index,
  page,
  pageSize,
  canShowMobile,
  onOpenSheet,
  onOpenReport,
}: NewDepositCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onOpenSheet}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.name)}
        </Text>
        {row._id ? (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={onOpenReport}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.reportBtnText}>User Report</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Balance</Text>
        <Text style={styles.cardValue}>{formatAmount(row.balance ?? 0)}</Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          Mobile: {maskMobile(row.mobile, canShowMobile)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          State: {display(row.state)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>City</Text>
        <Text style={styles.cardValue}>{display(row.city)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Created</Text>
        <Text style={styles.cardValue}>
          {row.createdOn
            ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
            : '—'}
        </Text>
      </View>
      <Text style={styles.cardHint}>Tap card for full details</Text>
    </TouchableOpacity>
  );
});
