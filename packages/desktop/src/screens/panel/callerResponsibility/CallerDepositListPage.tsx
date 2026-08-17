import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { formatAmount, formatDisplayDate, getStoredUser, todayIST } from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { maskMobile } from '@/screens/panel/shared';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import type { UserRow } from '@/screens/panel/users/utils';
import { RESP_SHOW_MOBILE, type CallerRow } from './constants';
import { roleFlags, type StoredCallerUser } from './utils';

function toCallingItem(row: CallerRow): UserRow {
  return {
    _id: String(row._id || row.userId || ''),
    name: String(row.userName || row.name || ''),
    userName: String(row.userName || row.name || ''),
    mobile: String(row.userMobile || row.mobile || ''),
    userMobile: String(row.userMobile || row.mobile || ''),
    clientName: String(row.clientName || ''),
    state: String(row.userState || row.state || ''),
    city: String(row.userCity || row.city || ''),
  };
}
type CheckByInfo = {
  name?: string;
  city?: string;
  state?: string;
  date?: string;
};

function formatCheckByDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(d)
    .replace(/\//g, '-');
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${datePart} - ${timePart}`;
}

function renderCheckBy(value: unknown) {
  if (!value || typeof value !== 'object') {
    return String(value || '-');
  }
  const info = value as CheckByInfo;
  const lineSx = { whiteSpace: 'nowrap' as const, display: 'block' };
  return (
    <Stack spacing={0.25} alignItems="flex-start" sx={{ textAlign: 'left' }}>
      <Box component="span" sx={lineSx}>
        {`Name:- ${info.name ?? '-'}`}
      </Box>
      <Box component="span" sx={lineSx}>
        {`City:- ${info.city ?? '-'}`}
      </Box>
      <Box component="span" sx={lineSx}>
        {`State:- ${info.state ?? '-'}`}
      </Box>
      <Box component="span" sx={lineSx}>
        {`Date:- ${formatCheckByDate(info.date)}`}
      </Box>
    </Stack>
  );
}

type ListState = {
  list?: CallerRow;
  type?: 'withdrawal' | 'uniquePending' | string;
  empCode?: string;
  startDate?: string;
  endDate?: string;
};

function pickItems(data: unknown): CallerRow[] {
  if (Array.isArray(data)) return data as CallerRow[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as CallerRow;
  if (Array.isArray(obj.items)) return obj.items as CallerRow[];
  if (Array.isArray(obj.data)) return obj.data as CallerRow[];
  if (obj.payload && typeof obj.payload === 'object') {
    const inner = obj.payload as CallerRow;
    if (Array.isArray(inner.items)) return inner.items as CallerRow[];
    if (Array.isArray(obj.payload)) return obj.payload as CallerRow[];
  }
  return [];
}

function pickTotalPages(data: unknown): number {
  if (!data || typeof data !== 'object') return 1;
  const obj = data as CallerRow;
  const nested =
    obj.payload && typeof obj.payload === 'object'
      ? (obj.payload as CallerRow)
      : null;
  return Number(obj.totalPages ?? nested?.totalPages ?? 1) || 1;
}

type StatusTotal = { count?: number; amount?: number };

function pickWithdrawalTotals(data: unknown): {
  all: StatusTotal;
  approved: StatusTotal;
  cancel: StatusTotal;
  pending: StatusTotal;
} {
  const empty = { count: 0, amount: 0 };
  if (!data || typeof data !== 'object') {
    return { all: empty, approved: empty, cancel: empty, pending: empty };
  }
  const obj = data as CallerRow;
  const totals = (
    obj.totals && typeof obj.totals === 'object'
      ? obj.totals
      : (obj.payload as CallerRow | undefined)?.totals &&
          typeof (obj.payload as CallerRow).totals === 'object'
        ? (obj.payload as CallerRow).totals
        : null
  ) as
    | {
        all?: StatusTotal;
        byStatus?: {
          Approved?: StatusTotal;
          Cancel?: StatusTotal;
          Pending?: StatusTotal;
        };
      }
    | null;

  return {
    all: totals?.all ?? empty,
    approved: totals?.byStatus?.Approved ?? empty,
    cancel: totals?.byStatus?.Cancel ?? empty,
    pending: totals?.byStatus?.Pending ?? empty,
  };
}

export function CallerDepositListPage() {
  const location = useLocation();
  const state = (location.state || {}) as ListState;
  const list = state.list;
  const type = state.type;
  const isWithdrawal = type === 'withdrawal';
  const isUniquePending = type === 'uniquePending';
  const empCode = String(state.empCode || list?.empCode || '');
  const parentStart = state.startDate;
  const parentEnd = state.endDate;

  const user = getStoredUser<
    StoredCallerUser & { clientName?: string | string[]; allotedApps?: string | string[] }
  >();
  const { isCaller } = roleFlags(user?.Role_ID);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);
  const appOptions = useMemo(() => {
    const allotted = user?.clientName || user?.allotedApps;
    if (Array.isArray(allotted) && allotted.length) return allotted.map(String);
    if (typeof allotted === 'string' && allotted) return [allotted];
    return [...CLIENT_NAMES];
  }, [user?.clientName, user?.allotedApps]);

  const [startDate, setStartDate] = useState(() => parentStart || todayIST());
  const [endDate, setEndDate] = useState(() => parentEnd || todayIST());
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<unknown>({});
  const [mobile, setMobile] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState('');
  const [name, setName] = useState('');
  // Laxmi CallerDepositList withdrawal filters
  const [amountGte, setAmountGte] = useState('');
  const [amountLte, setAmountLte] = useState('');
  const [checked, setChecked] = useState(true);

  const depositRows = useMemo(() => {
    if (isWithdrawal || isUniquePending) {
      return pickItems(payload);
    }
    const deposits = list?.deposits;
    return Array.isArray(deposits) ? (deposits as CallerRow[]) : [];
  }, [isWithdrawal, isUniquePending, payload, list]);

  const totalPages = pickTotalPages(payload);
  const withdrawalTotals = useMemo(
    () => pickWithdrawalTotals(payload),
    [payload],
  );

  const loadRemote = useCallback(async () => {
    if (!isWithdrawal && !isUniquePending) return;
    if (!empCode) {
      toast.error('Employee code missing for this caller');
      return;
    }

    setLoading(true);
    try {
      if (isWithdrawal) {
        const body: Record<string, unknown> = {
          empCode,
          pageNo: page,
          itemPerPage: itemsPerPage,
          startDate,
          endDate,
          checked,
        };
        if (status) body.status = status;
        if (name.trim()) body.name = name.trim();
        if (amountGte.trim()) body.amountGte = amountGte.trim();
        if (amountLte.trim()) body.amountLte = amountLte.trim();

        const res = await secureApi('caller.withdrawalByEmpcode', body);
        if (!res.ok) {
          toast.error(res.message || 'Failed to load withdrawals');
          setPayload({});
          return;
        }
        setPayload(res.data ?? {});
      } else {
        const filter: Record<string, unknown> = {};
        if (mobile.trim()) filter.mobile = mobile.trim();
        if (clientName.trim()) filter.clientName = clientName.trim();

        const res = await secureApi('caller.uniquePendingDeposits', {
          empCode,
          startDate: parentStart || startDate,
          endDate: parentEnd || endDate,
          pageNo: page,
          itemsPerPage,
          filter,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to load unique pending');
          setPayload({});
          return;
        }
        setPayload(res.data ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, [
    empCode,
    isWithdrawal,
    isUniquePending,
    status,
    name,
    amountGte,
    amountLte,
    checked,
    page,
    itemsPerPage,
    startDate,
    endDate,
    mobile,
    clientName,
    parentStart,
    parentEnd,
  ]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  const title = isWithdrawal
    ? 'Refund List'
    : isUniquePending
      ? 'Unique Pending'
      : 'Deposit List';

  const columns = useMemo<CommonTableColumn<CallerRow>[]>(() => {
    const col = (
      id: string,
      label: ReactNode,
      render: CommonTableColumn<CallerRow>['render'],
      extra?: Partial<CommonTableColumn<CallerRow>>,
    ): CommonTableColumn<CallerRow> => ({ id, label, render, ...extra });

    const sr = col('#', 'SR.No', (_r, i) => i + 1, { width: 56 });
    const name = col('name', 'Name', (r) => String(r.userName || r.name || '-'));
    const dp = col('dp', 'DP ID', (r) => (
      <CopyText
        value={String(
          isWithdrawal
            ? r.dp_id || r.Dp_ID || r.userId || ''
            : r.userId || r.dp_id || r.Dp_ID || '',
        )}
      />
    ));
    const app = col('app', 'App Code', (r) =>
      appCodeForName(
        r.clientName || r.appName || r.app_name || r.AppName || r.subDomain,
      ),
    );
    const mobile = col(
      'mobile',
      'Mobile No',
      (r) => {
        // admin-panel CallerDepositList: unique pending shows CallingBtn in Mobile column
        if (isUniquePending) {
          return (
            <CallingBtn
              item={toCallingItem(r)}
              campaignName="CALLER UNIQUE PENDING"
              reasonList="Caller Unique Pending"
              hideBotCall
            />
          );
        }
        return maskMobile(
          isWithdrawal ? r.mobile || r.userMobile : r.userMobile || r.mobile,
          canShowMobile,
        );
      },
      isUniquePending ? { width: 180, cellSx: { whiteSpace: 'normal' } } : undefined,
    );
    const created = col('created', 'Created At', (r) => {
      const raw = r.createdOn || r.createdAt || r.created_at;
      return formatDisplayDate(raw) || String(raw || '-');
    });
    const amount = col('amount', 'Amount', (r) =>
      formatAmount(r.amount || r.Amount),
    );
    const order = col('order', 'Order ID', (r) =>
      String(r.orderId || r.order_id || '-'),
    );
    const status = col('status', 'Status', (r) => String(r.status || '-'));

    if (isWithdrawal) {
      const cols: CommonTableColumn<CallerRow>[] = [
        sr,
        name,
        dp,
        app,
      ];
      if (!isCaller) {
        cols.push(
          col('ubank', 'User Bank Name', (r) => String(r.userBankName || '-')),
          col('acc', 'Account No', (r) =>
            String(r.accountNo || r.accountNumber || '-'),
          ),
          col('bank', 'Bank Name', (r) => String(r.bankName || '-')),
        );
      }
      cols.push(
        col('bonus', 'Bonus Laps', (r) => formatAmount(r.bonusLaps)),
        col('comm', 'Commission Amount', (r) =>
          formatAmount(r.commissionAmount),
        ),
      );
      if (!isCaller) {
        cols.push(
          col('check', 'Check By', (r) => renderCheckBy(r.checkBy ?? r.checkedBy), {
            cellSx: { whiteSpace: 'normal', minWidth: 170 },
          }),
          col(
            'cross',
            <>
              Cross
              <br />
              Check By
            </>,
            (r) => renderCheckBy(r.crossCheckBy ?? r.crossCheckedBy),
            { cellSx: { whiteSpace: 'normal', minWidth: 170 } },
          ),
        );
      }
      if (!isCaller) cols.push(mobile);
      cols.push(created, amount);
      if (!isCaller) cols.push(order);
      cols.push(status);
      return cols;
    }

    const cols: CommonTableColumn<CallerRow>[] = [
      sr,
      name,
      dp,
      app,
    ];
    // Unique Pending always shows Mobile + Call (even for callers)
    if (isUniquePending || !isCaller) cols.push(mobile);
    cols.push(created, amount);

    if (!isCaller) {
      cols.push(
        order,
        col('gateway', 'Payment Gateway Name', (r) =>
          String(r.paymentGatewayName || r.gateway || '-'),
        ),
      );
    }

    // Hide Payment Type from callers on Unique Pending only
    if (!(isCaller && isUniquePending)) {
      cols.push(
        col('ptype', 'Payment Type', (r) => String(r.paymentType || r.type || '-')),
      );
    }

    if (isUniquePending) {
      cols.push(
        col('state', 'State', (r) => String(r.state || r.userState || '-')),
        col('city', 'City', (r) => String(r.city || r.userCity || '-')),
        col('emp', 'Emp Code', (r) => String(r.empCode || '-')),
      );
      if (!isCaller) {
        cols.push(col('mid', 'Mid', (r) => String(r.mid || '-')));
      }
    }

    cols.push(status);
    return cols;
  }, [isWithdrawal, isUniquePending, isCaller, canShowMobile]);

  if (!list && !empCode) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {title}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No caller selected.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {!isWithdrawal && !isUniquePending && (
        <Typography variant="h5" fontWeight={700} mb={2}>
          {title} — {String(list?.subAdminName || empCode || '')}
        </Typography>
      )}

      {(isWithdrawal || isUniquePending) && (
        <CollapsibleFilterPanel
          title={`${title} — ${String(list?.subAdminName || empCode || '')}`}
          summary={`${startDate} → ${endDate}`}
          contentSx={{ overflow: 'auto' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="nowrap">
            {isWithdrawal && (
              <>
                <TextField
                  type="date"
                  label="From Date"
                  size="small"
                  fullWidth={false}
                  InputLabelProps={{ shrink: true }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{ width: 170, flexShrink: 0 }}
                />
                <TextField
                  type="date"
                  label="To Date"
                  size="small"
                  fullWidth={false}
                  InputLabelProps={{ shrink: true }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{ width: 170, flexShrink: 0 }}
                />
                <TextField
                  label="User Name"
                  size="small"
                  fullWidth={false}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPage(1);
                      void loadRemote();
                    }
                  }}
                  sx={{ width: 160, flexShrink: 0 }}
                />
                <TextField
                  select
                  label="Status"
                  size="small"
                  fullWidth={false}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  sx={{ width: 140, flexShrink: 0 }}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Cancel">Cancel</MenuItem>
                </TextField>
                <TextField
                  type="number"
                  label="Min Amount"
                  size="small"
                  fullWidth={false}
                  value={amountGte}
                  onChange={(e) => setAmountGte(e.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ width: 130, flexShrink: 0 }}
                />
                <TextField
                  type="number"
                  label="Max Amount"
                  size="small"
                  fullWidth={false}
                  value={amountLte}
                  onChange={(e) => setAmountLte(e.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ width: 130, flexShrink: 0 }}
                />
                <FormControlLabel
                  sx={{ flexShrink: 0, mr: 0 }}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Checked"
                />
              </>
            )}
            {isUniquePending && (
              <>
                <TextField
                  label="Mobile"
                  size="small"
                  fullWidth={false}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  sx={{ width: 160, flexShrink: 0 }}
                />
                <TextField
                  select
                  label="App Code"
                  size="small"
                  fullWidth={false}
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setPage(1);
                  }}
                  sx={{ width: 160, flexShrink: 0 }}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {appOptions.map((app) => (
                    <MenuItem key={app} value={app}>
                      {appCodeForName(app)}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
            <TextField
              select
              label="Items Per Page"
              size="small"
              fullWidth={false}
              value={String(itemsPerPage)}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setPage(1);
              }}
              sx={{ width: 140, flexShrink: 0 }}
            >
              {ITEMS_PER_PAGE_OPTIONS.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                setPage(1);
                void loadRemote();
              }}
              disabled={loading}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            >
              Search
            </Button>
            {loading && <CircularProgress size={22} />}
          </Stack>
          {isWithdrawal && (
            <Stack
              direction="row"
              spacing={3}
              alignItems="center"
              flexWrap="nowrap"
              sx={{ mt: 1.5, overflow: 'auto' }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                {`Total User (${withdrawalTotals.all.count ?? 0}) : ${formatAmount(
                  Number(withdrawalTotals.all.amount ?? 0),
                )}`}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                {`Approved Count (${withdrawalTotals.approved.count ?? 0}) : ${formatAmount(
                  Number(withdrawalTotals.approved.amount ?? 0),
                )}`}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                {`Canceled Count (${withdrawalTotals.cancel.count ?? 0}) : ${formatAmount(
                  Number(withdrawalTotals.cancel.amount ?? 0),
                )}`}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                {`Pending Count (${withdrawalTotals.pending.count ?? 0}) : ${formatAmount(
                  Number(withdrawalTotals.pending.amount ?? 0),
                )}`}
              </Typography>
            </Stack>
          )}
        </CollapsibleFilterPanel>
      )}

      <TablePanel
        footer={
          (isWithdrawal || isUniquePending) && totalPages > 1 ? (
            <>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
              />
            </>
          ) : undefined
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={depositRows}
          getRowKey={(r, i) => String(r._id || r.orderId || i)}
          loading={loading}
          emptyMessage="No records"
          minWidth={1100}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
