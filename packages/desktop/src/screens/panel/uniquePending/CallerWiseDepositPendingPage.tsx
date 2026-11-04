/**
 * Caller Wise Deposit Pending — full page (admin-panel modal parity, page UX).
 * Opened from Unique Deposit Pending with { startDate, endDate } in location.state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import {
  CALLER_WISE_HIGH_PENDING,
  buildCallerWiseUniquePending,
  buildUniquePendingSummaryPayload,
  extractUniquePendingList,
  filterCallerWisePendingItems,
  filterCallerWiseUniquePendingRows,
  sumCallerWiseUniquePendingTotals,
  type CallerWiseUniquePendingRow,
  type UniquePendingRow,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { TablePanel } from '@/components/TablePanel';
import { formatAmount, formatDisplayDate, formatDisplayTime, todayIST } from '@/utils/dates';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '@/utils/empCodeNameCache';
import { display } from '@/screens/panel/shared';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const headCellSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 800,
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
  borderBottom: '1px solid rgba(0,0,0,0.15)',
};

const cellSx = {
  fontSize: 12.5,
  whiteSpace: 'nowrap' as const,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

function TotalCards({
  callers,
  totals,
}: {
  callers: number;
  totals: ReturnType<typeof sumCallerWiseUniquePendingTotals>;
}) {
  const cards = [
    { label: 'Callers', value: callers.toLocaleString('en-IN'), color: '#60a5fa' },
    {
      label: 'Successful',
      value: `${totals.successful.toLocaleString('en-IN')} · ₹${formatAmount(totals.successfulAmount)}`,
      color: '#a78bfa',
    },
    {
      label: 'Pending',
      value: `${totals.pending.toLocaleString('en-IN')} · ₹${formatAmount(totals.pendingAmount)}`,
      color: '#ff9f0a',
    },
    {
      label: 'Approved',
      value: `${totals.approved.toLocaleString('en-IN')} · ₹${formatAmount(totals.approvedAmount)}`,
      color: '#16a34a',
    },
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
        gap: 1.25,
        mb: 1.5,
      }}
    >
      {cards.map((card) => (
        <Paper
          key={card.label}
          elevation={0}
          sx={{
            px: 1.5,
            py: 1.25,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: card.color,
            bgcolor: 'background.paper',
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: card.color, fontWeight: 800, letterSpacing: 0.3 }}
          >
            {card.label}
          </Typography>
          <Typography fontWeight={800} fontSize={14} mt={0.25}>
            {card.value}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}

export function CallerWiseDepositPendingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { startDate?: string; endDate?: string } | null) || null;
  const startDate = String(state?.startDate || '').trim() || todayIST();
  const endDate = String(state?.endDate || '').trim() || todayIST();

  const canShowMobile = hasPermission(Permissions.show_mobile);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CallerWiseUniquePendingRow[]>([]);
  const [pendingByEmpCode, setPendingByEmpCode] = useState<Record<string, UniquePendingRow[]>>({});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CallerWiseUniquePendingRow | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildUniquePendingSummaryPayload(startDate, endDate, {}, startDate);
      const [pendingRes, allRes, nameMap] = await Promise.all([
        secureApi('uniquePending.amountSummary', payload),
        secureApi('uniquePending.amountAllSummary', payload),
        getEmpCodeNameMap().catch(() => getCachedEmpCodeNameMap()),
      ]);
      if (!pendingRes.ok) {
        toast.error(pendingRes.message || 'Failed to load caller-wise pending');
        setRows([]);
        setPendingByEmpCode({});
        return;
      }
      if (!allRes.ok) {
        toast.error(allRes.message || 'Failed to load caller-wise summary');
        setRows([]);
        setPendingByEmpCode({});
        return;
      }
      const bundle = buildCallerWiseUniquePending(
        extractUniquePendingList(pendingRes.data),
        extractUniquePendingList(allRes.data),
        nameMap || {},
      );
      setRows(bundle.rows);
      setPendingByEmpCode(bundle.pendingByEmpCode);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => filterCallerWiseUniquePendingRows(rows, search),
    [rows, search],
  );
  const totals = useMemo(() => sumCallerWiseUniquePendingTotals(rows), [rows]);

  const selectedPending = selected ? pendingByEmpCode[selected.empCode] || [] : [];
  const filteredPending = useMemo(
    () =>
      filterCallerWisePendingItems(selectedPending, pendingSearch, {
        canShowMobile,
      }),
    [selectedPending, pendingSearch, canShowMobile],
  );
  const pendingAmountTotal = useMemo(
    () => filteredPending.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [filteredPending],
  );

  if (selected) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" gap={1} mb={1.5} flexWrap="wrap" useFlexGap>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              setSelected(null);
              setPendingSearch('');
            }}
            sx={{ ...orangeBtnSx, height: 36 }}
          >
            Back to Callers
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Pending Deposit List
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selected.empCode}
              {selected.callerName ? ` · ${selected.callerName}` : ''} · {startDate} → {endDate}
            </Typography>
          </Box>
        </Stack>

        <TotalCards
          callers={1}
          totals={{
            successful: selected.successful,
            successfulAmount: selected.successfulAmount,
            pending: selected.pending,
            pendingAmount: selected.pendingAmount,
            approved: selected.approved,
            approvedAmount: selected.approvedAmount,
          }}
        />

        <Stack direction="row" alignItems="center" gap={1} mb={1.5} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary" fontWeight={700}>
            Records: {filteredPending.length.toLocaleString('en-IN')} · Amount: ₹
            {formatAmount(pendingAmountTotal)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder={
              canShowMobile
                ? 'Search user, mobile, order id, gateway…'
                : 'Search user, order id, gateway…'
            }
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: pendingSearch ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setPendingSearch('')} edge="end">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Stack>

        <TablePanel>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  '#',
                  'User',
                  ...(canShowMobile ? ['Mobile'] : []),
                  'Amount',
                  'State / City',
                  'Order Id',
                  'App',
                  'Gateway',
                  'Status',
                  'Created',
                ].map((label) => (
                  <TableCell key={label} sx={headCellSx}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canShowMobile ? 10 : 9} align="center" sx={{ py: 3 }}>
                    No pending records
                  </TableCell>
                </TableRow>
              ) : (
                filteredPending.map((item, index) => {
                  const state = String(item.userState || item.state || '').trim();
                  const city = String(item.userCity || item.city || '').trim();
                  const gateway = String(item.paymentGatewayName || '').trim();
                  const mid = item.mid != null && item.mid !== '' ? String(item.mid) : '';
                  return (
                    <TableRow key={item._id || item.orderId || index}>
                      <TableCell sx={cellSx}>{index + 1}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 600 }}>
                        {display(item.userName)}
                      </TableCell>
                      {canShowMobile ? (
                        <TableCell sx={cellSx}>
                          {display(item.userMobile || item.mobile)}
                        </TableCell>
                      ) : null}
                      <TableCell sx={cellSx}>₹{formatAmount(item.amount)}</TableCell>
                      <TableCell sx={cellSx}>
                        {state || '—'}
                        {city ? ` / ${city}` : ''}
                      </TableCell>
                      <TableCell sx={cellSx}>{display(item.orderId)}</TableCell>
                      <TableCell sx={cellSx}>{display(item.clientName)}</TableCell>
                      <TableCell sx={cellSx}>
                        {gateway || mid ? (mid ? `${gateway || '—'} · ${mid}` : gateway) : '—'}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        {display(item.status) === '—' ? 'Pending' : display(item.status)}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        {item.createdOn
                          ? `${formatDisplayDate(item.createdOn)} · ${formatDisplayTime(item.createdOn)}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TablePanel>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1.5}
        mb={1.5}
        flexWrap="wrap"
        useFlexGap
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Caller Wise Deposit Pending
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {startDate} → {endDate}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <Button
            onClick={() => navigate('/unique_deposit_pending', { state: { startDate, endDate } })}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Back
          </Button>
          <Button
            onClick={() => void load()}
            disabled={loading}
            sx={orangeBtnSx}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <TotalCards callers={rows.length} totals={totals} />

      <Stack direction="row" alignItems="center" gap={1} mb={1.5} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          placeholder="Search emp code / caller"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} edge="end">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Stack>

      <TablePanel>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  '#',
                  'Emp Code',
                  'Caller',
                  'Successful',
                  'Successful Amt',
                  'Pending',
                  'Pending Amt',
                  'Approved',
                  'Approved Amt',
                ].map((label) => (
                  <TableCell key={label} sx={headCellSx}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    No caller deposit-pending data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, index) => (
                  <TableRow
                    key={`${row.empCode}-${index}`}
                    sx={
                      row.pending >= CALLER_WISE_HIGH_PENDING
                        ? { bgcolor: 'rgba(220,38,38,0.12)' }
                        : undefined
                    }
                  >
                    <TableCell sx={cellSx}>{index + 1}</TableCell>
                    <TableCell sx={{ ...cellSx, fontWeight: 700 }}>{row.empCode}</TableCell>
                    <TableCell sx={cellSx}>{row.callerName || '—'}</TableCell>
                    <TableCell sx={cellSx}>{row.successful.toLocaleString('en-IN')}</TableCell>
                    <TableCell sx={cellSx}>₹{formatAmount(row.successfulAmount)}</TableCell>
                    <TableCell sx={cellSx}>
                      {row.pending > 0 ? (
                        <Button
                          size="small"
                          onClick={() => {
                            setSelected(row);
                            setPendingSearch('');
                          }}
                          sx={{
                            ...orangeBtnSx,
                            minWidth: 0,
                            px: 1.25,
                            py: 0.25,
                            fontSize: 12,
                            height: 28,
                          }}
                        >
                          {row.pending.toLocaleString('en-IN')}
                        </Button>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>₹{formatAmount(row.pendingAmount)}</TableCell>
                    <TableCell sx={{ ...cellSx, fontWeight: 700 }}>
                      {row.approved.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell sx={{ ...cellSx, fontWeight: 700 }}>
                      ₹{formatAmount(row.approvedAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Box>
  );
}
