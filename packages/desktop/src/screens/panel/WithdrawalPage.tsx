import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { useLocationController } from '@/controllers/LocationProvider';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { copyToClipboard } from '@/utils/clipboard';
import { asPaged, asList, display, useReportQuery } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import type { UserRow } from '@/screens/panel/users/utils';
import {
  orangeBtnSx,
  actionBtnSx,
  fieldSx,
  filterSelectSx,
  toolbarBoxSx,
  chipSx,
  WITHDRAWAL_STATUSES,
  PAGE_SIZE_OPTIONS,
  type MidOption,
  unpackPayload,
} from '@/screens/panel/transactions/shared';
import {
  type WithdrawalRow,
  type ColumnFilters,
  type QueryState,
  type ValidationItem,
  type WithdrawalSummary,
  EMPTY_FILTERS,
  WIN_IN_OPTIONS,
  DELAY_REASONS,
  MANUAL_GATEWAYS,
  asWithdrawalSummary,
  emptyWithdrawalSummary,
  withdrawalStatLabel,
} from '@/screens/panel/withdrawal/types';
import {
  orderIdOf,
  midLabel,
  extractBeneficiaryAccounts,
  sendToBankName,
  displayUserName,
  bothChecksOk,
  canLockRow,
  canUnlockRow,
  canShowApproveAction,
  canRejectRow,
  isTerminal,
  pendingAgeColor,
  withdrawalRowBg,
  maskAccount,
  maskIfsc,
} from '@/screens/panel/withdrawal/logic';
import { requireWithdrawalGeo } from '@/screens/panel/withdrawal/geo';
import { ActionDialog } from '@/screens/panel/withdrawal/ActionDialog';
import { BotValidationModal } from '@/screens/panel/withdrawal/BotValidationModal';
import { AddBeneDialog } from '@/screens/panel/withdrawal/AddBeneDialog';
import { QrApproveDialog } from '@/screens/panel/withdrawal/QrApproveDialog';
import { BeneListDialog } from '@/screens/panel/withdrawal/BeneListDialog';
import { BeneficiarySelect } from '@/screens/panel/withdrawal/BeneficiarySelect';

const CLIENT_NAME_OPTIONS = ['', ...CLIENT_NAMES];
const STATE_OPTIONS = ['', ...INDIA_STATES];

function personCell(text: string, date?: string) {
  return (
    <Typography variant="body2" sx={{ fontSize: 12 }}>
      {text}
      <br />
      {formatDisplayDate(date)} {formatDisplayTime(date)}
    </Typography>
  );
}

function Copyable({ value, masked }: { value?: string; masked: string }) {
  if (!value) return <>—</>;
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
      <Typography variant="body2" sx={{ fontSize: 12 }}>
        {masked}
      </Typography>
      <IconButton
        size="small"
        aria-label="copy"
        onClick={() => void copyToClipboard(value)}
        sx={{ color: '#ff9f0a', p: 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Stack>
  );
}

/** Withdrawal — CommonTable UI + old panel action contracts (check/lock/status/bulk/bene). */
export function WithdrawalPage() {
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    mobile?: string;
    allotedApps?: string | string[];
    clientName?: string | string[];
  }>();
  const loc = useLocationController();

  const canAct = hasPermission('withdrawals_button');
  const canReject = hasPermission('View_Reject') || canAct;
  const canReverse = hasPermission('View_Reverse') || canAct;
  const canDownload =
    hasPermission('Download_Withdrawal') || hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canDelay = hasPermission('View_Delay_Reason');
  const hideCheck = hasPermission('Disable_Withdrawals_Check');
  const showAllInProgress = hasPermission('show_all_withdrawal');
  const hideContact = hasPermission('contact_visibility_none');
  const today = todayIST();

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    allData: false,
    filters: EMPTY_FILTERS,
  });

  const [mids, setMids] = useState<MidOption[]>([]);
  const [gateways, setGateways] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [summary, setSummary] = useState<WithdrawalSummary>(emptyWithdrawalSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<WithdrawalRow | null>(null);
  const [actionStatus, setActionStatus] = useState('Approved');
  const [actionRemark, setActionRemark] = useState('');
  const [actionMid, setActionMid] = useState('');
  const [actionGateway, setActionGateway] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  const [botOpen, setBotOpen] = useState(false);
  const [botItems, setBotItems] = useState<ValidationItem[]>([]);

  const [beneOpen, setBeneOpen] = useState(false);
  const [beneRow, setBeneRow] = useState<WithdrawalRow | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrRow, setQrRow] = useState<WithdrawalRow | null>(null);
  const [qrGateway, setQrGateway] = useState('');
  const [qrMid, setQrMid] = useState('');
  const [qrSaving, setQrSaving] = useState(false);

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    const f = query.filters;
    if (f.userName.trim()) filter.userName = f.userName.trim();
    if (f.mobile.trim()) filter.mobile = f.mobile.trim();
    if (f.amount.trim()) filter.amount = f.amount.trim();
    if (f.status) filter.status = f.status;
    if (f.clientName) filter.clientName = f.clientName;
    if (f.state) filter.state = f.state;
    if (f.city.trim()) filter.city = f.city.trim();
    if (f.transactionId.trim()) filter.transactionId = f.transactionId.trim();
    if (f.dp_id.trim()) filter.dp_id = f.dp_id.trim();
    if (f.accountNo.trim()) filter.accountNo = f.accountNo.trim();
    if (f.ifscCode.trim()) filter.ifscCode = f.ifscCode.trim();
    if (f.mid) filter.mid = f.mid;
    if (f.playedGames) filter.playedGames = f.playedGames;

    // IN PROGRESS isolation — old: without show_all_withdrawal, filter by lock name
    if (f.status === 'IN PROGRESS' && !showAllInProgress && admin?.name) {
      filter.name = admin.name;
    }

    const payload: Record<string, unknown> = {
      type: 'withdrawal',
      itemsPerPage,
      pageNo: page,
      filter,
    };
    if (!query.allData) {
      if (query.startDate) payload.startDate = query.startDate;
      if (query.endDate) payload.endDate = query.endDate;
    }
    const apps = admin?.clientName || admin?.allotedApps;
    if (apps) payload.app = apps;
    return payload;
  }, [query, page, itemsPerPage, showAllInProgress, admin?.name, admin?.clientName, admin?.allotedApps]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<WithdrawalRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<WithdrawalRow>({
    action: 'withdrawals.transactions',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, query],
    errorMessage: 'Failed to load withdrawals',
    cacheTtlMs: 0,
  });

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (!query.allData) {
        payload.startDate = query.startDate || todayIST();
        payload.endDate = query.endDate || todayIST();
      }
      const res = await secureApi('withdrawals.fundRequest', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load withdrawal summary');
        return;
      }
      // secureApi unwraps to payload; old panel reads payload.WithdrawalData
      // which uses flat totalApprovedCount / totalApprovedAmount (not nested buckets)
      setSummary(asWithdrawalSummary(res.data));
    } finally {
      setSummaryLoading(false);
    }
  }, [query.allData, query.startDate, query.endDate]);

  const loadLookups = useCallback(async () => {
    const [midRes, gwRes, bankRes] = await Promise.all([
      secureApi('withdrawals.mids', {}),
      secureApi('withdrawals.payoutAccounts', {}),
      secureApi('withdrawals.availableBanks', {}),
    ]);
    if (midRes.ok) setMids(asList<MidOption>(midRes.data));
    if (gwRes.ok) {
      const list = asList<{ name?: string }>(gwRes.data);
      setGateways(
        Array.from(new Set(list.map((g) => g?.name).filter((n): n is string => Boolean(n)))),
      );
    }
    if (bankRes.ok) {
      const body = unpackPayload(bankRes.data);
      const raw =
        (Array.isArray(body.availableBanks) && body.availableBanks) ||
        (Array.isArray(body.banks) && body.banks) ||
        (Array.isArray(body.items) && body.items) ||
        (Array.isArray(bankRes.data) && bankRes.data) ||
        [];
      setAvailableBanks(
        (raw as unknown[])
          .map((b) => (typeof b === 'string' ? b : String((b as { name?: string })?.name || '')))
          .filter(Boolean),
      );
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setSelectedIds([]);
  }, [rows]);

  const commitQuery = useCallback(
    (opts?: { allData?: boolean; filters?: ColumnFilters }) => {
      const nextAllData = opts?.allData ?? false;
      setQuery({
        startDate: nextAllData ? '' : startDate,
        endDate: nextAllData ? '' : endDate,
        allData: nextAllData,
        filters: opts?.filters ?? draft,
      });
      setPage(1);
    },
    [startDate, endDate, draft],
  );

  const clearAll = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setDraft(EMPTY_FILTERS);
    setQuery({ startDate: '', endDate: '', allData: false, filters: EMPTY_FILTERS });
    setPage(1);
  }, []);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const onDraftChange = useCallback(
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value),
    [setDraftField],
  );

  const onDraftSelect = useCallback(
    (key: keyof ColumnFilters) => (value: string) => {
      setDraftField(key)(value);
      commitQuery({ filters: { ...draft, [key]: value } });
    },
    [draft, setDraftField, commitQuery],
  );

  const refreshAll = useCallback(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  const markChecked = useCallback(
    async (row: WithdrawalRow, check: 'first' | 'second', ok: boolean) => {
      const orderId = orderIdOf(row);
      if (!orderId) {
        toast.error('Missing transaction id');
        return;
      }
      const geo = await requireWithdrawalGeo(loc);
      if (!geo) return;

      setBusyId(`${orderId}-${check}`);
      try {
        const res = await secureApi('withdrawals.check', {
          transactionId: orderId,
          check,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?._id || '',
            status: String(ok),
            city: geo.city,
            state: geo.state,
            lat: geo.lat,
            long: geo.long,
          },
        });
        if (!res.ok) {
          toast.error(res.message || 'Check failed');
          return;
        }
        toast.success(res.message || 'Updated');
        void load();
      } finally {
        setBusyId('');
      }
    },
    [admin, loc, load],
  );

  const handleLock = useCallback(
    async (row: WithdrawalRow) => {
      const orderId = orderIdOf(row);
      if (!orderId) {
        toast.error('Missing transaction id');
        return;
      }
      if (!bothChecksOk(row)) {
        toast.warn('Both checks must be OK before lock');
        return;
      }
      const geo = await requireWithdrawalGeo(loc);
      if (!geo) return;

      setBusyId(orderId);
      try {
        const res = await secureApi('withdrawals.lock', {
          transactionId: orderId,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?._id || '',
            status: 'true',
            date: new Date().toISOString(),
            city: geo.city,
            state: geo.state,
            lat: geo.lat,
            long: geo.long,
          },
        });
        if (!res.ok) {
          toast.error(res.message || 'Lock failed');
          return;
        }
        toast.success(res.message || 'Locked');
        void load();
      } finally {
        setBusyId('');
      }
    },
    [admin, loc, load],
  );

  const handleUnlock = useCallback(
    async (row: WithdrawalRow) => {
      const orderId = orderIdOf(row);
      if (!orderId) {
        toast.error('Missing transaction id');
        return;
      }
      setBusyId(orderId);
      try {
        const res = await secureApi('withdrawals.unlock', { transactionId: orderId });
        if (!res.ok) {
          toast.error(res.message || 'Unlock failed');
          return;
        }
        toast.success(res.message || 'Unlocked');
        void load();
      } finally {
        setBusyId('');
      }
    },
    [load],
  );

  const openAction = useCallback((row: WithdrawalRow, status: string) => {
    setActionTarget(row);
    setActionStatus(status);
    setActionRemark(status === 'Approved' ? 'Approved' : '');
    setActionMid('');
    setActionGateway('');
    setActionOpen(true);
  }, []);

  const openQrApprove = useCallback((row: WithdrawalRow) => {
    if (!row.upiId) {
      toast.warn('No UPI ID on this withdrawal');
      return;
    }
    setQrRow(row);
    setQrGateway('');
    setQrMid('');
    setQrOpen(true);
  }, []);

  const submitQrApprove = useCallback(async () => {
    if (!qrRow) return;
    const orderId = orderIdOf(qrRow);
    if (!orderId) {
      toast.error('Missing transaction id');
      return;
    }
    if (!qrGateway || !qrMid) {
      toast.error('Gateway and Mid are required');
      return;
    }
    const geo = await requireWithdrawalGeo(loc);
    if (!geo) return;

    setQrSaving(true);
    try {
      const res = await secureApi('withdrawals.statusUpdate', {
        transactionId: orderId,
        reason: 'By UPI ID',
        dp_id: qrRow.dp_id,
        withdrewalProviderName: qrGateway,
        gatewayName: qrGateway,
        mid: qrMid,
        updatedBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
          status: 'Approved',
          city: geo.city,
          state: geo.state,
          lat: geo.lat,
          long: geo.long,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'QR approve failed');
        return;
      }
      toast.success(res.message || 'Approved via QR');
      setQrOpen(false);
      setQrRow(null);
      void load();
      void loadSummary();
    } finally {
      setQrSaving(false);
    }
  }, [qrRow, qrGateway, qrMid, admin, loc, load, loadSummary]);

  const submitAction = useCallback(async () => {
    if (!actionTarget) return;
    const orderId = orderIdOf(actionTarget);
    if (!orderId) {
      toast.error('Missing transaction id');
      return;
    }
    const needsGatewayMid = !['Approved', 'Reverse', 'on hold'].includes(actionStatus);
    if (needsGatewayMid && (!actionGateway || !actionMid)) {
      toast.error('Gateway and Mid are required');
      return;
    }
    if (actionStatus !== 'Approved' && !actionRemark.trim()) {
      toast.error('Remark is required');
      return;
    }

    const geo = await requireWithdrawalGeo(loc);
    if (!geo) return;

    setActionSaving(true);
    try {
      const payload: Record<string, unknown> = {
        transactionId: orderId,
        reason: actionStatus === 'Approved' ? 'Approved' : actionRemark.trim(),
        dp_id: actionTarget.dp_id,
        updatedBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
          status: actionStatus,
          city: geo.city,
          state: geo.state,
          lat: geo.lat,
          long: geo.long,
        },
      };
      if (actionStatus === 'Manual Approved' || actionGateway) {
        payload.withdrewalProviderName = actionGateway;
      }
      if (actionMid) payload.mid = actionMid;
      if (actionGateway) payload.gatewayName = actionGateway;

      const res = await secureApi('withdrawals.statusUpdate', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      toast.success(res.message || 'Status updated');
      setActionOpen(false);
      setActionTarget(null);
      void load();
      void loadSummary();
    } finally {
      setActionSaving(false);
    }
  }, [
    actionTarget,
    actionRemark,
    actionStatus,
    actionMid,
    actionGateway,
    admin,
    loc,
    load,
    loadSummary,
  ]);

  const setDelayReason = useCallback(
    async (row: WithdrawalRow, reason: string) => {
      const orderId = orderIdOf(row);
      if (!orderId || !reason) return;
      const res = await secureApi('withdrawals.delayReason', {
        transactionId: orderId,
        delayReason: {
          name: admin?.name || '',
          userId: admin?._id || '',
          reason,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to set delay reason');
        return;
      }
      toast.success('Delay reason saved');
      void load();
    },
    [admin, load],
  );

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkManualOpen, setBulkManualOpen] = useState(false);
  const [bulkManualGateway, setBulkManualGateway] = useState('');
  const [bulkManualMid, setBulkManualMid] = useState('');
  const [beneListOpen, setBeneListOpen] = useState(false);

  const toggleSelect = useCallback((orderId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(orderId) ? prev : [...prev, orderId];
      return prev.filter((id) => id !== orderId);
    });
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(orderIdOf(r))),
    [rows, selectedIds],
  );

  const runBulk = useCallback(
    async (
      action:
        | 'withdrawals.bulkLock'
        | 'withdrawals.bulkUnlock'
        | 'withdrawals.bulkApprove'
        | 'withdrawals.bulkManualApprove',
      extra?: Record<string, unknown>,
    ) => {
      if (!selectedIds.length) {
        toast.warn('Select at least one row using the checkboxes');
        return;
      }

      const needsGeo =
        action === 'withdrawals.bulkLock' ||
        action === 'withdrawals.bulkApprove' ||
        action === 'withdrawals.bulkManualApprove';
      let geo: Awaited<ReturnType<typeof requireWithdrawalGeo>> = null;
      if (needsGeo) {
        geo = await requireWithdrawalGeo(loc);
        if (!geo) return;
      }

      // Old API expects `transactionId` (not transactionIds) — shape varies by action
      let payload: Record<string, unknown> = {};

      if (action === 'withdrawals.bulkLock') {
        payload = {
          transactionId: selectedIds,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?._id || '',
            status: 'true',
            date: new Date().toISOString(),
            city: geo?.city,
            state: geo?.state,
            lat: geo?.lat,
            long: geo?.long,
          },
        };
      } else if (action === 'withdrawals.bulkUnlock') {
        payload = { transactionId: selectedIds };
      } else if (action === 'withdrawals.bulkApprove') {
        const provider =
          (extra?.withdrewalProviderName as string) || gateways[0] || '';
        if (!provider) {
          toast.warn('No payout gateway available for bulk approve');
          return;
        }
        payload = {
          transactionId: selectedRows.map((r) => ({
            transactionId: orderIdOf(r),
            updatedBy: {
              name: admin?.name || '',
              status: 'Approved',
            },
          })),
          withdrewalProviderName: provider,
          state: geo?.state,
          city: geo?.city,
          lat: geo?.lat,
          long: geo?.long,
        };
      } else {
        const gateway = String(extra?.gatewayName || '');
        const mid = String(extra?.mid || '');
        if (!gateway || !mid) {
          toast.warn('Gateway and Mid are required for bulk manual approve');
          return;
        }
        payload = {
          state: geo?.state,
          city: geo?.city,
          lat: geo?.lat,
          long: geo?.long,
          gatewayName: gateway,
          mid,
          transactionId: selectedRows.map((r) => ({
            transactionId: orderIdOf(r),
            name: admin?.name || '',
            _id: admin?._id || '',
          })),
        };
      }

      setBulkBusy(true);
      try {
        const res = await secureApi(action, payload);
        if (!res.ok) {
          toast.error(res.message || 'Bulk action failed');
          return;
        }
        toast.success(
          res.message ||
            (action === 'withdrawals.bulkLock'
              ? 'Bulk Lock successfully'
              : action === 'withdrawals.bulkUnlock'
                ? 'Bulk Unlock successfully'
                : action === 'withdrawals.bulkApprove'
                  ? 'Bulk Approved successfully'
                  : 'Bulk Manual Approve successfully'),
        );
        setSelectedIds([]);
        setBulkManualOpen(false);
        void load();
        void loadSummary();
      } finally {
        setBulkBusy(false);
      }
    },
    [
      selectedIds,
      selectedRows,
      loc,
      admin,
      gateways,
      load,
      loadSummary,
    ],
  );

  const downloadExcel = useCallback(() => {
    if (!rows.length) {
      toast.warn('No data to export!');
      return;
    }
    const data = rows.map((row, index) => ({
      'Sr No': index + 1,
      Date: row.createdOn ? formatDisplayDate(row.createdOn) : '',
      accountHolderName: displayUserName(row),
      'Name (send to bank)': sendToBankName(row),
      bankName: row.bankName || '',
      city: row.city || '',
      state: row.state || '',
      status: row.status || '',
      dp_id: row.dp_id || '',
      transactionId: orderIdOf(row),
      'Acc No': row.accountNo || '',
      Amount: row.amount ?? '',
      userBankName: row.userBankName || '',
      ifscCode: row.ifscCode || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Withdrawal Data');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Withdrawal_Data_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const downloadYesBank = useCallback(() => {
    if (!rows.length) {
      toast.warn('No data to export!');
      return;
    }
    const data = rows.map((row, index) => ({
      'Sr No': index + 1,
      Name: displayUserName(row),
      'Transfer Type': 'IMPS',
      'Acc No': row.accountNo || '',
      Amount: row.amount ?? '',
      IFSC: row.ifscCode || '',
      'Phone No': row.userMobile || row.mobile || '',
      Remarks: 'payment',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Yes Bank');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yes_bank_sheet_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const downloadPayOk = useCallback(() => {
    if (!rows.length) {
      toast.warn('No data to export!');
      return;
    }
    const data = rows.map((row) => ({
      'Bank Name (IFSC)': row.ifscCode || '',
      'Bank Account': row.accountNo || '',
      'Amount(INR)': row.amount ?? '',
      'Phone Number': row.userMobile || row.mobile || '',
      AccountName: row.userBankName || '',
      Email: '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pay OK');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pay_ok_sheet_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const toCallingItem = useCallback(
    (row: WithdrawalRow): UserRow => ({
      _id: row._id || row.userId || '',
      name: row.accountHolderName || row.userName,
      userName: row.accountHolderName || row.userName,
      mobile: row.userMobile || row.mobile,
      userMobile: row.userMobile || row.mobile,
      clientName: row.clientName,
      state: row.state,
      city: row.city,
    }),
    [],
  );

  const openWhatsApp = useCallback((row: WithdrawalRow) => {
    const rawMobile = row.userMobile || row.mobile;
    if (!rawMobile) return;
    let formatted = String(rawMobile).replace(/\D/g, '');
    if (formatted.length === 10) formatted = `91${formatted}`;
    const state = row.state || '';
    const stateWiseMsg =
      state === 'Karnataka'
        ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nನೀವು ಹಿಂಪಡೆಯಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರುವಿರಿ ಎಂದು ಕಾಣುತ್ತದೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`
        : ['Telangana', 'Andhra Pradesh'].includes(state)
          ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nమీరు విత్‌డ్రా చేయడానికి ప్రయత్నిస్తున్నారని నేను చూస్తున్నాను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?`
          : ['Tamil Nadu', 'Tiruchirappalli'].includes(state)
            ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nநீங்கள் திரும்பப் பெற முயற்சிக்கிறீர்கள் என்று பார்க்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
            : `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nI see you're trying to make a withdrawal. How can I assist you today?`;
    const message = stateWiseMsg.replace(
      '{USER_NAME}',
      (row.accountHolderName || row.userName || '').split(' ')[0] || '',
    );
    const encodedMessage = encodeURIComponent(message);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${formatted}&text=${encodedMessage}`;
    } else {
      window.open(`https://wa.me/${formatted}?text=${encodedMessage}`, '_blank');
    }
  }, []);

  const searchFilter = useCallback(
    (key: keyof ColumnFilters, placeholder: string) => (
      <TableSearchBar
        value={draft[key]}
        onChange={onDraftChange(key)}
        onSearch={() => commitQuery()}
        placeholder={placeholder}
      />
    ),
    [draft, onDraftChange, commitQuery],
  );

  const selectFilter = useCallback(
    (key: keyof ColumnFilters, options: readonly string[], labelFor?: (v: string) => string) => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft[key]}
        onChange={(e) => onDraftSelect(key)(e.target.value)}
        sx={filterSelectSx}
      >
        {options.map((o) => (
          <MenuItem key={o || 'all'} value={o}>
            {labelFor ? labelFor(o) : o || 'All'}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft, onDraftSelect],
  );

  const midSelect = useMemo(
    () => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft.mid}
        onChange={(e) => onDraftSelect('mid')(e.target.value)}
        sx={filterSelectSx}
      >
        <MenuItem value="">All</MenuItem>
        {mids.map((m, i) => (
          <MenuItem key={`${m.mid ?? ''}-${i}`} value={String(m.mid ?? '')}>
            {midLabel(m)}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft.mid, mids, onDraftSelect],
  );

  const renderCheckCell = useCallback(
    (row: WithdrawalRow, kind: 'first' | 'second') => {
      const person = kind === 'first' ? row.checkBy : row.crossCheckBy;
      const orderId = orderIdOf(row);
      const busy = busyId === `${orderId}-${kind}`;
      const blocked =
        isTerminal(row) || (kind === 'second' && !row.checkBy?.status);

      if (person?.name) {
        return personCell(
          `${person.status ? 'OK' : 'Not OK'} by ${person.name}`,
          person.date,
        );
      }
      if (hideCheck || blocked) return '—';

      return (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          <IconButton
            size="small"
            disabled={busy}
            onClick={() => void markChecked(row, kind, true)}
            sx={{ color: '#66bb6a' }}
            aria-label="OK"
          >
            <CheckCircleOutlineIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            disabled={busy}
            onClick={() => void markChecked(row, kind, false)}
            sx={{ color: '#ef5350' }}
            aria-label="Not OK"
          >
            <HighlightOffIcon fontSize="small" />
          </IconButton>
        </Stack>
      );
    },
    [busyId, hideCheck, markChecked],
  );

  const columns = useMemo<CommonTableColumn<WithdrawalRow>[]>(() => {
    const showActionsCol = canAct || canReject || canReverse;

    const cols: CommonTableColumn<WithdrawalRow>[] = [
      {
        id: 'select',
        label: '#',
        width: 64,
        stickyLeft: true,
        render: (row, index) => {
          const id = orderIdOf(row);
          const status = String(row.status || '');
          // No bulk checkbox for terminal rows (Approved / Cancel / etc.)
          const showBulkCheckbox =
            canAct &&
            Boolean(id) &&
            status !== 'Approved' &&
            status !== 'Cancel' &&
            status !== 'Rejected' &&
            status !== 'Reverse' &&
            status !== 'Failed';
          return (
            <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
              {showBulkCheckbox ? (
                <Checkbox
                  size="small"
                  checked={selectedIds.includes(id)}
                  onChange={(e) => toggleSelect(id, e.target.checked)}
                  sx={{ color: '#ff9f0a', p: 0.25 }}
                />
              ) : null}
              <span>{(page - 1) * itemsPerPage + index + 1}</span>
            </Stack>
          );
        },
      },
      {
        id: 'userName',
        label: 'User Name',
        width: 140,
        stickyLeft: true,
        filter: searchFilter('userName', 'User name'),
        render: (row) => displayUserName(row),
      },
      {
        id: 'sendToBank',
        label: 'Name (Send to Bank)',
        width: 140,
        stickyLeft: true,
        render: (row) => sendToBankName(row),
      },
      ...(!hideContact
        ? [
            {
              id: 'mobile',
              label: 'Mobile',
              width: 180,
              filter: searchFilter('mobile', 'Mobile'),
              render: (row: WithdrawalRow) => (
                <CallingBtn
                  item={toCallingItem(row)}
                  campaignName="WITHDRAWAL ALL APP"
                  reasonList="Withdrawal"
                />
              ),
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      ...(canWhatsApp
        ? [
            {
              id: 'whatsapp',
              label: 'WhatsApp',
              width: 72,
              render: (row: WithdrawalRow) =>
                String(row.status || '').toLowerCase() === 'pending' ? (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => openWhatsApp(row)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      p: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      lineHeight: 0,
                    }}
                    aria-label="Open WhatsApp"
                  >
                    <Box
                      component="img"
                      src="https://img.icons8.com/?size=1200&id=16713&format=jpg"
                      alt="WhatsApp"
                      sx={{ width: 36, height: 36, borderRadius: 1 }}
                    />
                  </Box>
                ) : (
                  '—'
                ),
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      {
        id: 'clientName',
        label: 'App Name',
        filter: selectFilter('clientName', CLIENT_NAME_OPTIONS, (v) =>
          v ? appCodeForName(v) : 'All',
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 100,
        filter: searchFilter('amount', 'Amount'),
        render: (row) => {
          const raw = row.amount ?? (row as { Amount?: number | string }).Amount;
          return (
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff9f0a' }}>
              {formatAmount(raw ?? 0)}
            </Typography>
          );
        },
      },
      {
        id: 'beneficiary',
        label: 'Beneficiary Acc',
        width: 175,
        cellSx: {
          maxWidth: 175,
          overflow: 'hidden',
          whiteSpace: 'normal',
          verticalAlign: 'middle',
        },
        render: (row) => {
          const list = extractBeneficiaryAccounts(row);
          return (
            <Stack spacing={0.75} alignItems="stretch" sx={{ width: '100%', maxWidth: 165, mx: 'auto' }}>
              <BeneficiarySelect
                beneficiaryAccounts={list}
                selectId={`bene-select-${orderIdOf(row) || row._id || ''}`}
              />
              {canAct ? (
                <Button
                  size="small"
                  variant="contained"
                  sx={{ ...actionBtnSx, fontSize: 10 }}
                  onClick={() => {
                    setBeneRow(row);
                    setBeneOpen(true);
                  }}
                >
                  Add Bene
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'state',
        label: 'State',
        filter: selectFilter('state', STATE_OPTIONS),
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: searchFilter('city', 'City'),
        render: (row) => display(row.city),
      },
      {
        id: 'bank',
        label: 'User Bank Name',
        render: (row) => display(row.userBankName || row.bankName),
      },
      {
        id: 'winIn',
        label: 'Win In',
        filter: selectFilter('playedGames', WIN_IN_OPTIONS, (v) => v || 'All'),
        render: (row) => display(row.playedGames),
      },
      {
        id: 'status',
        label: 'Status',
        filter: selectFilter('status', WITHDRAWAL_STATUSES),
        render: (row) => display(row.status),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontSize: 12, color: pendingAgeColor(row.createdOn) || 'inherit' }}
          >
            {formatDisplayDate(row.createdOn) || '—'}
          </Typography>
        ),
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontSize: 12, color: pendingAgeColor(row.createdOn) || 'inherit' }}
          >
            {formatDisplayTime(row.createdOn) || '—'}
          </Typography>
        ),
      },
      {
        id: 'commission',
        label: 'Commission Amount',
        render: (row) => formatAmount(row.commissionAmount ?? 0),
      },
      {
        id: 'transactionId',
        label: 'Transaction Id',
        filter: searchFilter('transactionId', 'Transaction id'),
        render: (row) => display(orderIdOf(row)),
      },
      {
        id: 'dpId',
        label: 'DP Id',
        filter: searchFilter('dp_id', 'DP id'),
        render: (row) => display(row.dp_id),
      },
      {
        id: 'accountNo',
        label: 'Account No',
        filter: searchFilter('accountNo', 'Account no'),
        render: (row) => <Copyable value={row.accountNo} masked={maskAccount(row.accountNo)} />,
      },
      {
        id: 'bankName',
        label: 'Bank Name',
        render: (row) => display(row.bankName || row.userBankName),
      },
      {
        id: 'ifscCode',
        label: 'IFSC',
        filter: searchFilter('ifscCode', 'IFSC'),
        render: (row) => <Copyable value={row.ifscCode} masked={maskIfsc(row.ifscCode)} />,
      },
      {
        id: 'botCheck',
        label: 'Check By Bot',
        width: 120,
        render: (row) => {
          if (!row.validationCheckedAt) return '—';
          return (
            <Stack spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ fontSize: 11 }}>
                {row.passedPoints ?? 0}/{row.totalPoints ?? '—'}
              </Typography>
              <Button
                size="small"
                variant="contained"
                sx={{ ...actionBtnSx, fontSize: 10 }}
                onClick={() => {
                  setBotItems(row.validationResults || []);
                  setBotOpen(true);
                }}
              >
                Bot Report
              </Button>
            </Stack>
          );
        },
      },
      // Old panel order: Lock By → Check By → Delay → Cross Check By
      {
        id: 'lockBy',
        label: 'Lock By',
        render: (row) =>
          row.lockBy?.name ? personCell(row.lockBy.name, row.lockBy.date) : '—',
      },
      {
        id: 'checkBy',
        label: 'Check By',
        width: 140,
        render: (row) => renderCheckCell(row, 'first'),
      },
      ...(canDelay
        ? [
            {
              id: 'delaySelect',
              label: 'Select Delay Reason',
              width: 180,
              render: (row: WithdrawalRow) =>
                isTerminal(row) ? (
                  '—'
                ) : (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value=""
                    onChange={(e) => void setDelayReason(row, e.target.value)}
                    sx={filterSelectSx}
                  >
                    <MenuItem value="">Select</MenuItem>
                    {DELAY_REASONS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                ),
            } satisfies CommonTableColumn<WithdrawalRow>,
            {
              id: 'delayReason',
              label: 'Delay Reason',
              width: 160,
              render: (row: WithdrawalRow) => {
                const d = row.delayReason;
                if (!d?.reason) return '—';
                return (
                  <Box
                    sx={{
                      fontSize: 10,
                      textAlign: 'left',
                      border: '1px solid rgba(255,159,10,0.4)',
                      borderRadius: 1,
                      p: 0.75,
                      bgcolor: 'rgba(255,159,10,0.08)',
                    }}
                  >
                    <div>
                      <b>Name:</b> {d.name || '—'}
                    </div>
                    <div>
                      <b>Reason:</b> {d.reason}
                    </div>
                    <div>
                      <b>Date:</b> {formatDisplayDate(d.date)} {formatDisplayTime(d.date)}
                    </div>
                  </Box>
                );
              },
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      {
        id: 'crossCheckBy',
        label: 'Cross Check By',
        width: 140,
        render: (row) => renderCheckCell(row, 'second'),
      },
      {
        id: 'provider',
        label: 'Withdrawal Provider',
        filter: midSelect,
        render: (row) => {
          const provider = display(row.withdrewalProviderName || row.paymentGatewayName, '');
          const mid = row.mid != null && row.mid !== '' ? String(row.mid) : '';
          if (!provider && !mid) return '—';
          return mid ? `${provider} - ${mid}` : provider;
        },
      },
    ];

    if (showActionsCol) {
      cols.push({
        id: 'actions',
        label: 'Actions',
        width: 240,
        render: (row) => {
          const orderId = orderIdOf(row);
          const busy = busyId === orderId;
          const buttons: {
            key: string;
            label: string;
            onClick: () => void;
            disabled?: boolean;
          }[] = [];

          if (canAct) {
            if (canUnlockRow(row)) {
              buttons.push({
                key: 'unlock',
                label: 'Unlock',
                onClick: () => void handleUnlock(row),
                disabled: busy,
              });
            } else if (canLockRow(row)) {
              buttons.push({
                key: 'lock',
                label: 'Lock',
                onClick: () => void handleLock(row),
                disabled: busy,
              });
            }
          }
          if (canAct && canShowApproveAction(row)) {
            buttons.push(
              { key: 'approve', label: 'Approve', onClick: () => openAction(row, 'Approved') },
              {
                key: 'manual',
                label: 'Manual',
                onClick: () => openAction(row, 'Manual Approved'),
              },
              { key: 'qr', label: 'QR Code', onClick: () => openQrApprove(row) },
              { key: 'hold', label: 'On Hold', onClick: () => openAction(row, 'on hold') },
            );
          }
          if (canReject && canRejectRow(row)) {
            buttons.push({
              key: 'reject',
              label: 'Reject',
              onClick: () => openAction(row, 'Rejected'),
            });
          }
          if (canReverse && row.status !== 'Cancel') {
            buttons.push({
              key: 'reverse',
              label: 'Reverse',
              onClick: () => openAction(row, 'Reverse'),
            });
          }

          return (
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={0.5}
              justifyContent="center"
              sx={{ maxWidth: 230 }}
            >
              {buttons.map((b) => (
                <Button
                  key={b.key}
                  size="small"
                  variant="contained"
                  disabled={b.disabled}
                  onClick={b.onClick}
                  sx={actionBtnSx}
                >
                  {b.label}
                </Button>
              ))}
            </Stack>
          );
        },
      });
    }

    cols.push(
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) =>
          personCell(
            row.action ? `${row.action.status || ''} by ${row.action.name || ''}` : '—',
            row.updatedOn,
          ),
      },
      {
        id: 'pnlBefore',
        label: 'PnL Before Withdrawal',
        render: (row) => (
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor:
                Number(row.pnl ?? 0) >= 0
                  ? 'rgba(76,175,80,0.25)'
                  : 'rgba(244,67,54,0.25)',
            }}
          >
            {formatAmount(row.pnl ?? 0)}
          </Box>
        ),
      },
      {
        id: 'pnlAfter',
        label: 'PnL After Withdrawal',
        render: (row) => formatAmount(row.afterWithdrawalPnl ?? 0),
      },
    );

    return cols;
  }, [
    page,
    itemsPerPage,
    canAct,
    canReject,
    canReverse,
    canWhatsApp,
    canDelay,
    hideContact,
    busyId,
    selectedIds,
    searchFilter,
    selectFilter,
    midSelect,
    toCallingItem,
    openWhatsApp,
    handleLock,
    handleUnlock,
    openAction,
    openQrApprove,
    toggleSelect,
    renderCheckCell,
    setDelayReason,
  ]);

  const getRowSx = useCallback((row: WithdrawalRow) => {
    const bg = withdrawalRowBg(row);
    if (!bg) return undefined;
    return {
      bgcolor: `${bg} !important`,
      '& td': { bgcolor: `${bg} !important` },
      '& td[data-sticky-left="true"]': {
        bgcolor: `${bg} !important`,
        backgroundColor: `${bg} !important`,
        zIndex: '30 !important',
      },
    };
  }, []);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Typography variant="h5" fontWeight={700} mb={1.5}>
        Withdrawal
      </Typography>

      <Box sx={toolbarBoxSx}>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.25} alignItems="center">
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            select
            size="small"
            label="Items / Page"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value) || 10);
              setPage(1);
            }}
            sx={{ ...fieldSx, width: 120 }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={loading} onClick={() => commitQuery()} sx={orangeBtnSx}>
            Apply
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => commitQuery({ allData: true })}
            sx={orangeBtnSx}
          >
            All Data
          </Button>
          <Button variant="contained" disabled={loading} onClick={clearAll} sx={orangeBtnSx}>
            Clear
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
            disabled={loading}
            onClick={refreshAll}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          {canDownload ? (
            <>
              <Button variant="contained" disabled={loading} onClick={downloadExcel} sx={orangeBtnSx}>
                Download Data
              </Button>
              <Button variant="contained" disabled={loading} onClick={downloadYesBank} sx={orangeBtnSx}>
                Yes Bank Data
              </Button>
              <Button variant="contained" disabled={loading} onClick={downloadPayOk} sx={orangeBtnSx}>
                Pay OK Data
              </Button>
            </>
          ) : null}
        </Stack>

        {canAct ? (
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
            alignItems="center"
            sx={{ mt: 1.25 }}
          >
            <Typography variant="caption" color="text.secondary">
              Selected: {selectedIds.length}
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => void runBulk('withdrawals.bulkLock')}
              sx={actionBtnSx}
            >
              Bulk Lock
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => void runBulk('withdrawals.bulkUnlock')}
              sx={actionBtnSx}
            >
              Bulk Unlock
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => void runBulk('withdrawals.bulkApprove')}
              sx={actionBtnSx}
            >
              Bulk Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => {
                if (!selectedIds.length) {
                  toast.warn('Select at least one row using the checkboxes');
                  return;
                }
                setBulkManualGateway('');
                setBulkManualMid('');
                setBulkManualOpen(true);
              }}
              sx={actionBtnSx}
            >
              Bulk Manual Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => setBeneListOpen(true)}
              sx={actionBtnSx}
            >
              Add Bene List
            </Button>
            {bulkBusy ? <CircularProgress size={16} sx={{ color: '#ff9f0a' }} /> : null}
          </Stack>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={1.5}>
        <Chip
          label={withdrawalStatLabel(
            'Approved',
            summary.totalApprovedCount,
            summary.totalApprovedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Pending',
            summary.totalPendingCount,
            summary.totalPendingAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Rejected',
            summary.totalRejectedCount,
            summary.totalRejectedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Reverse',
            summary.totalReversedCount,
            summary.totalReversedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'On Hold',
            summary.totalOnholdCount,
            summary.totalOnholdAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Cancelled',
            summary.totalCanceledCount,
            summary.totalCanceledAmount,
          )}
          sx={chipSx}
        />
        {summaryLoading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || orderIdOf(row) || index}
        loading={loading}
        emptyMessage="No withdrawals found"
        stickyHeader
        dense
        virtualize={false}
        minWidth={3000}
        maxHeight="calc(100vh - 360px)"
        getRowSx={getRowSx}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mt={2}>
        <Typography variant="body2" color="text.secondary">
          Total: {total}
        </Typography>
        <Pagination
          count={Math.max(1, totalPages)}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
          disabled={loading}
        />
      </Stack>

      <ActionDialog
        open={actionOpen}
        saving={actionSaving}
        status={actionStatus}
        remark={actionRemark}
        gateway={actionGateway}
        mid={actionMid}
        payoutGateways={gateways}
        mids={mids}
        onStatus={setActionStatus}
        onRemark={setActionRemark}
        onGateway={setActionGateway}
        onMid={setActionMid}
        onClose={() => setActionOpen(false)}
        onSubmit={() => void submitAction()}
      />

      <BotValidationModal open={botOpen} items={botItems} onClose={() => setBotOpen(false)} />

      <AddBeneDialog
        open={beneOpen}
        userId={beneRow?.dp_id || beneRow?.userId || ''}
        transactionId={beneRow ? orderIdOf(beneRow) : ''}
        existing={beneRow ? extractBeneficiaryAccounts(beneRow) : []}
        availableBanks={availableBanks}
        onClose={() => {
          setBeneOpen(false);
          setBeneRow(null);
        }}
        onDone={() => void load()}
        onBanksChanged={() => void loadLookups()}
      />

      <BeneListDialog
        open={beneListOpen}
        initialBanks={availableBanks}
        onClose={() => setBeneListOpen(false)}
        onSuccess={() => void loadLookups()}
      />

      <QrApproveDialog
        open={qrOpen}
        saving={qrSaving}
        row={qrRow}
        gateway={qrGateway}
        mid={qrMid}
        mids={mids}
        payoutGateways={gateways}
        onGateway={setQrGateway}
        onMid={setQrMid}
        onClose={() => {
          setQrOpen(false);
          setQrRow(null);
        }}
        onSubmit={() => void submitQrApprove()}
      />

      {/* Bulk Manual Approve — gateway + mid required (old panel popup) */}
      <Dialog
        open={bulkManualOpen}
        onClose={() => !bulkBusy && setBulkManualOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Bulk Manual Approve</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Selected rows: {selectedIds.length}
            </Typography>
            <TextField
              select
              fullWidth
              label="Gateway"
              value={bulkManualGateway}
              onChange={(e) => setBulkManualGateway(e.target.value)}
              sx={{ '& .MuiInputBase-root': { bgcolor: '#121218' } }}
            >
              <MenuItem value="">— Choose —</MenuItem>
              {Array.from(new Set([...MANUAL_GATEWAYS, ...gateways])).map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Mid"
              value={bulkManualMid}
              onChange={(e) => setBulkManualMid(e.target.value)}
              sx={{ '& .MuiInputBase-root': { bgcolor: '#121218' } }}
            >
              <MenuItem value="">— Choose —</MenuItem>
              {mids.map((m, i) => (
                <MenuItem key={`${m.mid ?? ''}-${i}`} value={String(m.mid ?? '')}>
                  {midLabel(m)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setBulkManualOpen(false)}
            disabled={bulkBusy}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={bulkBusy}
            onClick={() =>
              void runBulk('withdrawals.bulkManualApprove', {
                gatewayName: bulkManualGateway,
                mid: bulkManualMid,
              })
            }
            sx={orangeBtnSx}
          >
            {bulkBusy ? '…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
