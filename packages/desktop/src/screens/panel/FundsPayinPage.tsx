import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { display, maskMobile } from '@/screens/panel/shared';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import {
  computeFundsDateSplitStats,
  getCreatedOn,
  getUpdatedOn,
  readFundsDrill,
  roundAmt,
  saveFundsDates,
} from '@/screens/panel/funds/utils';

type SummaryData = {
  mid?: string;
  totalAmount?: number;
  transactionAmount?: number;
  creditAmount?: number;
  debitAmount?: number;
};

type TxnRow = Record<string, unknown>;
type RequestType = 'automaticDeposit' | 'scanner add' | 'scanner remove';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  '&:hover': { bgcolor: '#e08c00' },
};

const kpiSx = {
  px: 1.5,
  py: 1,
  bgcolor: 'background.paper',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 1,
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: 'nowrap' as const,
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function asRowList(value: unknown): TxnRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TxnRow => !!item && typeof item === 'object' && !Array.isArray(item),
  );
}

function formatDateTime(value: unknown): string {
  if (value == null || value === '') return '-';
  try {
    return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
  } catch {
    return display(value);
  }
}

export function FundsPayinPage() {
  const location = useLocation();
  const drill = useMemo(
    () =>
      readFundsDrill(
        (location.state as {
          name?: string;
          mids?: unknown;
          startDate?: string;
          endDate?: string;
          midID?: string;
        } | null) || null,
      ),
    [location.state, location.key],
  );

  const mid = String(
    (location.state as { midID?: string } | null)?.midID || drill?.midID || '',
  ).trim();
  const startDate = drill?.startDate || '';
  const endDate = drill?.endDate || '';

  const [loading, setLoading] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('automaticDeposit');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [coins, setCoins] = useState<TxnRow[]>([]);
  const [debitCoins, setDebitCoins] = useState<TxnRow[]>([]);
  const [txnCount, setTxnCount] = useState(0);
  const [creditCount, setCreditCount] = useState(0);
  const [debitCount, setDebitCount] = useState(0);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  useEffect(() => {
    if (startDate && endDate) saveFundsDates(startDate, endDate);
  }, [startDate, endDate]);

  const applyPayload = useCallback((raw: unknown) => {
    const payload = unpackPayload(raw);
    const data =
      payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : {};
    const txnData =
      data.transactionData && typeof data.transactionData === 'object'
        ? (data.transactionData as Record<string, unknown>)
        : {};
    const coinData =
      data.coinData && typeof data.coinData === 'object'
        ? (data.coinData as Record<string, unknown>)
        : {};
    const debitData =
      data.debitCoinsData && typeof data.debitCoinsData === 'object'
        ? (data.debitCoinsData as Record<string, unknown>)
        : {};

    setSummary(
      payload.summary && typeof payload.summary === 'object'
        ? (payload.summary as SummaryData)
        : null,
    );
    setTransactions(asRowList(txnData.transactions));
    setCoins(asRowList(coinData.coins));
    setDebitCoins(asRowList(debitData.debitCoins));
    setTxnCount(Number(txnData.transactionCount ?? 0) || 0);
    setCreditCount(Number(coinData.creditCount ?? 0) || 0);
    setDebitCount(Number(debitData.debitCount ?? 0) || 0);
  }, []);

  const load = useCallback(async () => {
    if (!mid) return;
    setLoading(true);
    try {
      const requestOnce = () =>
        secureApi('funds.allPayment', {
          mid,
          startDate,
          endDate,
        });

      let res = await requestOnce();
      const timedOut =
        !res.ok &&
        /timeout|etimedout|econnaborted/i.test(String(res.message || ''));
      if (timedOut) {
        toast.info('Request timed out — retrying once…');
        res = await requestOnce();
      }

      if (!res.ok) {
        toast.error(
          res.message ||
            'Failed to load payin accounts. Try a shorter date range.',
        );
        setSummary(null);
        setTransactions([]);
        setCoins([]);
        setDebitCoins([]);
        return;
      }
      applyPayload(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payin accounts');
      setTransactions([]);
      setCoins([]);
      setDebitCoins([]);
    } finally {
      setLoading(false);
    }
  }, [mid, startDate, endDate, applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRows = useMemo(() => {
    if (requestType === 'scanner add') return coins;
    if (requestType === 'scanner remove') return debitCoins;
    return transactions;
  }, [requestType, coins, debitCoins, transactions]);

  const dateSplitStats = useMemo(
    () =>
      computeFundsDateSplitStats({
        startDate,
        endDate,
        transactions,
        credits: coins,
        debits: debitCoins,
      }),
    [startDate, endDate, transactions, coins, debitCoins],
  );

  const downloadExcel = () => {
    let rows: Record<string, unknown>[] = [];
    let sheetName = 'Automatic';

    if (requestType === 'automaticDeposit') {
      rows = transactions.map((r) => ({
        UserId: r.userId,
        Amount: r.amount,
        OrderID: r.orderId,
        UserName: r.userName,
        Status: r.status,
        UserMobile: r.userMobile,
        City: r.userCity,
        State: r.userState,
        UserBankName: r.userBankName,
        UserAccount: r.accountNumber,
        CreatedAt: formatDateTime(getCreatedOn(r)),
        UpdatedOn: formatDateTime(getUpdatedOn(r)),
      }));
    } else if (requestType === 'scanner add') {
      sheetName = 'ScannerAdd';
      rows = coins.map((r) => ({
        UserId: r.userId,
        Balance: r.balance,
        Reason: r.reason,
        Remark: r.remark,
        UTR: r.utr,
        UserName: r.userName,
        UserMobile: r.userMobile,
        CreatedAt: formatDateTime(getCreatedOn(r)),
        UpdatedOn: formatDateTime(getUpdatedOn(r)),
      }));
    } else {
      sheetName = 'ScannerRemove';
      rows = debitCoins.map((r) => ({
        UserId: r.userId,
        Balance: r.balance,
        Reason: r.reason,
        Remark: r.remark,
        UserName: r.userName,
        UserMobile: r.userMobile,
        CreatedAt: formatDateTime(getCreatedOn(r)),
        UpdatedOn: formatDateTime(getUpdatedOn(r)),
      }));
    }

    if (!rows.length) {
      toast.info('No data to export');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName.toLowerCase()}_${Date.now()}.xlsx`);
  };

  const indexCol = useMemo<CommonTableColumn<TxnRow>>(
    () => ({
      id: '#',
      label: '#',
      width: 72,
      cellSx: {
        overflow: 'visible',
        textOverflow: 'clip',
        whiteSpace: 'nowrap',
      },
      headSx: {
        overflow: 'visible',
        textOverflow: 'clip',
      },
      render: (_r, i) => i + 1,
    }),
    [],
  );

  const autoColumns = useMemo<CommonTableColumn<TxnRow>[]>(
    () => [
      indexCol,
      { id: 'amount', label: 'Amount', render: (r) => display(r.amount) },
      { id: 'orderId', label: 'OrderID', render: (r) => display(r.orderId) },
      { id: 'userName', label: 'UserName', render: (r) => display(r.userName) },
      { id: 'city', label: 'City', render: (r) => display(r.userCity) },
      { id: 'state', label: 'State', render: (r) => display(r.userState) },
      { id: 'bank', label: 'User Bank', render: (r) => display(r.userBankName) },
      {
        id: 'account',
        label: 'User Account',
        render: (r) => display(r.accountNumber),
      },
      {
        id: 'createdAt',
        label: 'Created At',
        render: (r) => formatDateTime(getCreatedOn(r)),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (r) => formatDateTime(getUpdatedOn(r)),
      },
    ],
    [indexCol],
  );

  const scannerColumns = useMemo<CommonTableColumn<TxnRow>[]>(
    () => [
      indexCol,
      { id: 'userId', label: 'UserId', render: (r) => display(r.userId) },
      { id: 'balance', label: 'Balance', render: (r) => display(r.balance) },
      { id: 'reason', label: 'Reason', render: (r) => display(r.reason) },
      { id: 'remark', label: 'Remark', render: (r) => display(r.remark) },
      ...(requestType === 'scanner add'
        ? [
            {
              id: 'utr',
              label: 'UTR',
              render: (r: TxnRow) => display(r.utr),
            } satisfies CommonTableColumn<TxnRow>,
          ]
        : []),
      { id: 'userName', label: 'UserName', render: (r) => display(r.userName) },
      {
        id: 'userMobile',
        label: 'Mobile',
        render: (r) => maskMobile(r.userMobile, canShowMobile),
      },
      {
        id: 'createdAt',
        label: 'Created At',
        render: (r) => formatDateTime(getCreatedOn(r)),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (r) => formatDateTime(getUpdatedOn(r)),
      },
    ],
    [requestType, indexCol, canShowMobile],
  );

  const columns =
    requestType === 'automaticDeposit' ? autoColumns : scannerColumns;

  if (!mid) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Funds — Payin
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No MID selected. Open a MID from the Funds MID list.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="h5" fontWeight={700}>
          Funds — {drill?.name ? `${display(drill.name)} / ${mid}` : mid}
        </Typography>
        <Button
          onClick={() => void load()}
          disabled={loading}
          sx={orangeBtnSx}
        >
          {loading ? 'Loading…' : 'Retry'}
        </Button>
      </Stack>

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.25}
        alignItems="center"
        mb={2}
        sx={{ '& > *': { flexShrink: 0 } }}
      >
        <Paper elevation={0} sx={kpiSx}>
          {mid}
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Total Amount: {roundAmt(summary?.totalAmount)}
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Today Total: {roundAmt(dateSplitStats.todayTotal)} (
          {dateSplitStats.todayCount})
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Previous Date Total: {roundAmt(dateSplitStats.previousTotal)} (
          {dateSplitStats.previousCount})
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Transaction Amount: {roundAmt(summary?.transactionAmount)} ({txnCount})
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Scanner Add: {roundAmt(summary?.creditAmount)} ({creditCount})
        </Paper>
        <Paper elevation={0} sx={kpiSx}>
          Scanner Remove: {roundAmt(summary?.debitAmount)} ({debitCount})
        </Paper>
        <Button
          startIcon={<DownloadIcon />}
          onClick={downloadExcel}
          sx={orangeBtnSx}
        >
          Download Excel
        </Button>
        <TextField
          fullWidth={false}
          select
          size="small"
          label="Payment Type"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as RequestType)}
          sx={{ width: 160 }}
        >
          <MenuItem value="automaticDeposit">Automatic</MenuItem>
          <MenuItem value="scanner add">Scanner add</MenuItem>
          <MenuItem value="scanner remove">Scanner remove</MenuItem>
        </TextField>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <CommonTable
        columns={columns}
        rows={activeRows}
        getRowKey={(row, i) => String(row._id || row.orderId || i)}
        loading={loading}
        emptyMessage="No data"
        minWidth={1200}
      />
    </Box>
  );
}
