import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { display, maskMobile } from '@/screens/panel/shared';

type CustomerRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  email?: string;
  city?: string;
  state?: string;
  clientName?: string;
  kyc?: boolean;
};

type LocationState = { id?: string };

const PER_PAGE_OPTIONS = [250, 500, 750, 1000, 2000];

const fieldSx = {
  minWidth: 140,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

function unpackPlayers(raw: unknown): { items: CustomerRow[]; totalPages: number } {
  if (!raw || typeof raw !== 'object') return { items: [], totalPages: 1 };
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  const players = nested.players ?? nested.items ?? obj.players;
  const items = Array.isArray(players) ? (players as CustomerRow[]) : [];
  return {
    items,
    totalPages: Math.max(1, Number(nested.totalPages ?? obj.totalPages) || 1),
  };
}

export function LeaderboardCustomerCountPage() {
  const location = useLocation();
  const callerId = (location.state as LocationState | null)?.id;

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(500);
  const [clientName, setClientName] = useState('All');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const hideContact = hasPermission('contact_visibility_none');
  const canShowMobile = hasPermission('show_mobile');

  const load = useCallback(async () => {
    if (!callerId) return;
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<unknown>('leaderboard.callerUsers', {
        _id: callerId,
        itemsPerPage,
        pageNo: page,
        clientName: clientName === 'All' ? '' : clientName,
      });
      if (!isCurrent(gen)) return;
      if (!res.ok) {
        toast.error(res.message || 'Failed to load customers');
        setRows([]);
        return;
      }
      const packed = unpackPlayers(res.data);
      setRows(packed.items);
      setTotalPages(packed.totalPages);
    } finally {
      if (isCurrent(gen)) {
        setLoading(false);
        end();
      }
    }
  }, [callerId, itemsPerPage, page, clientName, next, isCurrent, begin, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<CustomerRow>[]>(() => {
    const cols: CommonTableColumn<CustomerRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      { id: 'name', label: 'Name', render: (row) => display(row.name) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
    ];

    if (!hideContact) {
      cols.push({
        id: 'mobile',
        label: 'Mobile',
        render: (row) => {
          const mobile = String(row.mobile || '');
          if (!canShowMobile) return maskMobile(mobile, false);
          return mobile ? <CopyText value={mobile} /> : '—';
        },
      });
    }

    cols.push(
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'state', label: 'State', render: (row) => display(row.state) },
      {
        id: 'clientName',
        label: 'Client Name',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'kyc',
        label: 'Kyc',
        render: (row) => (row.kyc ? 'Completed' : 'Not Completed'),
      },
    );

    return cols;
  }, [page, itemsPerPage, hideContact, canShowMobile]);

  if (!callerId) {
    return <Navigate to="/leaderboard" replace />;
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 1.5 }}>
      <Paper sx={{ width: '100%', p: 1.5, mb: 1.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        >
          <TextField
            select
            size="small"
            label="Items Per"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1);
            }}
            sx={fieldSx}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Search by client name"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setPage(1);
            }}
            sx={fieldSx}
          >
            <MenuItem value="All">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)} ({name})
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TablePanel
          footerJustify="center"
          footer={
            <Pagination
              count={totalPages}
              page={page}
              color="secondary"
              onChange={(_e, nextPage) => setPage(nextPage)}
            />
          }
        >
          <CommonTable
            columns={columns}
            rows={rows}
            getRowKey={(row, index) => row._id || `${index}`}
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
