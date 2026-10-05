/**
 * Active User Withdrawal — mobile port of desktop ActiveUserWithdrawalPage.
 * Laxmi parity: Beneficiary List (Pending) filter forces Pending and omits dates.
 * Row actions reuse useWithdrawalActions (lock/check/approve/bulk/QR/Add Bene).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ACTIVE_USER_WITHDRAWAL_SORT_BY,
  ACTIVE_USER_WITHDRAWAL_SORT_ORDER,
  ACTIVE_USER_WITHDRAWAL_STATUSES,
  DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE,
  appCodeForName,
  buildActiveUserWithdrawalPayload,
  empCodeFromUser,
  normalizeActiveUserWithdrawals,
  pickPageSizes,
  pickWithdrawalAmount,
  pickWithdrawalApp,
  pickWithdrawalCreatedAt,
  pickWithdrawalDpId,
  pickWithdrawalMobile,
  pickWithdrawalName,
  pickWithdrawalOrderId,
  pickWithdrawalRowKey,
  pickWithdrawalStatus,
  type ActiveUserWithdrawalRow,
  type ActiveUserWithdrawalSortBy,
  type ActiveUserWithdrawalSortOrder,
} from '@astro/shared';
import { colors, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, isCallerRole } from '../../../auth/permissions';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { DateField } from '../../../components/DateField';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { WithdrawalModals } from '../../withdrawal/WithdrawalModals';
import { WithdrawalCardFooter } from '../../withdrawal/WithdrawalCardFooter';
import { useWithdrawalActions } from '../../withdrawal/useWithdrawalActions';
import { toWithdrawalRec } from '../../withdrawal/toWithdrawalRec';
import { display, statusBadgeBg, type Rec } from '../../withdrawal/helpers';
import { styles as wdStyles } from '../../WithdrawalScreen.styles';
import { styles } from './ActiveUserWithdrawalScreen.styles';

const PAGE_SIZE_OPTIONS = pickPageSizes([20, 50, 100, 200]);

type AppliedFilters = {
  empCode: string;
  startDate: string;
  endDate: string;
  status: string;
  sortBy: ActiveUserWithdrawalSortBy;
  sortOrder: ActiveUserWithdrawalSortOrder;
  beneficiaryAccounts: string[];
};

function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function maskMobile(value: string, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? value : '**********';
}

export function ActiveUserWithdrawalScreen() {
  const user = getSessionUser() as Record<string, unknown> | null;

  const loginEmpCode = empCodeFromUser(user);
  const isCaller = isCallerRole(user);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);

  const [draftEmpCode, setDraftEmpCode] = useState(loginEmpCode);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState<ActiveUserWithdrawalSortBy>('activeUser');
  const [sortOrder, setSortOrder] = useState<ActiveUserWithdrawalSortOrder>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE);
  const [beneficiaryAccounts, setBeneficiaryAccounts] = useState<string[]>([]);
  const [draftBeneficiaryAccounts, setDraftBeneficiaryAccounts] = useState<string[]>([]);
  const [benePendingOpen, setBenePendingOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const draftBeneRef = useRef<string[]>([]);
  draftBeneRef.current = draftBeneficiaryAccounts;

  const [applied, setApplied] = useState<AppliedFilters>({
    empCode: loginEmpCode,
    startDate: todayIST(),
    endDate: todayIST(),
    status: 'All',
    sortBy: 'activeUser',
    sortOrder: 'asc',
    beneficiaryAccounts: [],
  });

  const [apiRows, setApiRows] = useState<ActiveUserWithdrawalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi(
        'withdrawals.byActiveUser',
        buildActiveUserWithdrawalPayload({
          empCode: applied.empCode,
          status: applied.status,
          sortBy: applied.sortBy,
          sortOrder: applied.sortOrder,
          startDate: applied.startDate,
          endDate: applied.endDate,
          pageNo: page,
          itemPerPage: pageSize,
          beneficiaryAccounts: applied.beneficiaryAccounts,
        }),
      );
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load active user withdrawals');
        setApiRows([]);
        return;
      }
      const parsed = normalizeActiveUserWithdrawals(res.data, pageSize);
      setApiRows(parsed.rows);
      setTotal(parsed.total);
      setTotalPages(Math.max(1, parsed.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [applied, page, pageSize]);

  const onRefresh = useCallback(() => {
    void load();
  }, [load]);

  const actions = useWithdrawalActions({ onRefresh });
  const {
    perms,
    selected,
    setSelected,
    sheetActions,
    validationRow,
    setValidationRow,
    bulkManualOpen,
    setBulkManualOpen,
    actionBusy,
    bulkIds,
    gateways,
    gateway,
    setGateway,
    mids,
    mid,
    setMid,
    modalErr,
    setModalErr,
    doBulkManual,
    addBeneRow,
    addBeneBusy,
    setAddBeneRow,
    addBeneSelected,
    setAddBeneSelected,
    addBeneSearch,
    setAddBeneSearch,
    availableBanks,
    beneAccOptions,
    addBeneExisting,
    submitAddBene,
    beneOpen,
    setBeneOpen,
    beneBusy,
    beneInput,
    setBeneInput,
    beneBanks,
    setBeneBanks,
    saveBeneBanks,
    approveTarget,
    setApproveTarget,
    provider,
    setProvider,
    doBulk,
    doStatusUpdate,
    qrRow,
    setQrRow,
    qrQuery,
    qrRef,
    openUpiApp,
    downloadQr,
    gatewayOptions,
    statusModal,
    setStatusModal,
    remark,
    setRemark,
    openBeneModal,
    bulkMode,
    bulkSel,
    setBulkSel,
    clearBulk,
    setBulkMode,
    confirmBulk,
    openBotReport,
    openAddBene,
    doCheck,
    txnIdOf,
  } = actions;

  const rows = useMemo(() => apiRows.map((row) => toWithdrawalRec(row)), [apiRows]);

  useEffect(() => {
    setSelected(null);
  }, [applied, page, pageSize, setSelected]);

  useEffect(() => {
    if (!loginEmpCode) return;
    setDraftEmpCode((prev) => prev || loginEmpCode);
    setApplied((prev) => (prev.empCode ? prev : { ...prev, empCode: loginEmpCode }));
  }, [loginEmpCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyBenePendingPanel = useCallback(() => {
    const next = draftBeneRef.current;
    setBeneficiaryAccounts(next);
    if (next.length > 0) {
      setStatus('Pending');
      setApplied((prev) => ({
        ...prev,
        empCode: draftEmpCode.trim() || prev.empCode,
        beneficiaryAccounts: next,
        status: 'Pending',
        startDate: '',
        endDate: '',
      }));
    } else {
      setStatus('All');
      setApplied((prev) => ({
        ...prev,
        empCode: draftEmpCode.trim() || prev.empCode,
        beneficiaryAccounts: [],
        status: 'All',
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      }));
    }
    setBenePendingOpen(false);
    setPage(1);
  }, [draftEmpCode, endDate, startDate]);

  const openBenePendingPanel = useCallback(() => {
    setDraftBeneficiaryAccounts(beneficiaryAccounts);
    setBenePendingOpen(true);
  }, [beneficiaryAccounts]);

  const toggleBenePendingPanel = useCallback(() => {
    if (benePendingOpen) {
      applyBenePendingPanel();
    } else {
      openBenePendingPanel();
    }
  }, [applyBenePendingPanel, benePendingOpen, openBenePendingPanel]);

  const applyFilters = () => {
    const nextBene = benePendingOpen ? draftBeneRef.current : beneficiaryAccounts;
    if (benePendingOpen) {
      setBeneficiaryAccounts(nextBene);
      setBenePendingOpen(false);
      if (nextBene.length > 0) setStatus('Pending');
    }
    const beneForced = nextBene.length > 0;
    setApplied({
      empCode: draftEmpCode.trim(),
      startDate: beneForced ? '' : startDate || todayIST(),
      endDate: beneForced ? '' : endDate || todayIST(),
      status: beneForced ? 'Pending' : status,
      sortBy,
      sortOrder,
      beneficiaryAccounts: nextBene,
    });
    setPage(1);
  };

  const handleClear = () => {
    const today = todayIST();
    setDraftEmpCode(loginEmpCode);
    setStartDate(today);
    setEndDate(today);
    setStatus('All');
    setSortBy('activeUser');
    setSortOrder('asc');
    setBeneficiaryAccounts([]);
    setDraftBeneficiaryAccounts([]);
    setBenePendingOpen(false);
    setApplied({
      empCode: loginEmpCode,
      startDate: today,
      endDate: today,
      status: 'All',
      sortBy: 'activeUser',
      sortOrder: 'asc',
      beneficiaryAccounts: [],
    });
    setPage(1);
  };

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    const fields: SheetField[] = [
      { label: 'Name', value: pickWithdrawalName(selected) },
      { label: 'DP ID', value: pickWithdrawalDpId(selected) || '—' },
      { label: 'App', value: String(appCodeForName(pickWithdrawalApp(selected)) || '—') },
      { label: 'Created', value: formatDisplayDate(pickWithdrawalCreatedAt(selected)) || '—' },
      { label: 'Amount', value: formatMoney(pickWithdrawalAmount(selected)) },
      { label: 'Status', value: pickWithdrawalStatus(selected) },
    ];
    if (!isCaller) {
      fields.splice(
        3,
        0,
        { label: 'Mobile', value: maskMobile(pickWithdrawalMobile(selected), canShowMobile) },
        {
          label: 'User Bank',
          value: String(selected.userBankName || '—'),
          copyable: true,
          copyValue: String(selected.userBankName || '').trim(),
        },
        {
          label: 'Account No',
          value: String(selected.accountNo || selected.accountNumber || '—'),
          copyable: true,
          copyValue: String(selected.accountNo || selected.accountNumber || '').trim(),
        },
        { label: 'Bank', value: String(selected.bankName || '—') },
        { label: 'Order ID', value: pickWithdrawalOrderId(selected) },
      );
    }
    fields.push({
      label: 'Emp Code',
      value: String(selected.empCode || applied.empCode || '—'),
    });
    return fields;
  }, [applied.empCode, canShowMobile, isCaller, selected]);

  const onCardPress = (row: Rec) => {
    if (!bulkMode) {
      setSelected(row);
      return;
    }
    const id = txnIdOf(row);
    if (!id) return;
    setBulkSel((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = row;
      return next;
    });
  };

  const beneActive = beneficiaryAccounts.length > 0;
  const draftBeneActive = draftBeneficiaryAccounts.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Active User Withdrawal</Text>
          <Text style={styles.sub}>
            {total.toLocaleString('en-IN')} withdrawals
            {applied.empCode ? ` · ${applied.empCode}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.filterBox}>
        <TouchableOpacity
          style={styles.filterHeader}
          activeOpacity={0.8}
          onPress={() => setFiltersExpanded((open) => !open)}
        >
          <Text style={styles.filterHeaderTitle}>Filters</Text>
          <Text style={styles.filterHeaderChevron}>{filtersExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {filtersExpanded ? (
          <>
        <Text style={styles.fieldLabel}>Emp Code</Text>
        <TextInput
          style={styles.textInput}
          value={draftEmpCode}
          onChangeText={setDraftEmpCode}
          placeholder="e.g. EMP001"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>From</Text>
        <DateField value={startDate} onChange={setStartDate} />
        <Text style={styles.fieldLabel}>To</Text>
        <DateField value={endDate} onChange={setEndDate} />

        <Text style={styles.fieldLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ACTIVE_USER_WITHDRAWAL_STATUSES.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, status === opt.value && styles.chipActive]}
              onPress={() => {
                setStatus(opt.value);
                setApplied((prev) => ({ ...prev, status: opt.value }));
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, status === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Beneficiary List (Pending)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <TouchableOpacity
            style={[
              styles.chip,
              (benePendingOpen || beneActive) && styles.chipActive,
            ]}
            onPress={toggleBenePendingPanel}
          >
            <Text
              style={[
                styles.chipText,
                (benePendingOpen || beneActive) && styles.chipTextActive,
              ]}
            >
              {beneficiaryAccounts.length === 0
                ? `Bene Pending ${benePendingOpen ? '▲' : '▼'}`
                : beneficiaryAccounts.length === 1
                  ? (() => {
                      const name = beneficiaryAccounts[0];
                      const opt = beneAccOptions.find((o) => o.name === name);
                      return opt
                        ? `${opt.name} (${opt.pendingWithdrawalCount})`
                        : name;
                    })()
                  : `${beneficiaryAccounts.length} Bene`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        {benePendingOpen ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !draftBeneActive && styles.chipActive]}
              onPress={() => setDraftBeneficiaryAccounts([])}
            >
              <Text style={[styles.chipText, !draftBeneActive && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {beneAccOptions.map((option) => {
              const active = draftBeneficiaryAccounts.includes(option.name);
              return (
                <TouchableOpacity
                  key={option.name}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setDraftBeneficiaryAccounts((prev) =>
                      active ? prev.filter((n) => n !== option.name) : [...prev, option.name],
                    );
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.name} ({option.pendingWithdrawalCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.chip, styles.chipActive]}
              onPress={applyBenePendingPanel}
            >
              <Text style={[styles.chipText, styles.chipTextActive]}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        <Text style={styles.fieldLabel}>Sort by</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ACTIVE_USER_WITHDRAWAL_SORT_BY.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, sortBy === opt.value && styles.chipActive]}
              onPress={() => setSortBy(opt.value)}
            >
              <Text style={[styles.chipText, sortBy === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Order</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ACTIVE_USER_WITHDRAWAL_SORT_ORDER.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, sortOrder === opt.value && styles.chipActive]}
              onPress={() => setSortOrder(opt.value)}
            >
              <Text style={[styles.chipText, sortOrder === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Per page</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, pageSize === opt && styles.chipActive]}
              onPress={() => {
                setPageSize(opt);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, pageSize === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.filterActions}>
          <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary]} onPress={applyFilters}>
            <Text style={styles.formBtnPrimaryText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={handleClear}>
            <Text style={styles.formBtnGhostText}>Clear</Text>
          </TouchableOpacity>
        </View>
          </>
        ) : null}
      </View>

      {perms.actions ? (
        <View style={[wdStyles.bulkBar, { marginTop: spacing(3) }]}>
          <TouchableOpacity
            style={[wdStyles.chip, bulkMode && styles.chipActive]}
            onPress={() => (bulkMode ? clearBulk() : setBulkMode(true))}
          >
            <Text style={[wdStyles.chipText, bulkMode && styles.chipTextActive]}>
              {bulkMode ? `Bulk: ${bulkIds.length} selected ✕` : 'Bulk Select'}
            </Text>
          </TouchableOpacity>
          {bulkMode ? (
            <>
              <TouchableOpacity style={wdStyles.bulkBtn} onPress={() => confirmBulk('lock')}>
                <Text style={wdStyles.bulkBtnText}>Bulk Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={wdStyles.bulkBtn} onPress={() => confirmBulk('unlock')}>
                <Text style={wdStyles.bulkBtnText}>Bulk UnLock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={wdStyles.bulkBtn} onPress={() => confirmBulk('approve')}>
                <Text style={wdStyles.bulkBtnText}>Bulk Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={wdStyles.bulkBtn}
                onPress={() => {
                  if (bulkIds.length === 0) {
                    Alert.alert('No refunds selected', 'Cards pe tap karke select karo.');
                    return;
                  }
                  setModalErr('');
                  setBulkManualOpen(true);
                }}
              >
                <Text style={wdStyles.bulkBtnText}>Bulk Manual Approve</Text>
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity style={wdStyles.bulkBtn} onPress={() => void openBeneModal()}>
            <Text style={wdStyles.bulkBtnText}>Add Bene List</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {bulkMode && bulkIds.length > 0 ? (
        <Text style={wdStyles.muted}>
          Selected:{' '}
          {Object.values(bulkSel)
            .map((r) => display(r.accountHolderName ?? r.userName))
            .join(', ')}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No withdrawals found</Text> : null}
      {bulkMode ? (
        <Text style={styles.hint}>Tap cards to select/deselect for bulk actions</Text>
      ) : rows.length > 0 ? (
        <Text style={styles.hint}>Tap a card for details & actions</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const id = txnIdOf(row);
          const isBulkSelected = Boolean(id && bulkSel[id]);
          return (
            <TouchableOpacity
              key={pickWithdrawalRowKey(row, index)}
              style={[styles.card, isBulkSelected && styles.cardBulkSelected]}
              activeOpacity={0.75}
              onPress={() => onCardPress(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusBadgeBg(row.status), color: '#fff' },
                  ]}
                >
                  {pickWithdrawalStatus(row)}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {pickWithdrawalName(row)}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {pickWithdrawalDpId(row) || '—'} ·{' '}
                {String(appCodeForName(pickWithdrawalApp(row)) || '—')}
                {row.empCode || applied.empCode
                  ? ` · ${String(row.empCode || applied.empCode)}`
                  : ''}
              </Text>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  {formatMoney(pickWithdrawalAmount(row) ?? row.amount)}
                </Text>
                <Text style={styles.cardSplitRight}>
                  {formatDisplayDate(pickWithdrawalCreatedAt(row)) || '—'}
                </Text>
              </View>
              <WithdrawalCardFooter
                row={row}
                checksDisabled={perms.checksDisabled}
                bulkMode={bulkMode}
                actionBusy={actionBusy}
                addBeneBusy={addBeneBusy}
                canAddBeneficiary={perms.actions}
                onBotReport={openBotReport}
                onAddBeneficiary={openAddBene}
                onCheck={doCheck}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.accountHolderName ?? selected.userName) : ''}
        fields={sheetFields}
        onClose={() => (actionBusy ? undefined : setSelected(null))}
        actions={selected ? sheetActions(selected) : undefined}
        note={actionBusy ? 'Working…' : undefined}
      />

      <WithdrawalModals
        validationRow={validationRow}
        setValidationRow={setValidationRow}
        bulkManualOpen={bulkManualOpen}
        setBulkManualOpen={setBulkManualOpen}
        actionBusy={actionBusy}
        bulkIds={bulkIds}
        gateways={gateways}
        gateway={gateway}
        setGateway={setGateway}
        mids={mids}
        mid={mid}
        setMid={setMid}
        modalErr={modalErr}
        setModalErr={setModalErr}
        doBulkManual={doBulkManual}
        addBeneRow={addBeneRow}
        addBeneBusy={addBeneBusy}
        setAddBeneRow={setAddBeneRow}
        addBeneSelected={addBeneSelected}
        setAddBeneSelected={setAddBeneSelected}
        addBeneSearch={addBeneSearch}
        setAddBeneSearch={setAddBeneSearch}
        availableBanks={availableBanks}
        addBeneExisting={addBeneExisting}
        submitAddBene={submitAddBene}
        beneOpen={beneOpen}
        setBeneOpen={setBeneOpen}
        beneBusy={beneBusy}
        beneInput={beneInput}
        setBeneInput={setBeneInput}
        beneBanks={beneBanks}
        setBeneBanks={setBeneBanks}
        saveBeneBanks={saveBeneBanks}
        approveTarget={approveTarget}
        setApproveTarget={setApproveTarget}
        provider={provider}
        setProvider={setProvider}
        doBulk={doBulk}
        doStatusUpdate={doStatusUpdate}
        qrRow={qrRow}
        setQrRow={setQrRow}
        qrUrl={qrQuery}
        qrRef={qrRef}
        openUpiApp={openUpiApp}
        downloadQr={downloadQr}
        gatewayOptions={gatewayOptions}
        statusModal={statusModal}
        setStatusModal={setStatusModal}
        remark={remark}
        setRemark={setRemark}
      />

      {rows.length > 0 ? (
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
      ) : null}
    </ScrollView>
  );
}

