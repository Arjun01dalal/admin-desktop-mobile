import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable } from '@/components/CommonTable';
import { useLocationController } from '@/controllers/LocationProvider';
import {
  getStoredUser,
} from '@/utils/dates';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '@/utils/empCodeNameCache';
import { asList } from '@/screens/panel/shared';
import type { UserRow } from '@/screens/panel/users/utils';
import {
  orangeBtnSx,
  actionBtnSx,
  type MidOption,
  unpackPayload,
} from '@/screens/panel/transactions/shared';
import {
  type WithdrawalRow,
  type ValidationItem,
  MANUAL_GATEWAYS,
} from '@/screens/panel/withdrawal/types';
import {
  orderIdOf,
  midLabel,
  extractBeneficiaryAccounts,
  bothChecksOk,
  isTerminal,
} from '@/screens/panel/withdrawal/logic';
import { requireWithdrawalGeo } from '@/screens/panel/withdrawal/geo';
import { ActionDialog } from '@/screens/panel/withdrawal/ActionDialog';
import { BotValidationModal } from '@/screens/panel/withdrawal/BotValidationModal';
import { AddBeneDialog } from '@/screens/panel/withdrawal/AddBeneDialog';
import { QrApproveDialog } from '@/screens/panel/withdrawal/QrApproveDialog';
import { BeneListDialog } from '@/screens/panel/withdrawal/BeneListDialog';
import { TotalBeneListDialog } from '@/screens/panel/withdrawal/TotalBeneListDialog';
import { DepositWithdrawalMidModal } from '@/screens/panel/withdrawal/DepositWithdrawalMidModal';
import { personCell } from '@/screens/panel/withdrawal/withdrawalCells';
import { useWithdrawalColumns, type WithdrawalColumnFilterSlots } from '@/screens/panel/withdrawal/useWithdrawalColumns';

export type { WithdrawalColumnFilterSlots };

export type WithdrawalActionTableProps = {
  rows: WithdrawalRow[];
  page: number;
  pageSize: number;
  loading?: boolean;
  onRefresh: () => void;
  /** When true, omit per-column filter inputs (Active User Withdrawal). */
  hideColumnFilters?: boolean;
  /** Column filter nodes from WithdrawalPage (ignored when hideColumnFilters). */
  columnFilters?: WithdrawalColumnFilterSlots;
  /** Withdrawal page shows Total Bene List; Laxmi AUW bulk bar does not. Default true. */
  showTotalBeneList?: boolean;
  /** Optional: notify parent when bank lookups change (toolbar bene options). */
  onLookupsChanged?: () => void;
};

/**
 * Full withdrawal action table — bulk bar, CommonTable columns, row styling,
 * and lock/unlock/check/approve/reject/reverse/QR/delay/Add Bene/Bot dialogs.
 */
export function WithdrawalActionTable({
  rows,
  page,
  pageSize,
  loading = false,
  onRefresh,
  hideColumnFilters = false,
  columnFilters,
  showTotalBeneList = true,
  onLookupsChanged,
}: WithdrawalActionTableProps) {
  const navigate = useNavigate();
  const isLightMode = useTheme().palette.mode === 'light';
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    mobile?: string;
  }>();
  const loc = useLocationController();

  const canOpenUserReport = hasPermission('wallet_history');
  const canAct = hasPermission('withdrawals_button');
  const canReject = hasPermission('View_Reject') || canAct;
  const canReverse = hasPermission('View_Reverse') || canAct;
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canDelay = hasPermission('View_Delay_Reason');
  const hideCheck = hasPermission('Disable_Withdrawals_Check');
  const hideContact = hasPermission('contact_visibility_none');

  const [mids, setMids] = useState<MidOption[]>([]);
  const [gateways, setGateways] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
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

  const [midReportOpen, setMidReportOpen] = useState(false);
  const [midReportRow, setMidReportRow] = useState<WithdrawalRow | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrRow, setQrRow] = useState<WithdrawalRow | null>(null);
  const [qrGateway, setQrGateway] = useState('');
  const [qrMid, setQrMid] = useState('');
  const [qrSaving, setQrSaving] = useState(false);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkManualOpen, setBulkManualOpen] = useState(false);
  const [bulkManualGateway, setBulkManualGateway] = useState('');
  const [bulkManualMid, setBulkManualMid] = useState('');
  const [beneListOpen, setBeneListOpen] = useState(false);
  const [totalBeneListOpen, setTotalBeneListOpen] = useState(false);

  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  useEffect(() => {
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

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
      const banks = (raw as unknown[])
        .map((b) => (typeof b === 'string' ? b : String((b as { name?: string })?.name || '')))
        .filter(Boolean);
      setAvailableBanks(banks);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    setSelectedIds([]);
  }, [rows]);

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
        onRefresh();
      } finally {
        setBusyId('');
      }
    },
    [admin, loc, onRefresh],
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
        onRefresh();
      } finally {
        setBusyId('');
      }
    },
    [admin, loc, onRefresh],
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
        onRefresh();
      } finally {
        setBusyId('');
      }
    },
    [onRefresh],
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
      onRefresh();
    } finally {
      setQrSaving(false);
    }
  }, [qrRow, qrGateway, qrMid, admin, loc, onRefresh]);

  const submitAction = useCallback(async () => {
    if (!actionTarget) return;
    const orderId = orderIdOf(actionTarget);
    if (!orderId) {
      toast.error('Missing transaction id');
      return;
    }
    const needsGatewayMid = !['Approved', 'Reverse', 'Rejected', 'on hold'].includes(actionStatus);
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
      if (actionStatus === 'Manual Approved' || (actionGateway && needsGatewayMid)) {
        payload.withdrewalProviderName = actionGateway;
      }
      if (needsGatewayMid && actionMid) payload.mid = actionMid;
      if (needsGatewayMid && actionGateway) payload.gatewayName = actionGateway;

      const res = await secureApi('withdrawals.statusUpdate', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      toast.success(res.message || 'Status updated');
      setActionOpen(false);
      setActionTarget(null);
      onRefresh();
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
    onRefresh,
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
      onRefresh();
    },
    [admin, onRefresh],
  );

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
        const provider = (extra?.withdrewalProviderName as string) || gateways[0] || '';
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
        onRefresh();
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, selectedRows, loc, admin, gateways, onRefresh],
  );

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

  const filterOf = useCallback(
    (key: keyof NonNullable<WithdrawalColumnFilterSlots>) =>
      hideColumnFilters ? undefined : columnFilters?.[key],
    [hideColumnFilters, columnFilters],
  );

  const renderCheckCell = useCallback(
    (row: WithdrawalRow, kind: 'first' | 'second') => {
      const person = kind === 'first' ? row.checkBy : row.crossCheckBy;
      const orderId = orderIdOf(row);
      const busy = busyId === `${orderId}-${kind}`;
      const blocked = isTerminal(row) || (kind === 'second' && !row.checkBy?.status);

      if (person?.name) {
        return personCell(`${person.status ? 'OK' : 'Not OK'} by ${person.name}`, person.date);
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

  const { columns, getRowSx } = useWithdrawalColumns({
    page,
    pageSize,
    canAct,
    canReject,
    canReverse,
    canWhatsApp,
    canDelay,
    canOpenUserReport,
    hideContact,
    busyId,
    empCodeNameMap,
    selectedIds,
    filterOf,
    toCallingItem,
    openWhatsApp,
    handleLock,
    handleUnlock,
    openAction,
    openQrApprove,
    toggleSelect,
    renderCheckCell,
    setDelayReason,
    navigate,
    isLightMode,
    setMidReportRow,
    setMidReportOpen,
    setBeneRow,
    setBeneOpen,
    setBotItems,
    setBotOpen,
  });

  return (
    <>
      {canAct ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={1}
          alignItems="center"
          sx={{ mb: 1, flexShrink: 0 }}
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
          {showTotalBeneList ? (
            <Button
              size="small"
              variant="contained"
              disabled={bulkBusy}
              onClick={() => setTotalBeneListOpen(true)}
              sx={actionBtnSx}
            >
              Total Bene List
            </Button>
          ) : null}
          {bulkBusy ? <CircularProgress size={16} sx={{ color: '#ff9f0a' }} /> : null}
        </Stack>
      ) : null}

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || orderIdOf(row) || index}
        loading={loading}
        emptyMessage="No withdrawals found"
        stickyHeader
        dense
        virtualize
        minWidth={3000}
        maxHeight="100%"
        getRowSx={getRowSx}
      />

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

      <DepositWithdrawalMidModal
        open={midReportOpen}
        row={midReportRow}
        catalogMids={mids.map((m) => String(m.mid ?? '').trim()).filter(Boolean)}
        onClose={() => {
          setMidReportOpen(false);
          setMidReportRow(null);
        }}
      />

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
        onDone={() => onRefresh()}
        onBanksChanged={() => void loadLookups()}
      />

      <BeneListDialog
        open={beneListOpen}
        initialBanks={availableBanks}
        onClose={() => setBeneListOpen(false)}
        onSuccess={() => {
          void loadLookups();
          onLookupsChanged?.();
        }}
      />

      {showTotalBeneList ? (
        <TotalBeneListDialog
          open={totalBeneListOpen}
          onClose={() => setTotalBeneListOpen(false)}
        />
      ) : null}

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
              sx={{
                '& .MuiInputBase-root': { bgcolor: 'background.paper', color: 'text.primary' },
              }}
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
              sx={{
                '& .MuiInputBase-root': { bgcolor: 'background.paper', color: 'text.primary' },
              }}
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
    </>
  );
}
