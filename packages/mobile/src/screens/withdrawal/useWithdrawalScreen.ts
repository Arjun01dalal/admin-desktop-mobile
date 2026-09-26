/** State, data loading, and filters for the withdrawal screen. Actions live in useWithdrawalActions. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../../api/client';
import { colors } from '../../theme';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../utils/dates';
import { shareCsvFile } from '../../utils/shareCsv';
import type { SheetDownloadFilter } from '../../utils/sheetDownloadAudit';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../utils/empCodeNameCache';
import { useWithdrawalActions } from './useWithdrawalActions';
import {
  checkOf,
  display,
  fmtAmount,
  listOf,
  num,
  pagesOf,
  parseSummary,
  statusColor,
  totalUsersOf,
  type Rec,
  type Summary,
} from './helpers';

export function useWithdrawalScreen() {
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState('userName');
  const [searchDraft, setSearchDraft] = useState('');
  const [applied, setApplied] = useState({ field: 'userName', text: '' });
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary>([]);
  const [msg, setMsg] = useState('');
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

  const loadRef = useRef<() => void>(() => {});
  const loadSummaryRef = useRef<() => void>(() => {});
  const onRefresh = useCallback(() => {
    loadRef.current();
    loadSummaryRef.current();
  }, []);

  const actions = useWithdrawalActions({ onRefresh });
  const { admin, perms, mids, beneAccOptions } = actions;

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

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const filter: Rec = {};
      if (selectedBeneficiaryAccounts.length > 0) {
        filter.beneficiaryAccounts = selectedBeneficiaryAccounts;
        filter.status = 'Pending';
      } else if (status) {
        filter.status = status;
      }
      const effectiveStatus =
        selectedBeneficiaryAccounts.length > 0 ? 'Pending' : status;
      if (effectiveStatus === 'IN PROGRESS' && !perms.showAll && admin?.name) {
        filter.name = admin.name;
      }
      if (applied.text.trim()) filter[applied.field] = applied.text.trim();
      if (sortChecked) filter.sort = true;
      if (bankAmt.trim()) filter.bankAmt = bankAmt.trim();
      if (midFilter) filter.mid = midFilter;
      const payload: Rec = {
        type: 'withdrawal',
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
        startDate,
        endDate,
      };
      const app = admin?.clientName || admin?.allotedApps;
      if (app) payload.app = app;
      const res = await secureApi('withdrawals.transactions', payload);
      if (!res.ok) {
        setMsg(res.message || 'Failed to load refunds');
        setRows([]);
        setTotalPages(1);
        setTotalUsers(0);
        return;
      }
      setRows(listOf(res.data));
      setTotalPages(pagesOf(res.data));
      setTotalUsers(totalUsersOf(res.data));
    } finally {
      setLoading(false);
    }
  }, [
    admin,
    status,
    applied,
    pageSize,
    page,
    startDate,
    endDate,
    perms.showAll,
    sortChecked,
    bankAmt,
    midFilter,
    selectedBeneficiaryAccounts,
  ]);

  const loadSummary = useCallback(async () => {
    const res = await secureApi('withdrawals.fundRequest', { startDate, endDate });
    if (res.ok) setSummary(parseSummary(res.data));
  }, [startDate, endDate]);

  loadRef.current = () => {
    void load();
  };
  loadSummaryRef.current = () => {
    void loadSummary();
  };

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadSummary();
    }, [load, loadSummary]),
  );

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
        key: 'checkBy',
        label: 'Check By',
        width: 120,
        render: (r) => {
          const c = checkOf(r, 'checkBy');
          return c
            ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}`
            : '—';
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
  const refresh = useCallback(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

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
    setStatus: setStatusFilter,
    requestSheetDownload,
    totalPages,
    totalUsers,
    page,
    sheetOtp,
    setSheetOtp,
    sheetAfterOtp,
    refresh,
    mids,
    beneAccOptions,
  };
}
