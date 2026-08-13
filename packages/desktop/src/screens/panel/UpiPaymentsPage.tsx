import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { appCodeForName } from '@/constants/clientNames';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { maskMobile } from '@/screens/panel/shared';
import {
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type Gateway = {
  _id?: string;
  name?: string;
  mid?: string | number;
};

type NotificationRow = {
  _id?: string;
  title?: string;
  text?: string;
  clientName?: string;
  mid?: string | number;
  updatedOn?: string;
  reason?: string;
  updatedByName?: string;
  status?: string;
};

type RequestRow = {
  _id?: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  clientName?: string;
  amount?: number;
  orderId?: string;
  userState?: string;
  userCity?: string;
  userBankName?: string;
  paymentGatewayName?: string;
  mid?: string | number;
  status?: string;
  createdOn?: string;
  updatedBy?: { name?: string; _id?: string };
};

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { items?: unknown; payload?: unknown };
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (obj.payload && typeof obj.payload === 'object') {
      const p = obj.payload as { items?: unknown };
      if (Array.isArray(p.items)) return p.items as T[];
      if (Array.isArray(obj.payload)) return obj.payload as T[];
    }
  }
  return [];
}

function asPaged(raw: unknown): { items: unknown[]; totalPages: number; total: number } {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as {
          items?: unknown[];
          totalPages?: number;
          total?: number;
          payload?: {
            items?: unknown[];
            totalPages?: number;
            total?: number;
          };
        })
      : {};
  const body = obj.payload ?? obj;
  return {
    items: Array.isArray(body.items) ? body.items : [],
    totalPages: Math.max(1, Number(body.totalPages) || 1),
    total: Number(body.total) || 0,
  };
}

function shortenNotificationText(text?: string): string {
  if (!text) return '—';
  const match = text.match(/Received (INR [\d,.]+).*?from (.*?) \((.*?)\)/i);
  if (match) {
    const [, amount, name, upi] = match;
    return `Rec ${amount} from ${name} (${upi})`;
  }
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function requestRowBg(row: RequestRow): string | undefined {
  const status = String(row.status || '').toLowerCase();
  if (status === 'approved' || status === 'approved-clr') return '#1b3d2f';
  if (row.paymentGatewayName === 'upi-payment') return '#1a2f45';
  return undefined;
}

export function UpiPaymentsPage() {
  const user = getStoredUser<{
    name?: string;
    _id?: string;
    Responsibilities?: string[];
  }>();
  const canEditDeposit = hasPermission(Permissions.Deposit_Pensil);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [notifPage, setNotifPage] = useState(1);
  const [notifRows, setNotifRows] = useState<NotificationRow[]>([]);
  const [notifTotalPages, setNotifTotalPages] = useState(1);
  const [notifTotal, setNotifTotal] = useState(0);

  const [reqPage, setReqPage] = useState(1);
  const [reqRows, setReqRows] = useState<RequestRow[]>([]);
  const [reqTotalPages, setReqTotalPages] = useState(1);

  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [loading, setLoading] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveItem, setApproveItem] = useState<RequestRow | null>(null);
  const [approveReason, setApproveReason] = useState('');

  const [amountOpen, setAmountOpen] = useState(false);
  const [amountItem, setAmountItem] = useState<RequestRow | null>(null);
  const [newAmount, setNewAmount] = useState('');

  const [notifStatusOpen, setNotifStatusOpen] = useState(false);
  const [notifItem, setNotifItem] = useState<NotificationRow | null>(null);
  const [notifStatus, setNotifStatus] = useState('');
  const [notifClient, setNotifClient] = useState('');
  const [notifRemark, setNotifRemark] = useState('');
  const [notifUserId, setNotifUserId] = useState('');

  const { next, isCurrent, begin, end } = useRequestGeneration();

  const selectedGateway = useMemo(
    () => gateways.find((g) => g._id === selectedGatewayId) || null,
    [gateways, selectedGatewayId],
  );

  const loadGateways = useCallback(async () => {
    const res = await secureApi<unknown>('upiPayments.gateways', {});
    if (!res.ok) return;
    const list = asList<Gateway>(res.data).filter(
      (g) => String(g.name || '').toLowerCase() === 'upi-payment',
    );
    setGateways(list);
  }, []);

  const loadNotifications = useCallback(
    async (pageNo = notifPage) => {
      const res = await secureApi<unknown>('upiPayments.notifications', {
        itemsPerPage,
        pageNo,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load notifications');
        setNotifRows([]);
        return;
      }
      const paged = asPaged(res.data);
      setNotifRows(paged.items as NotificationRow[]);
      setNotifTotalPages(paged.totalPages);
      setNotifTotal(paged.total);
    },
    [notifPage, itemsPerPage, startDate, endDate],
  );

  const loadRequests = useCallback(
    async (pageNo = reqPage) => {
      const filter: Record<string, unknown> = {
        paymentGatewayName: 'upi-payment',
      };
      if (selectedGateway?.mid != null && selectedGateway.mid !== '') {
        filter.mid = selectedGateway.mid;
      }

      const res = await secureApi<unknown>('upiPayments.transactions', {
        type: 'deposit',
        itemsPerPage,
        pageNo,
        filter,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load transaction requests');
        setReqRows([]);
        return;
      }
      const paged = asPaged(res.data);
      const items = (paged.items as RequestRow[]).filter(
        (r) => String(r.status || '').toLowerCase() !== 'failed',
      );
      setReqRows(items);
      setReqTotalPages(paged.totalPages);
    },
    [reqPage, itemsPerPage, startDate, endDate, selectedGateway],
  );

  const reloadAll = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      await Promise.all([loadNotifications(), loadRequests()]);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, begin, end, isCurrent, loadNotifications, loadRequests]);

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    void reloadAll();
  }, [itemsPerPage, notifPage, reqPage, selectedGatewayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setNotifPage(1);
    setReqPage(1);
    void reloadAll();
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    setNotifPage(1);
    setReqPage(1);
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([
          secureApi('upiPayments.notifications', {
            itemsPerPage,
            pageNo: 1,
            startDate: todayIST(),
            endDate: todayIST(),
          }).then((res) => {
            if (!res.ok) return;
            const paged = asPaged(res.data);
            setNotifRows(paged.items as NotificationRow[]);
            setNotifTotalPages(paged.totalPages);
            setNotifTotal(paged.total);
          }),
          loadRequests(1),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  };

  const submitApprove = async () => {
    if (!approveItem) return;
    if (!approveReason.trim()) {
      toast.error('Select reason');
      return;
    }
    const remark = `Deposite failure of ${approveItem.userName} through ${approveItem.paymentGatewayName} pay with order id ${approveItem.orderId} and mobile no ${approveItem.userMobile ?? ''}`;
    const res = await secureApi('upiPayments.addCoin', {
      userId: approveItem.userId,
      balance: approveItem.amount,
      updatedBy: { name: user?.name, _id: user?._id },
      reason: approveReason,
      remark,
      tag: 'credit',
      orderId: approveItem.orderId,
    });
    if (!res.ok) {
      toast.error(res.message || 'Failed to approve');
      return;
    }
    toast.success('Amount deposited successfully');
    setApproveOpen(false);
    setApproveItem(null);
    setApproveReason('');
    void loadRequests();
  };

  const submitAmount = async () => {
    if (!amountItem || !newAmount) {
      toast.error('Amount is required');
      return;
    }
    const res = await secureApi('upiPayments.changeAmount', {
      userId: amountItem.userId,
      transactionId: amountItem.orderId,
      amount: Number(newAmount),
      paymentGatewayName: amountItem.paymentGatewayName,
    });
    if (!res.ok) {
      toast.error(res.message || 'Failed to update amount');
      return;
    }
    toast.success('Amount updated');
    setAmountOpen(false);
    setAmountItem(null);
    setNewAmount('');
    void loadRequests();
  };

  const submitNotifStatus = async () => {
    if (!notifItem || !notifStatus || !notifClient || !notifRemark || !notifUserId) {
      toast.error('Fill all required fields');
      return;
    }
    const res = await secureApi('upiPayments.changeNotification', {
      _id: notifItem._id,
      clientName: notifClient,
      status: notifStatus,
      remark: notifRemark,
      updatedByName: user?.name,
      userId: notifUserId.trim(),
    });
    if (!res.ok) {
      toast.error(res.message || 'Failed to update status');
      return;
    }
    toast.success('Status updated');
    setNotifStatusOpen(false);
    setNotifItem(null);
    void loadNotifications();
  };

  const notifColumns = useMemo<CommonTableColumn<NotificationRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_r, i) => (notifPage - 1) * itemsPerPage + i + 1,
      },
      { id: 'title', label: 'Title', render: (r) => r.title || '—' },
      {
        id: 'app',
        label: 'App Name',
        render: (r) => appCodeForName(r.clientName),
      },
      {
        id: 'text',
        label: 'Text',
        render: (r) => (
          <Typography variant="body2" title={r.text} noWrap sx={{ maxWidth: 280 }}>
            {shortenNotificationText(r.text)}
          </Typography>
        ),
      },
      { id: 'mid', label: 'Mid', render: (r) => String(r.mid ?? '—') },
      {
        id: 'datetime',
        label: 'Date Time',
        render: (r) =>
          r.updatedOn
            ? `${formatDisplayDate(r.updatedOn)} | ${formatDisplayTime(r.updatedOn)}`
            : '—',
      },
      { id: 'mismatch', label: 'Mis Match Info', render: (r) => r.reason || '—' },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (r) => r.updatedByName || '—',
      },
      {
        id: 'action',
        label: 'Action',
        render: (r) =>
          String(r.status || '').toLowerCase() === 'pending' ? (
            <IconButton
              size="small"
              color="warning"
              onClick={() => {
                setNotifItem(r);
                setNotifStatus('');
                setNotifClient('');
                setNotifRemark('');
                setNotifUserId('');
                setNotifStatusOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          ) : (
            '—'
          ),
      },
    ],
    [notifPage, itemsPerPage],
  );

  const reqColumns = useMemo<CommonTableColumn<RequestRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_r, i) => (reqPage - 1) * itemsPerPage + i + 1,
      },
      { id: 'userName', label: 'User Name', render: (r) => r.userName || '—' },
      {
        id: 'mobile',
        label: 'Mobile No',
        render: (r) => {
          const mobile = String(r.userMobile || '');
          if (!canShowMobile) return maskMobile(mobile, false);
          if (!mobile) return '—';
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography variant="body2">{mobile}</Typography>
              <IconButton
                size="small"
                onClick={() => {
                  void navigator.clipboard.writeText(mobile);
                  toast.success(`${mobile} copied`);
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          );
        },
      },
      {
        id: 'app',
        label: 'App Name',
        render: (r) => appCodeForName(r.clientName),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (r) => {
          const pending = String(r.status || '').toLowerCase() === 'pending';
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography variant="body2">{r.amount ?? '—'}</Typography>
              {pending && canEditDeposit && (
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => {
                    setAmountItem(r);
                    setNewAmount(String(r.amount ?? ''));
                    setAmountOpen(true);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        id: 'txid',
        label: 'Transaction ID',
        render: (r) => <CopyText value={String(r.orderId || '')} />,
      },
      { id: 'state', label: 'User State', render: (r) => r.userState || '—' },
      { id: 'city', label: 'User City', render: (r) => r.userCity || '—' },
      {
        id: 'bank',
        label: 'User Bank Name',
        render: (r) => r.userBankName || '—',
      },
      {
        id: 'gateway',
        label: 'Payment Gateway Name',
        filter: (
          <TextField
            select
            size="small"
            value={selectedGatewayId}
            onChange={(e) => {
              setSelectedGatewayId(e.target.value);
              setReqPage(1);
            }}
            sx={{ minWidth: 140, bgcolor: '#f4f6f8', borderRadius: 1 }}
          >
            <MenuItem value="">All</MenuItem>
            {gateways.map((g) => (
              <MenuItem key={g._id} value={g._id}>
                {g.name}-{g.mid}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (r) => `${r.paymentGatewayName || '—'}-${r.mid ?? ''}`,
      },
      {
        id: 'status',
        label: 'Status',
        render: (r) => {
          const pending =
            String(r.status || '').toLowerCase() === 'pending' ||
            String(r.status || '').toLowerCase() === 'processing';
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography variant="body2">{r.status || '—'}</Typography>
              {pending && canEditDeposit && (
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => {
                    setApproveItem(r);
                    setApproveReason('');
                    setApproveOpen(true);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (r) => r.updatedBy?.name || '—',
      },
      {
        id: 'date',
        label: 'Date',
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
      {
        id: 'time',
        label: 'Time',
        render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
      },
    ],
    [reqPage, itemsPerPage, canEditDeposit, canShowMobile, gateways, selectedGatewayId],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        UPI Payments
      </Typography>

      <Paper
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'background.paper',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={applyFilters}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={clearDates}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Clear Dates
          </Button>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setNotifPage(1);
              setReqPage(1);
            }}
            sx={{ width: 150, flexShrink: 0 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          {loading && <CircularProgress size={22} />}
        </Stack>
        <Typography fontWeight={700} mt={1.5}>
          Total Count : {notifTotal}
        </Typography>
      </Paper>

      <Typography variant="h6" fontWeight={700} mb={1}>
        Transaction Notifications
      </Typography>
      <CommonTable
        columns={notifColumns}
        rows={notifRows}
        getRowKey={(r, i) => r._id || i}
        loading={loading}
        emptyMessage="No notifications found"
        stickyHeader
        dense
        getRowSx={(row) => {
          const s = String(row.status || '').toLowerCase();
          if (s === 'pending') return { bgcolor: 'rgba(255, 235, 59, 0.12)' };
          if (s === 'failed') return { bgcolor: 'rgba(245, 86, 86, 0.2)' };
          if (s === 'hold') return { bgcolor: 'rgba(33, 150, 243, 0.15)' };
          return { bgcolor: 'rgba(119, 178, 84, 0.12)' };
        }}
        maxHeight={360}
      />
      <Stack alignItems="center" mt={1.5} mb={3}>
        <Pagination
          count={notifTotalPages}
          page={notifPage}
          color="secondary"
          onChange={(_e, p) => setNotifPage(p)}
        />
      </Stack>

      <Typography variant="h6" fontWeight={700} mb={1}>
        Transaction Requests
      </Typography>
      <CommonTable
        columns={reqColumns}
        rows={reqRows}
        getRowKey={(r, i) => r._id || r.orderId || i}
        loading={loading}
        emptyMessage="No transaction requests found"
        stickyHeader
        dense
        getRowSx={(row) => {
          const bg = requestRowBg(row);
          return bg ? { bgcolor: bg } : undefined;
        }}
        maxHeight={480}
      />
      <Stack alignItems="center" mt={1.5}>
        <Pagination
          count={reqTotalPages}
          page={reqPage}
          color="secondary"
          onChange={(_e, p) => setReqPage(p)}
        />
      </Stack>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Manual settle Transaction</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} mt={1}>
            <TextField
              fullWidth
              size="small"
              label="Amount"
              value={approveItem?.amount ?? ''}
              disabled
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Select Reason"
              value={approveReason}
              onChange={(e) => setApproveReason(e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="Deposit Failure">Deposit Failure</MenuItem>
              <MenuItem value="deposit-manual">deposit-manual</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Remark"
              multiline
              minRows={3}
              disabled
              value={
                approveItem
                  ? `Deposite failure of ${approveItem.userName} through ${approveItem.paymentGatewayName} pay with order id ${approveItem.orderId} and mobile no ${approveItem.userMobile ?? ''}`
                  : ''
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void submitApprove()}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={amountOpen} onClose={() => setAmountOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update Amount</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAmountOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void submitAmount()}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={notifStatusOpen}
        onClose={() => setNotifStatusOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Update Notification Status</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} mt={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={notifStatus}
              onChange={(e) => setNotifStatus(e.target.value)}
            >
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
              <MenuItem value="Hold">Hold</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Client Name"
              value={notifClient}
              onChange={(e) => setNotifClient(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label="User ID"
              value={notifUserId}
              onChange={(e) => setNotifUserId(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label="Remark"
              value={notifRemark}
              onChange={(e) => setNotifRemark(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifStatusOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void submitNotifStatus()}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
