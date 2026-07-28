import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatDisplayDate, formatDisplayTime, todayIST } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import {
  docsOf,
  type CoinRemovalRow,
  type CoinRemovalTxn,
  type CoinRemovalTxnListResponse,
} from './types';

type DetailsState = {
  user?: CoinRemovalRow;
  startDate?: string;
  endDate?: string;
  docs?: CoinRemovalTxn[];
};

export function CoinRemovalDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;

  const user = state.user;
  const startDate = state.startDate || todayIST();
  const endDate = state.endDate || todayIST();
  const seededDocs = useMemo(() => {
    if (state.docs?.length) return state.docs;
    return docsOf(user);
  }, [state.docs, user]);
  const hasSeededDocs = seededDocs.length > 0;

  const [rows, setRows] = useState<CoinRemovalTxn[]>(seededDocs);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;

  const load = useCallback(async (pageNo = 1) => {
    if (!user?._id) return;
    // Prefer nested docs from the list response when present.
    if (hasSeededDocs) {
      setRows(seededDocs);
      setTotalPages(1);
      return;
    }

    setLoading(true);
    try {
      const res = await secureApi<CoinRemovalTxnListResponse>(
        'users.getTransactionHistory',
        {
          itemsPerPage,
          pageNo,
          startDate,
          endDate,
          type: 'coin',
          filterDeposit: { userId: user._id },
          filterWithdrawal: { dp_id: user._id },
          filterCoin: {
            userId: user._id,
            tag: 'debit',
          },
        },
      );

      if (!res.ok) {
        toast.error(res.message || 'Failed to load coin removal details');
        setRows([]);
        setTotalPages(1);
        return;
      }

      const data = res.data || {};
      setRows(data.items || []);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
    } finally {
      setLoading(false);
    }
  }, [
    user?._id,
    startDate,
    endDate,
    itemsPerPage,
    hasSeededDocs,
    seededDocs,
  ]);

  useEffect(() => {
    if (!user?._id) return;
    void load(page);
  }, [user?._id, page, load]);

  const columns = useMemo<CommonTableColumn<CoinRemovalTxn>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'paymentType',
        label: 'Payment Type',
        render: (row) => row.paymentType || 'coins',
      },
      {
        id: 'userId',
        label: 'User Id',
        render: (row) =>
          row.userId ? <CopyText value={String(row.userId)} /> : '—',
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => row.balance ?? 0,
      },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) => row.updatedBy?.name || '—',
      },
      {
        id: 'reason',
        label: 'Reason',
        render: (row) => row.reason || '—',
      },
      {
        id: 'tag',
        label: 'Tag',
        render: (row) => row.tag || '—',
      },
      {
        id: 'remark',
        label: 'Remark',
        render: (row) => row.remark || row.remakr || '—',
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => formatDisplayDate(row.createdOn),
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => formatDisplayTime(row.createdOn),
      },
    ],
    [page, itemsPerPage],
  );

  if (!user?._id) {
    return (
      <Box>
        <Typography color="text.secondary" mb={2}>
          No user selected.
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/coin-removal')}
        >
          Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/coin-removal')}
          sx={{ flexShrink: 0 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {user.name || 'Coin Removal Details'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Id: {user._id}
            {user.city || user.state
              ? ` · ${[user.city, user.state].filter(Boolean).join(', ')}`
              : ''}
            {` · ${startDate} → ${endDate}`}
          </Typography>
        </Box>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, i) => String(row._id || i)}
        loading={loading}
        emptyMessage="No coin removal transactions found"
        minWidth={1100}
      />

      {!hasSeededDocs && (
        <Stack alignItems="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            color="secondary"
            onChange={(_e, next) => setPage(next)}
          />
        </Stack>
      )}

    </Box>
  );
}
