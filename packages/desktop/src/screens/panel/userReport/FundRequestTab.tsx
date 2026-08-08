import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { maskMobile } from '@/screens/panel/shared';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import {
  HISTORY_PAGINATION_SX,
  SearchFilter,
} from './historyFilters';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type FundType = 'deposit' | 'withdrawal' | 'coin';
type Props = { userId: string };

/** Fund Request — deposit columns match Laxmi (Payment Type … Date/Time). */
export function FundRequestTab({ userId }: Props) {
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [type, setType] = useState<FundType>('deposit');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  const [paymentType, setPaymentType] = useState('');
  const [amount, setAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderKeyId, setOrderKeyId] = useState('');
  const [gateway, setGateway] = useState('');
  const [mid, setMid] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        itemsPerPage: Number(itemsPerPage),
        pageNo: page,
        type,
      };

      if (type === 'deposit') {
        const filterDeposit: Record<string, string> = {
          userId: String(userId),
        };
        if (paymentType.trim()) filterDeposit.paymentType = paymentType.trim();
        if (amount.trim()) filterDeposit.amount = amount.trim();
        if (orderId.trim()) filterDeposit.orderId = orderId.trim();
        if (orderKeyId.trim()) filterDeposit.orderKeyId = orderKeyId.trim();
        if (gateway.trim()) filterDeposit.paymentGatewayName = gateway.trim();
        if (mid.trim()) filterDeposit.mid = mid.trim();
        payload.filterDeposit = filterDeposit;
      } else if (type === 'withdrawal') {
        payload.filterWithdrawal = { dp_id: String(userId) };
      } else {
        payload.filterCoin = { userId: String(userId) };
      }

      const res = await secureApi('userReport.transactionHistory', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load fund requests');
        setRows([]);
        return;
      }
      const data = (res.data || {}) as {
        payload?: { items?: HistoryRow[]; totalPages?: number };
        items?: HistoryRow[];
        totalPages?: number;
      };
      const nested = data.payload || data;
      setRows((nested.items as HistoryRow[]) || []);
      setTotalPages(Math.max(1, Number(nested.totalPages) || 1));
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    gateway,
    itemsPerPage,
    mid,
    orderId,
    orderKeyId,
    page,
    paymentType,
    type,
    userId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = () => {
    if (page !== 1) setPage(1);
    else void load();
  };

  const columns = useMemo<CommonTableColumn<HistoryRow>[]>(() => {
    if (type === 'deposit') {
      return [
        {
          id: 'pay',
          label: 'Payment Type',
          filter: (
            <SearchFilter
              value={paymentType}
              onChange={setPaymentType}
              onSearch={search}
              placeholder="Payment type"
            />
          ),
          render: (r) => String(r.paymentType || r.type || '-'),
        },
        {
          id: 'amt',
          label: 'Amount',
          filter: (
            <SearchFilter
              value={amount}
              onChange={setAmount}
              onSearch={search}
              placeholder="Amount"
            />
          ),
          render: (r) => formatAmount(r.amount ?? 0),
        },
        {
          id: 'order',
          label: 'Order Id',
          filter: (
            <SearchFilter
              value={orderId}
              onChange={setOrderId}
              onSearch={search}
              placeholder="Order id"
            />
          ),
          render: (r) => String(r.orderId || r.order_id || '-'),
        },
        {
          id: 'orderKey',
          label: 'Order Key Id',
          filter: (
            <SearchFilter
              value={orderKeyId}
              onChange={setOrderKeyId}
              onSearch={search}
              placeholder="Order key id"
            />
          ),
          render: (r) => String(r.orderKeyId || '-'),
        },
        {
          id: 'gw',
          label: 'Payment Gateway Name',
          filter: (
            <SearchFilter
              value={gateway}
              onChange={setGateway}
              onSearch={search}
              placeholder="Gateway"
            />
          ),
          render: (r) => String(r.paymentGatewayName || r.gateway || '-'),
        },
        {
          id: 'mid',
          label: 'Mid',
          filter: (
            <SearchFilter
              value={mid}
              onChange={setMid}
              onSearch={search}
              placeholder="Mid"
            />
          ),
          render: (r) => String(r.mid || '-'),
        },
        {
          id: 'name',
          label: 'User Name',
          filter: null,
          render: (r) => String(r.userName || r.name || '-'),
        },
        {
          id: 'status',
          label: 'Status',
          filter: null,
          render: (r) => String(r.status || '-'),
        },
        {
          id: 'email',
          label: 'User Email',
          filter: null,
          render: (r) => String(r.email || r.userEmail || '-'),
        },
        {
          id: 'mobile',
          label: 'User Mobile',
          filter: null,
          render: (r) => maskMobile(r.mobile || r.userMobile, canShowMobile),
        },
        {
          id: 'city',
          label: 'User City',
          filter: null,
          render: (r) => String(r.city || r.userCity || '-'),
        },
        {
          id: 'state',
          label: 'User State',
          filter: null,
          render: (r) => String(r.state || r.userState || '-'),
        },
        {
          id: 'lat',
          label: 'Latitude',
          filter: null,
          render: (r) => String(r.latitude || '-'),
        },
        {
          id: 'lng',
          label: 'Longitude',
          filter: null,
          render: (r) => String(r.longitude || '-'),
        },
        {
          id: 'by',
          label: 'Updated By',
          filter: null,
          render: (r) =>
            String(
              (r.updatedBy as { name?: string } | undefined)?.name ||
                r.updatedBy ||
                '-',
            ),
        },
        {
          id: 'date',
          label: 'Date',
          filter: null,
          render: (r) =>
            formatDisplayDate(r.createdOn || r.createdAt || r.updatedOn) || '-',
        },
        {
          id: 'time',
          label: 'Time',
          filter: null,
          render: (r) =>
            formatDisplayTime(r.createdOn || r.createdAt || r.updatedOn) || '-',
        },
      ];
    }

    if (type === 'withdrawal') {
      return [
        {
          id: 'pay',
          label: 'Payment Type',
          filter: null,
          render: (r) => String(r.paymentType || r.type || '-'),
        },
        {
          id: 'dp',
          label: 'dp_id',
          filter: null,
          render: (r) => String(r.dp_id || r.userId || '-'),
        },
        {
          id: 'amt',
          label: 'amount',
          filter: null,
          render: (r) => formatAmount(r.amount ?? 0),
        },
        {
          id: 'status',
          label: 'status',
          filter: null,
          render: (r) => String(r.status || '-'),
        },
        {
          id: 'txn',
          label: 'TransactionId',
          filter: null,
          render: (r) => String(r.transactionId || r.orderId || '-'),
        },
        {
          id: 'mobile',
          label: 'mobile',
          filter: null,
          render: (r) => maskMobile(r.mobile, canShowMobile),
        },
        {
          id: 'acc',
          label: 'accountNo',
          filter: null,
          render: (r) => String(r.accountNo || '-'),
        },
        {
          id: 'holder',
          label: 'accountHolderName',
          filter: null,
          render: (r) => String(r.accountHolderName || '-'),
        },
        {
          id: 'order',
          label: 'orderId',
          filter: null,
          render: (r) => String(r.orderId || '-'),
        },
        {
          id: 'ifsc',
          label: 'IfscCode',
          filter: null,
          render: (r) => String(r.ifsc || r.IfscCode || '-'),
        },
        {
          id: 'ubank',
          label: 'userBankName',
          filter: null,
          render: (r) => String(r.userBankName || '-'),
        },
        {
          id: 'bank',
          label: 'bankName',
          filter: null,
          render: (r) => String(r.bankName || '-'),
        },
        {
          id: 'provider',
          label: 'withdrewalProviderName',
          filter: null,
          render: (r) => String(r.withdrewalProviderName || '-'),
        },
        {
          id: 'comm',
          label: 'CommissionAmount',
          filter: null,
          render: (r) => formatAmount(r.CommissionAmount ?? r.commission ?? 0),
        },
        {
          id: 'date',
          label: 'Date',
          filter: null,
          render: (r) => formatDisplayDate(r.createdOn || r.createdAt) || '-',
        },
        {
          id: 'time',
          label: 'Time',
          filter: null,
          render: (r) => formatDisplayTime(r.createdOn || r.createdAt) || '-',
        },
      ];
    }

    return [
      {
        id: 'pay',
        label: 'Payment Type',
        filter: null,
        render: (r) => String(r.paymentType || r.type || '-'),
      },
      {
        id: 'uid',
        label: 'userId',
        filter: null,
        render: (r) => String(r.userId || '-'),
      },
      {
        id: 'bal',
        label: 'balance',
        filter: null,
        render: (r) => formatAmount(r.balance ?? r.amount ?? 0),
      },
      {
        id: 'by',
        label: 'updatedBy Name',
        filter: null,
        render: (r) =>
          String(
            (r.updatedBy as { name?: string } | undefined)?.name ||
              r.updatedBy ||
              '-',
          ),
      },
      {
        id: 'reason',
        label: 'reason',
        filter: null,
        render: (r) => String(r.reason || '-'),
      },
      {
        id: 'tag',
        label: 'tag',
        filter: null,
        render: (r) => String(r.tag || '-'),
      },
      {
        id: 'remark',
        label: 'remark',
        filter: null,
        render: (r) => String(r.remark || '-'),
      },
      {
        id: 'date',
        label: 'date',
        filter: null,
        render: (r) => formatDisplayDate(r.createdOn || r.createdAt) || '-',
      },
      {
        id: 'time',
        label: 'time',
        filter: null,
        render: (r) => formatDisplayTime(r.createdOn || r.createdAt) || '-',
      },
    ];
  }, [amount, gateway, mid, orderId, orderKeyId, paymentType, type, canShowMobile]);

  const typeBtn = (id: FundType, label: string) => (
    <Button
      key={id}
      variant="contained"
      color="inherit"
      disableElevation
      disableRipple
      onClick={() => {
        setType(id);
        setPage(1);
      }}
      sx={{
        ...laxmiActionBtnSx('white'),
        bgcolor: type === id ? '#1565c0' : '#1976d2',
        textTransform: 'none',
      }}
    >
      {toDisplayText(label)}
    </Button>
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
        {typeBtn('deposit', 'Deposit')}
        {typeBtn('withdrawal', 'Withdrawal')}
        {typeBtn('coin', 'Coins')}
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="flex-end" mb={2}>
        <TextField
          select
          size="small"
          label="Items Per Page"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(e.target.value);
            setPage(1);
          }}
          sx={{ bgcolor: '#fff', minWidth: 120 }}
          InputLabelProps={{ shrink: true }}
        >
          {['20', '50', '100', '250'].map((o) => (
            <MenuItem key={o} value={o}>
              {o}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={laxmiActionBtnSx('white')}
          onClick={search}
        >
          Search
        </Button>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No fund requests"
        minWidth={type === 'deposit' ? 1600 : 1200}
        dense
      />

      {totalPages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            sx={HISTORY_PAGINATION_SX}
          />
        </Stack>
      )}
    </Box>
  );
}
