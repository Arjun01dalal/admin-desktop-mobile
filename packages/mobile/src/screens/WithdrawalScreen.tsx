/**
 * Withdrawal — mobile port of desktop WithdrawalPage (route /withdrawal).
 *
 * The screen owns only composition. Data loading, filters, permissions, and
 * action workflows live in useWithdrawalScreen.
 */
import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  resolveWithdrawalReportUserId,
  showWithdrawalMidReport,
} from '@astro/shared/depositWithdrawalReport';
import { colors } from '../theme';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
import { RowDetailSheet, type SheetField } from './dashboards/details/RowDetailSheet';
import { SheetDownloadOtpModal } from '../components/SheetDownloadOtpModal';
import { DepositWithdrawalMidModal } from './withdrawal/DepositWithdrawalMidModal';
import { WithdrawalModals } from './withdrawal/WithdrawalModals';
import { WithdrawalCardFooter } from './withdrawal/WithdrawalCardFooter';
import { WithdrawalToolbar } from './withdrawal/WithdrawalToolbar';
import { display, fmtAmount, statusBadgeBg, type Rec } from './withdrawal/helpers';
import { styles } from './WithdrawalScreen.styles';
import { useWithdrawalScreen } from './withdrawal/useWithdrawalScreen';

const COPYABLE_COLUMN_KEYS = new Set(['bank', 'accountNo', 'ifsc']);

function rawCopyValue(row: Rec, key: string): string {
  if (key === 'bank') return String(row.userBankName ?? row.bankName ?? '').trim();
  if (key === 'accountNo') return String(row.accountNo ?? row.accountNumber ?? '').trim();
  if (key === 'ifsc') return String(row.ifscCode ?? row.ifsc ?? '').trim();
  return '';
}

function buildWithdrawalSheetFields(
  selected: Rec | null,
  columns: Array<{
    key: string;
    label: string;
    render: (row: Rec, index: number) => string;
    color?: (row: Rec) => string | undefined;
  }>,
): SheetField[] {
  if (!selected) return [];
  const fields: SheetField[] = [];
  for (const column of columns) {
    const copyable = COPYABLE_COLUMN_KEYS.has(column.key);
    fields.push({
      label: column.label,
      value: column.render(selected, 0),
      color: column.color?.(selected),
      copyable,
      copyValue: copyable ? rawCopyValue(selected, column.key) : undefined,
    });
    if (column.key === 'ifsc') {
      const upi = String(selected.upiId ?? '').trim();
      fields.push({
        label: 'UPI Id',
        value: display(upi),
        copyable: true,
        copyValue: upi,
      });
    }
  }
  return fields;
}

export function WithdrawalScreen() {
  const model = useWithdrawalScreen();
  const {
    rows,
    summary,
    loading,
    msg,
    perms,
    columns,
    selected,
    setSelected,
    sheetActions,
    openMidReport,
    midReportRow,
    midReportOpen,
    setMidReportRow,
    setMidReportOpen,
    catalogMids,
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
    toolsOpen,
    setToolsOpen,
    sortChecked,
    setSortChecked,
    bankAmtDraft,
    setBankAmtDraft,
    bankAmt,
    setBankAmt,
    midFilter,
    setMidFilter,
    midFilterOpen,
    setMidFilterOpen,
    openBeneModal,
    downloadData,
    downloadPayok,
    downloadYesBank,
    draftStart,
    draftEnd,
    setDraftStart,
    setDraftEnd,
    setStartDate,
    setEndDate,
    setPage,
    pageSize,
    setPageSize,
    searchField,
    setSearchField,
    searchDraft,
    setSearchDraft,
    setApplied,
    status,
    setStatus,
    requestSheetDownload,
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
    totalPages,
    page,
    sheetOtp,
    setSheetOtp,
    sheetAfterOtp,
    refresh,
  } = model;

  const renderWithdrawalMidIcon = useCallback(
    (row: Rec) => {
      const reportUserId = resolveWithdrawalReportUserId(row);
      if (!reportUserId || !showWithdrawalMidReport(String(row.status || ''))) return null;
      return (
        <TouchableOpacity
          accessibilityLabel="Choose MID for Withdrawal"
          onPress={() => openMidReport(row)}
          style={styles.midReportBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialCommunityIcons name="chart-box-outline" size={15} color="#ff9f0a" />
        </TouchableOpacity>
      );
    },
    [openMidReport],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Refund</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipLabel}>Total User</Text>
          <Text style={styles.summaryChipValue}>{model.totalUsers}</Text>
        </View>
        {summary.map((item) => (
          <View key={item.label} style={styles.summaryChip}>
            <Text style={styles.summaryChipLabel}>{item.label}</Text>
            <Text style={styles.summaryChipValue}>
              {item.count} · ₹{fmtAmount(item.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <WithdrawalToolbar
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        sortChecked={sortChecked}
        setSortChecked={setSortChecked}
        bankAmtDraft={bankAmtDraft}
        setBankAmtDraft={setBankAmtDraft}
        bankAmt={bankAmt}
        setBankAmt={setBankAmt}
        midFilter={midFilter}
        setMidFilter={setMidFilter}
        midFilterOpen={midFilterOpen}
        setMidFilterOpen={setMidFilterOpen}
        mids={mids}
        canManageBeneficiaries={perms.actions}
        onOpenBeneList={() => void openBeneModal()}
        canDownload={perms.download}
        requestSheetDownload={requestSheetDownload}
        downloadData={downloadData}
        downloadPayok={downloadPayok}
        downloadYesBank={downloadYesBank}
        draftStart={draftStart}
        draftEnd={draftEnd}
        loading={loading}
        setDraftStart={setDraftStart}
        setDraftEnd={setDraftEnd}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        searchField={searchField}
        setSearchField={setSearchField}
        searchDraft={searchDraft}
        setSearchDraft={setSearchDraft}
        setApplied={setApplied}
        status={status}
        setStatus={setStatus}
        msg={msg}
        canManageActions={perms.actions}
        bulkMode={bulkMode}
        bulkIds={bulkIds}
        bulkSel={bulkSel}
        clearBulk={clearBulk}
        setBulkMode={setBulkMode}
        confirmBulk={confirmBulk}
        setModalErr={setModalErr}
        setBulkManualOpen={setBulkManualOpen}
      />

      <ResponsiveTable
        forceCards
        previewFieldCount={3}
        columns={columns}
        rows={rows}
        renderCardTitleSuffix={renderWithdrawalMidIcon}
        keyFor={(row, index) => String(row._id ?? row.transactionId ?? index)}
        loading={loading}
        emptyMessage="No withdrawals"
        hint={
          bulkMode
            ? 'Tap cards to select/deselect for bulk actions'
            : 'Tap a card for details & actions'
        }
        getCardBadge={(row) => {
          const text = display(row.status);
          return text === '—' ? null : { text, color: statusBadgeBg(row.status) };
        }}
        onRowPress={(row) => {
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
        }}
        renderCardFooter={(row) => (
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
        )}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.accountHolderName ?? selected.userName) : ''}
        fields={buildWithdrawalSheetFields(selected, columns)}
        onClose={() => (actionBusy ? undefined : setSelected(null))}
        actions={selected ? sheetActions(selected) : undefined}
        note={actionBusy ? 'Working…' : undefined}
      />

      <DepositWithdrawalMidModal
        open={midReportOpen}
        row={midReportRow}
        catalogMids={catalogMids}
        onClose={() => {
          setMidReportOpen(false);
          setMidReportRow(null);
        }}
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

      <View style={styles.pagerRow}>
        <TouchableOpacity
          style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerBtnDisabled]}
          disabled={page <= 1 || loading}
          onPress={() => setPage((value) => Math.max(1, value - 1))}
        >
          <Text style={styles.pagerBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerText}>
          Page {page} / {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, (page >= totalPages || loading) && styles.pagerBtnDisabled]}
          disabled={page >= totalPages || loading}
          onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          <Text style={styles.pagerBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      <SheetDownloadOtpModal
        visible={sheetOtp.open}
        filter={sheetOtp.filter}
        onClose={() => setSheetOtp((value) => ({ ...value, open: false }))}
        onVerified={() => sheetAfterOtp.current?.()}
      />
    </ScrollView>
  );
}
