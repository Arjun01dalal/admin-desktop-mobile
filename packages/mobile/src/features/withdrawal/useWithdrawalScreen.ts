/** State, data loading, and filters for the withdrawal screen. Actions live in useWithdrawalActions. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { queryKeys } from '../../api/queryKeys';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import { colors } from '../../theme';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../utils/dates';
import { shareCsvFile } from '../../utils/shareCsv';
import type { SheetDownloadFilter } from '../../utils/sheetDownloadAudit';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../utils/empCodeNameCache';
import {
  fetchWithdrawalList,
  fetchWithdrawalSummary,
} from './fetchWithdrawalList';
import { useWithdrawalActions } from './useWithdrawalActions';
import {
  checkOf,
  display,
  fmtAmount,
  num,
  parseSummary,
  sendToBankName,
  statusColor,
  type Rec,
  type Summary,
} from './helpers';

type WithdrawalNavParams = {
  status?: string;
  startDate?: string;
  endDate?: string;
};

export function useWithdrawalScreen() {
  const route = useRoute<RouteProp<Record<string, WithdrawalNavParams | undefined>, string>>();
  const incoming = route.params;
  const [draftStart, setDraftStart] = useState(incoming?.startDate || todayIST());
  const [draftEnd, setDraftEnd] = useState(incoming?.endDate || todayIST());
  const [startDate, setStartDate] = useState(incoming?.startDate || todayIST());
  const [endDate, setEndDate] = useState(incoming?.endDate || todayIST());
  const [allData, setAllData] = useState(false);
  const [status, setStatus] = useState(incoming?.status || '');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState('userName');
  const [searchDraft, setSearchDraft] = useState('');
  const [applied, setApplied] = useState({ field: 'userName', text: '' });
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  const [sheetOtp, setSheetOtp] = useState<{ open: boolean; filter: SheetDownloadFilter }>({
    open: false,
    filter: { type: 'Withdrawal Sheet' },
  });
  const sheetAfterOtp = useRef<(() => void | Promise<boolean>) | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sortChecked, setSortChecked] = useState(false);
  const [redFlagOnly, setRedFlagOnly] = useState(false);
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [bankAmtDraft, setBankAmtDraft] = useState('');
  const [bankAmt, setBankAmt] = useState('');
  const [midFilter, setMidFilter] = useState('');
  const [midFilterOpen, setMidFilterOpen] = useState(false);
  const [benePendingOpen, setBenePendingOpen] = useState(false);
  const [selectedBeneficiaryAccounts, setSelectedBeneficiaryAccounts] = useState<string[]>([]);
  const [draftBeneficiaryAccounts, setDraftBeneficiaryAccounts] = useState<string[]>([]);
  const draftBeneRef = useRef<string[]>([]);
  draftBeneRef.current = draftBeneficiaryAccounts;
  const [totalBeneListOpen, setTotalBeneListOpen] = useState(false);

  const refreshRef = useRef<() => void>(() => {});
  const actions = useWithdrawalActions({
    onRefresh: () => refreshRef.current(),
  });
  const { admin, perms, mids, beneAccOptions } = actions;

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      status,
      applied,
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      allData,
      sortChecked,
      redFlagOnly,
      uniqueOnly,
      bankAmt,
      midFilter,
      selectedBeneficiaryAccounts,
      showAll: perms.showAll,
      adminName: admin?.name ? String(admin.name) : undefined,
      app: (admin?.clientName || admin?.allotedApps) as string | string[] | undefined,
    }),
    [
      admin?.allotedApps,
      admin?.clientName,
      admin?.name,
      allData,
      applied,
      bankAmt,
      endDate,
      midFilter,
      page,
      pageSize,
      perms.showAll,
      redFlagOnly,
      selectedBeneficiaryAccounts,
      sortChecked,
      startDate,
      status,
      uniqueOnly,
    ],
  );

  const summaryParams = useMemo(
    () => ({
      allData,
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
    }),
    [allData, endDate, startDate],
  );

  const listQuery = useScreenQuery({
    queryKey: queryKeys.withdrawal.list(listParams),
    queryFn: () => fetchWithdrawalList(listParams),
  });

  const summaryQuery = useScreenQuery({
    queryKey: queryKeys.withdrawal.summary(summaryParams),
    queryFn: () => fetchWithdrawalSummary(summaryParams),
  });

  const rows = listQuery.data?.rows ?? [];
  const totalPages = listQuery.data?.totalPages ?? 1;
  const totalUsers = listQuery.data?.totalUsers ?? 0;
  const loading = listQuery.loading || listQuery.refreshing;
  const msg = listQuery.errorMessage ?? '';
  const summary: Summary = useMemo(
    () => (summaryQuery.data != null ? parseSummary(summaryQuery.data) : []),
    [summaryQuery.data],
  );

  const onRefresh = useCallback(() => {
    void listQuery.refresh();
    void summaryQuery.refresh();
  }, [listQuery.refresh, summaryQuery.refresh]);
  refreshRef.current = onRefresh;

  useEffect(() => {
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  const formatEmpCode = useCallback(
    (r: Rec) => {
      const code = String(r.empCode || '').trim();
      const name = code ? empCodeNameMap[code] : '';
      return name ? `${code} (${name})` : display(r.empCode);
    },
    [empCodeNameMap],
  );

  useEffect(() => {
    const hasNav =
      incoming != null &&
      (incoming.status !== undefined || Boolean(incoming.startDate) || Boolean(incoming.endDate));
    if (!hasNav || !incoming) return;
    if (incoming.status !== undefined) setStatus(incoming.status);
    if (incoming.startDate) {
      setDraftStart(incoming.startDate);
      setStartDate(incoming.startDate);
    }
    if (incoming.endDate) {
      setDraftEnd(incoming.endDate);
      setEndDate(incoming.endDate);
    }
    setPage(1);
  }, [incoming?.endDate, incoming?.startDate, incoming?.status]);

  const shareCsv = useCallback(async (fileName: string, headers: string[], data: string[][]) => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...data].map((line) => line.map(esc).join(',')).join('\n');
    return shareCsvFile(`${fileName}-${Date.now()}.csv`, csv);
  }, []);
  const cell = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const downloadData = useCallback(
    () =>
      shareCsv(
        'Withdrawal_Data',
        [
          'Sr No',
          'Date',
          'accountHolderName',
          'Name (send to bank)',
          'bankName',
          'city',
          'state',
          'status',
          'dp_id',
          'transactionId',
          'Acc No',
          'Amount',
          'userBankName',
          'ifscCode',
        ],
        rows.map((r, i) => [
          String(i + 1),
          r.createdOn ? formatDisplayDate(String(r.createdOn)) : '',
          cell(r.accountHolderName),
          cell(r.beneficiaryAccount ?? r.accountHolderName),
          cell(r.bankName),
          cell(r.city),
          cell(r.state),
          cell(r.status),
          cell(r.dp_id),
          cell(r.transactionId),
          cell(r.accountNo),
          cell(r.amount),
          cell(r.userBankName),
          cell(r.ifscCode),
        ]),
      ),
    [rows, shareCsv],
  );
  const downloadPayok = useCallback(
    () =>
      shareCsv(
        'pay_ok_sheet',
        ['Bank Name (IFSC)', 'Bank Account', 'Amount(INR)', 'Phone Number', 'AccountName', 'Email'],
        rows.map((r) => [
          cell(r.ifscCode),
          cell(r.accountNo),
          cell(r.amount),
          cell(r.userMobile ?? r.mobile),
          cell(r.accountHolderName),
          cell(r.email),
        ]),
      ),
    [rows, shareCsv],
  );
  const downloadYesBank = useCallback(
    () =>
      shareCsv(
        'yes_bank_sheet',
        ['Sr No', 'Name', 'Transfer Type', 'Acc No', 'Amount', 'IFSC', 'Phone No', 'Remarks'],
        rows.map((r, i) => [
          String(i + 1),
          cell(r.accountHolderName),
          'NEFT',
          cell(r.accountNo),
          cell(r.amount),
          cell(r.ifscCode),
          cell(r.userMobile ?? r.mobile),
          cell(r.transactionId),
        ]),
      ),
    [rows, shareCsv],
  );

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      {
        key: 'name',
        label: 'User Name',
        width: 130,
        render: (r) => display(r.accountHolderName ?? r.userName ?? r.name),
      },
      {
        key: 'sendToBank',
        label: 'Name (Send to Bank)',
        width: 140,
        render: (r) => display(sendToBankName(r)),
      },
      { key: 'amount', label: 'Amount', width: 90, render: (r) => fmtAmount(r.amount ?? r.Amount) },
      { key: 'empCode', label: 'Emp Code', width: 90, render: formatEmpCode },
      {
        key: 'app',
        label: 'App',
        width: 80,
        render: (r) => display(appCodeForName(String(r.clientName || '')) || r.clientName),
      },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        color: (r) => statusColor(r.status),
        render: (r) => display(r.status),
      },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => (perms.showMobile ? display(r.userMobile ?? r.mobile) : '••••••••'),
      },
      { key: 'state', label: 'State', width: 100, render: (r) => display(r.state) },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      {
        key: 'bank',
        label: 'User Bank',
        width: 120,
        render: (r) => display(r.userBankName ?? r.bankName),
      },
      { key: 'winIn', label: 'Win In', width: 80, render: (r) => display(r.playedGames) },
      {
        key: 'txn',
        label: 'Transaction Id',
        width: 150,
        render: (r) => display(r.orderId ?? r.transactionId),
      },
      { key: 'dp', label: 'DP Id', width: 120, render: (r) => display(r.dp_id) },
      { key: 'accountNo', label: 'Account No', width: 130, render: (r) => display(r.accountNo) },
      { key: 'ifsc', label: 'IFSC', width: 110, render: (r) => display(r.ifscCode ?? r.ifsc) },
      {
        key: 'commission',
        label: 'Commission',
        width: 90,
        render: (r) => fmtAmount(r.commissionAmount),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: 120,
        render: (r) =>
          String(r.status || '').toLowerCase() === 'approved'
            ? display(r.withdrewalProviderName ?? r.paymentGatewayName)
            : '—',
      },
      {
        key: 'mid',
        label: 'MID',
        width: 100,
        render: (r) => (String(r.status || '').toLowerCase() === 'approved' ? display(r.mid) : '—'),
      },
      {
        key: 'checkBot',
        label: 'Check By Bot',
        width: 100,
        render: (r) =>
          r.validationCheckedAt ? `${num(r.passedPoints)}/${num(r.totalPoints)}` : '—',
        color: (r) =>
          r.validationCheckedAt
            ? Number(r.passedPoints) >= 13
              ? colors.success
              : colors.destructive
            : undefined,
      },
      {
        key: 'lockBy',
        label: 'Lock By',
        width: 110,
        render: (r) => {
          const l = r.lockBy as Rec | undefined;
          return l && typeof l === 'object' ? display(l.name) : display(l);
        },
      },
      {
        key: 'crossCheckBy',
        label: 'Cross Check By',
        width: 130,
        render: (r) => {
          const c = checkOf(r, 'crossCheckBy');
          return c
            ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}`
            : '—';
        },
      },
      {
        key: 'updatedBy',
        label: 'Updated By',
        width: 130,
        render: (r) => {
          const a = r.action as Rec | undefined;
          return a && typeof a === 'object'
            ? `${display(a.status)} · ${display(a.name)}`
            : display(a);
        },
      },
      { key: 'pnlBefore', label: 'PnL Before', width: 100, render: (r) => display(r.pnl) },
      {
        key: 'pnlAfter',
        label: 'PnL After',
        width: 100,
        render: (r) => display(r.afterWithdrawalPnl),
      },
      {
        key: 'date',
        label: 'Date',
        width: 100,
        render: (r) => (r.createdOn ? formatDisplayDate(String(r.createdOn)) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayTime(String(r.createdOn)) : '—'),
      },
    ],
    [formatEmpCode, perms.showMobile],
  );

  const requestSheetDownload = useCallback(
    (filter: SheetDownloadFilter, run: () => void | Promise<boolean>) => {
      sheetAfterOtp.current = run;
      setSheetOtp({ open: true, filter });
    },
    [],
  );
  const setStatusFilter = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  const applyAllData = useCallback(() => {
    setDraftStart('');
    setDraftEnd('');
    setStartDate('');
    setEndDate('');
    setAllData(true);
    setPage(1);
  }, []);

  const clearDates = useCallback(() => {
    setDraftStart('');
    setDraftEnd('');
    setAllData(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    const today = todayIST();
    setDraftStart(today);
    setDraftEnd(today);
    setStartDate(today);
    setEndDate(today);
    setAllData(false);
    setStatus('');
    setSearchField('userName');
    setSearchDraft('');
    setApplied({ field: 'userName', text: '' });
    setSortChecked(false);
    setRedFlagOnly(false);
    setUniqueOnly(false);
    setBankAmtDraft('');
    setBankAmt('');
    setMidFilter('');
    setMidFilterOpen(false);
    setSelectedBeneficiaryAccounts([]);
    setDraftBeneficiaryAccounts([]);
    setBenePendingOpen(false);
    setPageSize(25);
    setPage(1);
    actions.clearBulk();
  }, [actions.clearBulk]);

  const setStartDateAndExitAllData = useCallback((value: string) => {
    setAllData(false);
    setStartDate(value);
  }, []);

  const setEndDateAndExitAllData = useCallback((value: string) => {
    setAllData(false);
    setEndDate(value);
  }, []);

  const openBenePendingPanel = useCallback(() => {
    setDraftBeneficiaryAccounts(selectedBeneficiaryAccounts);
    setBenePendingOpen(true);
  }, [selectedBeneficiaryAccounts]);

  const applyBenePendingPanel = useCallback(() => {
    const next = draftBeneRef.current;
    setSelectedBeneficiaryAccounts(next);
    if (next.length > 0) {
      setStatus('Pending');
    }
    setBenePendingOpen(false);
    setPage(1);
  }, []);

  const toggleBenePendingPanel = useCallback(() => {
    if (benePendingOpen) {
      applyBenePendingPanel();
    } else {
      openBenePendingPanel();
    }
  }, [applyBenePendingPanel, benePendingOpen, openBenePendingPanel]);

  return {
    ...actions,
    rows,
    summary,
    loading,
    msg,
    columns,
    selectedBeneficiaryAccounts,
    draftBeneficiaryAccounts,
    setDraftBeneficiaryAccounts,
    benePendingOpen,
    setBenePendingOpen,
    toggleBenePendingPanel,
    applyBenePendingPanel,
    totalBeneListOpen,
    setTotalBeneListOpen,
    toolsOpen,
    setToolsOpen,
    sortChecked,
    setSortChecked,
    redFlagOnly,
    setRedFlagOnly,
    uniqueOnly,
    setUniqueOnly,
    bankAmtDraft,
    setBankAmtDraft,
    bankAmt,
    setBankAmt,
    midFilter,
    setMidFilter,
    midFilterOpen,
    setMidFilterOpen,
    downloadData,
    downloadPayok,
    downloadYesBank,
    draftStart,
    draftEnd,
    setDraftStart,
    setDraftEnd,
    setStartDate: setStartDateAndExitAllData,
    setEndDate: setEndDateAndExitAllData,
    applyAllData,
    clearDates,
    clearAllFilters,
    setPage,
    pageSize,
    setPageSize,
    searchField,
    setSearchField,
    searchDraft,
    setSearchDraft,
    setApplied,
    status,
    setStatus: setStatusFilter,
    requestSheetDownload,
    totalPages,
    totalUsers,
    page,
    sheetOtp,
    setSheetOtp,
    sheetAfterOtp,
    refresh: onRefresh,
    mids,
    beneAccOptions,
  };
}
