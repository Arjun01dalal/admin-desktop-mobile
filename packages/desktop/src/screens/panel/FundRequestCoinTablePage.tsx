import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { asPaged, display, maskMobile } from '@/screens/panel/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';

export type FundRequestCoinNavState = {
  reason?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  allData?: boolean;
  userId?: string;
};

type CoinDetailRow = {
  _id?: string;
  userId?: string;
  userName?: string;
  email?: string;
  mobile?: string;
  balance?: number | string;
  utr?: string;
  reason?: string;
  remark?: string;
  tag?: string;
  createdOn?: string;
  updatedBy?: { name?: string };
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];

function titleFor(reason?: string, tag?: string): string {
  const r = String(reason || '').trim();
  const isCredit = String(tag || '').toLowerCase() === 'credit';
  if (r === 'Casino') return isCredit ? 'Total Casino Deposit' : 'Total Casino Pull';
  if (r === 'Exchange') return isCredit ? 'Total Jetfair Deposit' : 'Total Jetfair Pull';
  if (r === 'Satta Matka') {
    return isCredit ? 'Total Satta Matka Deposit' : 'Total Satta Matka Pull';
  }
  if (r && isCredit) return `${r} Deposit`;
  if (r) return `${r} Pull`;
  return 'Coin Detail';
}

/** Laxmi `/fundreq-table` — coin/detail rows for Casino / Jetfair / Satta Matka KPIs. */
export function FundRequestCoinTablePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as FundRequestCoinNavState;

  const reason = String(navState.reason || '').trim();
  const tag = String(navState.tag || '').trim();
  const allData = Boolean(navState.allData);
  const startDate = String(navState.startDate || '').trim();
  const endDate = String(navState.endDate || '').trim();
  const userId = String(navState.userId || '').trim();

  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [rows, setRows] = useState<CoinDetailRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!reason || !tag) {
      setRows([]);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    try {
      const filters: Record<string, string> = { reason, tag };
      if (userId) filters.userId = userId;
      if (!allData) {
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
      }

      const res = await secureApi('fundRequests.coinDetail', {
        pageNo: page,
        itemPerPage: itemsPerPage,
        filters,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load coin details');
        setRows([]);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<CoinDetailRow>(res.data);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      setLoading(false);
    }
  }, [reason, tag, userId, allData, startDate, endDate, page, itemsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const openUserReport = useCallback(
    (row: CoinDetailRow) => {
      const id = String(row.userId || row._id || '').trim();
      if (!id) return;
      navigate(`/users/report/${encodeURIComponent(id)}/${encodeURIComponent(row.userName || '')}`);
    },
    [navigate],
  );

  const columns = useMemo<CommonTableColumn<CoinDetailRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 50,
        render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openUserReport(row)}
            sx={{ cursor: 'pointer', fontWeight: 600, color: '#ff9f0a' }}
          >
            {display(row.userName)}
          </Box>
        ),
      },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'mobile',
        label: 'Mobile No',
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'balance', label: 'Amount', render: (row) => display(row.balance) },
      { id: 'utr', label: 'UTR', render: (row) => display(row.utr) },
      { id: 'reason', label: 'Reason', render: (row) => display(row.reason) },
      { id: 'remark', label: 'Remark', render: (row) => display(row.remark) },
      {
        id: 'tag',
        label: 'Tag',
        render: (row) =>
          String(row.tag || '').toLowerCase() === 'credit' ? 'Deposit' : 'Debit',
      },
      {
        id: 'givenBy',
        label: 'Given By',
        render: (row) => display(row.updatedBy?.name),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => {
          const d = formatDisplayDate(row.createdOn);
          const t = formatDisplayTime(row.createdOn);
          if (!d && !t) return '—';
          return t ? `${d} ${t}` : d;
        },
      },
    ],
    [page, itemsPerPage, canShowMobile, openUserReport],
  );

  const title = toDisplayText(titleFor(reason, tag));

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <TextField
          select
          size="small"
          label="Items / Page"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value) || 10);
            setPage(1);
          }}
          sx={{ width: 140 }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {!reason || !tag ? (
        <Typography color="text.secondary">Missing coin filter. Go back to Fund Request.</Typography>
      ) : (
        <TablePanel
          footer={
            <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
              <Typography variant="body2" color="text.secondary">
                Page {page} / {totalPages}
              </Typography>
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
                size="small"
              />
            </Stack>
          }
        >
          <CommonTable
            columns={columns}
            rows={rows}
            loading={loading}
            getRowKey={(row, i) => String(row._id || `${i}`)}
            emptyMessage="No coin records"
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
