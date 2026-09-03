import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission } from '@/auth/permissions';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { display, maskMobile } from '@/screens/panel/shared';
import { providerWiseActive, toNum } from '@/screens/panel/dashboards/ops/mergeMetrics';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { formatAmount, todayIST } from '@/utils/dates';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  state?: string;
  city?: string;
  balance?: number;
  kyc?: boolean;
  [key: string]: unknown;
};

type NavState = {
  startDate?: string;
  endDate?: string;
  customerKey?: string;
  appClientName?: string;
};

/**
 * Provider-wise active players list — port of laxminarayan ActiveUserData.
 * Opened from dashboard card player-count links.
 */
export function ActiveUserDataPage() {
  const location = useLocation();
  const nav = (location.state || {}) as NavState;
  const customerKey = String(nav.customerKey || '').trim();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [startDate, setStartDate] = useState(() => nav.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => nav.endDate || todayIST());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    if (!customerKey) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const filter: Record<string, unknown> = {};
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: 50,
        pageNo: page,
        activeUserStart: startDate,
        activeUserEnd: endDate,
        filter,
      };
      if (nav.appClientName) {
        filter.clientName = nav.appClientName;
        payload.app = [nav.appClientName];
      }

      const res = await secureApi('dashboard.activeCustomersCategory', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load active users');
        setRows([]);
        setTotalPages(1);
        return;
      }

      const providerWise = providerWiseActive(res.data);
      const keyLower = customerKey.toLowerCase();
      const entry =
        (providerWise[customerKey] as Record<string, unknown> | undefined) ||
        (Object.entries(providerWise).find(([k]) => k.toLowerCase() === keyLower)?.[1] as
          Record<string, unknown> | undefined) ||
        {};

      const list = Array.isArray(entry.list) ? (entry.list as UserRow[]) : [];
      setRows(list);
      setTotalPages(Math.max(1, toNum(entry.totalPages) || 1));
    } finally {
      setLoading(false);
    }
  }, [customerKey, endDate, nav.appClientName, page, startDate]);

  useEffect(() => {
    setPage(1);
  }, [customerKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<UserRow>[]>(
    () => [
      { id: 'name', label: 'Name', render: (r) => display(r.name) },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      { id: 'state', label: 'State', render: (r) => display(r.state) },
      { id: 'city', label: 'City', render: (r) => display(r.city) },
      {
        id: 'balance',
        label: 'Balance',
        render: (r) => formatAmount(r.balance ?? 0),
      },
      {
        id: 'kyc',
        label: 'KYC',
        render: (r) => (r.kyc ? 'Yes' : 'No'),
      },
    ],
    [canShowMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {!customerKey && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography color="text.secondary">
            Open this screen from a provider card player count.
          </Typography>
        </Paper>
      )}

      <CollapsibleFilterPanel
        title={toDisplayText('Active User Data')}
        summary={`${toDisplayText(customerKey || 'provider')} · ${startDate} → ${endDate}`}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'flex-end' }}
        >
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setPage(1);
              void load();
            }}
            disabled={loading || !customerKey}
          >
            Apply
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      {loading ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      ) : (
        <TablePanel
          footerJustify="center"
          footer={
            totalPages > 1 ? (
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
              />
            ) : undefined
          }
        >
          <CommonTable
            columns={columns}
            rows={rows}
            getRowKey={(r, i) => String(r._id || i)}
            emptyMessage="No Data Found"
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
