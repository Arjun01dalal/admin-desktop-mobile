import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  canShowCallerWiseUniquePending,
  canShowUniqueDepositEmpCode,
  hasPermission,
} from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { TablePanel } from '@/components/TablePanel';
import {
  buildDepositWhatsAppMessage,
  parseDistinctMidOptions,
  UNIQUE_PENDING_POLL_MS,
  assembleUniquePendingSummary,
  buildUniquePendingSummaryPayload,
  filterUniquePendingDisplay,
  paginateUniquePendingRows,
  uniquePendingPaymentMethod,
  uniquePendingStatusColor,
  type UniquePendingRow,
  type UniquePendingRegion,
  type UniquePendingByStateRow,
  type UniquePendingBucket,
  type UniquePendingGatewayCount,
} from '@astro/shared';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { display } from '@/screens/panel/shared';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '@/utils/empCodeNameCache';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import { SheetDownloadOtpModal } from '@/components/SheetDownloadOtpModal';
import { saveWorkbook } from '@/utils/downloadSheet';
import type { UserRow } from '@/screens/panel/users/utils';

type ColumnFilters = {
  userId: string;
  amount: string;
  state: string;
  city: string;
  clientName: string;
  mid: string;
  empCode: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  filters: ColumnFilters;
};

const EMPTY_FILTERS: ColumnFilters = {
  userId: '',
  amount: '',
  state: '',
  city: '',
  clientName: '',
  mid: '',
  empCode: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  flexShrink: 0,
  minWidth: 'fit-content',
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const actionBtnSx = {
  ...orangeBtnSx,
  height: 28,
  fontSize: 11,
  px: 1,
  py: 0.25,
};

const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

const byStateHeadSx: SxProps<Theme> = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 800,
  border: '1px solid rgba(0,0,0,0.2)',
  whiteSpace: 'nowrap',
};

const byStateSubHeadSx: SxProps<Theme> = {
  bgcolor: '#2c3340',
  color: '#e8e8ea',
  fontWeight: 700,
  fontSize: 11.5,
  border: '1px solid rgba(255,255,255,0.12)',
  whiteSpace: 'nowrap',
};

const byStateCellSx: SxProps<Theme> = {
  fontSize: 12.5,
  border: '1px solid rgba(255,255,255,0.1)',
  whiteSpace: 'nowrap',
};

function byStateGroupHeadSx(color: string): SxProps<Theme> {
  return {
    bgcolor: `${color} !important`,
    color: '#fff !important',
    fontWeight: 800,
    border: '1px solid rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
  };
}

/** Total / Pending / Approved — Requests, Amount, Customers cards above the table. */
function SummaryCards({
  all,
  pending,
  approved,
}: {
  all: UniquePendingBucket;
  pending: UniquePendingBucket;
  approved: UniquePendingBucket;
}) {
  const cards: Array<{ label: string; bucket: UniquePendingBucket; color: string }> = [
    { label: 'Total (All)', bucket: all, color: '#60a5fa' },
    { label: 'Pending', bucket: pending, color: '#ff9f0a' },
    { label: 'Approved', bucket: approved, color: '#16a34a' },
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        gap: 1.25,
        mb: 1.5,
      }}
    >
      {cards.map((card) => (
        <Box
          key={card.label}
          sx={{
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: card.color,
            bgcolor: 'background.paper',
            px: 1.5,
            py: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: card.color, fontWeight: 800, letterSpacing: 0.4 }}
          >
            {card.label.toUpperCase()}
          </Typography>
          <Stack direction="row" spacing={2.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Requests
              </Typography>
              <Typography fontWeight={700}>{card.bucket.uniqueRequestCount}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Amount
              </Typography>
              <Typography fontWeight={700}>{formatAmount(card.bucket.totalAmount)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Customers
              </Typography>
              <Typography fontWeight={700}>{card.bucket.uniqueCustomerCount}</Typography>
            </Box>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

/** Clickable South / North region cards — toggle off when the same one is clicked again. */
function RegionCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        cursor: 'pointer',
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: active ? '#ff9f0a' : 'divider',
        bgcolor: active ? 'rgba(255,159,10,0.18)' : 'background.paper',
        px: 1.75,
        py: 1,
        minWidth: 110,
        textAlign: 'center',
        userSelect: 'none',
        '&:hover': { borderColor: '#ff9f0a' },
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        variant="subtitle1"
        fontWeight={800}
        sx={{ color: active ? '#ff9f0a' : 'text.primary' }}
      >
        {count}
      </Typography>
    </Box>
  );
}

/** Gateway chips with counts — click toggles the gateway display filter. */
function GatewayChips({
  counts,
  active,
  onToggle,
  onClear,
}: {
  counts: UniquePendingGatewayCount[];
  active: string;
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  if (!counts.length) return null;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
      {counts.map((item) => {
        const isActive = active === item.name;
        return (
          <Chip
            key={item.name}
            label={`${item.name} (${item.count})`}
            onClick={() => onToggle(item.name)}
            sx={{
              fontWeight: 700,
              border: '1px solid #ff9f0a',
              color: isActive ? '#1a1200' : '#ff9f0a',
              bgcolor: isActive ? '#ff9f0a' : 'transparent',
              '&:hover': { bgcolor: isActive ? '#e08c00' : 'rgba(255,159,10,0.12)' },
            }}
          />
        );
      })}
      {active ? (
        <Chip
          label="Clear gateway"
          onClick={onClear}
          variant="outlined"
          sx={{ fontWeight: 700, color: 'text.secondary' }}
        />
      ) : null}
    </Stack>
  );
}

/** "By State" dialog — State / Total / Pending / Approved (Req, Amt, Cust). */
function ByStateDialog({
  open,
  onClose,
  rows,
  activeState,
  onSelectState,
}: {
  open: boolean;
  onClose: () => void;
  rows: UniquePendingByStateRow[];
  activeState: string;
  onSelectState: (state: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>By State</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ overflow: 'auto', maxHeight: '70vh', pb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} align="center" sx={byStateHeadSx}>
                  State
                </TableCell>
                <TableCell colSpan={3} align="center" sx={byStateGroupHeadSx('#60a5fa')}>
                  Total
                </TableCell>
                <TableCell colSpan={3} align="center" sx={byStateGroupHeadSx('#ff9f0a')}>
                  Pending
                </TableCell>
                <TableCell colSpan={3} align="center" sx={byStateGroupHeadSx('#16a34a')}>
                  Approved
                </TableCell>
              </TableRow>
              <TableRow>
                {['Req', 'Amt', 'Cust', 'Req', 'Amt', 'Cust', 'Req', 'Amt', 'Cust'].map(
                  (label, i) => (
                    <TableCell key={`${label}-${i}`} align="center" sx={byStateSubHeadSx}>
                      {label}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={byStateCellSx}>
                    No state-wise data
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const active =
                    Boolean(activeState) &&
                    row.state.trim().toLowerCase() === activeState.trim().toLowerCase();
                  return (
                    <TableRow
                      key={row.state}
                      hover
                      onClick={() => onSelectState(row.state)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: active ? 'rgba(255,159,10,0.16)' : undefined,
                      }}
                    >
                      <TableCell align="center" sx={byStateCellSx}>
                        <Typography
                          fontWeight={active ? 800 : 600}
                          sx={{ color: active ? '#ff9f0a' : 'inherit', fontSize: 'inherit' }}
                        >
                          {row.state}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.allUniqueRequestCount}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {formatAmount(row.allTotalAmount)}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.allUniqueCustomerCount}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.uniqueRequestCount}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {formatAmount(row.totalAmount)}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.uniqueCustomerCount}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.approvedTxnCount}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {formatAmount(row.approvedTotalAmount)}
                      </TableCell>
                      <TableCell align="center" sx={byStateCellSx}>
                        {row.approvedCustomerCount}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UniqueDepositPendingPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    mobile?: string;
    accessibleStates?: string[];
  }>();
  const canShowEmpCode = canShowUniqueDepositEmpCode(admin);
  const canChangeStatus = hasPermission('change_status');
  const canDownload = hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canCallerWise = canShowCallerWiseUniquePending(admin);
  const today = todayIST();

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    filters: EMPTY_FILTERS,
  });

  const [loading, setLoading] = useState(true);
  const [pendingSummaryData, setPendingSummaryData] = useState<unknown>(null);
  const [allSummaryData, setAllSummaryData] = useState<unknown>(null);

  const [gatewayFilter, setGatewayFilter] = useState('');
  const [region, setRegion] = useState<UniquePendingRegion>('');
  const [byStateOpen, setByStateOpen] = useState(false);
  const [midOptions, setMidOptions] = useState<string[]>([]);

  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusOrderId, setStatusOrderId] = useState('');
  const [statusRemark, setStatusRemark] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  useEffect(() => {
    if (!canShowEmpCode) return;
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, [canShowEmpCode]);

  // Load distinct MIDs once (client-side select options for the MID filter).
  useEffect(() => {
    let active = true;
    void secureApi('uniquePending.mids', {}).then((res) => {
      if (!active || !res.ok) return;
      setMidOptions(parseDistinctMidOptions(res.data));
    });
    return () => {
      active = false;
    };
  }, []);

  const buildPayload = useCallback(() => {
    const f = query.filters;
    return buildUniquePendingSummaryPayload(
      query.startDate,
      query.endDate,
      {
        userId: f.userId,
        state: f.state,
        city: f.city,
        clientName: f.clientName,
        mid: f.mid,
        amount: f.amount,
      },
      todayIST(),
    );
  }, [query]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) setLoading(true);
      try {
        const payload = buildPayload();
        const [pendingRes, allRes] = await Promise.all([
          secureApi('uniquePending.amountSummary', payload),
          secureApi('uniquePending.amountAllSummary', payload),
        ]);
        if (!pendingRes.ok) {
          if (!silent) toast.error(pendingRes.message || 'Failed to load unique pending deposits');
          return;
        }
        if (!allRes.ok) {
          if (!silent) toast.error(allRes.message || 'Failed to load unique pending deposits');
          return;
        }
        setPendingSummaryData(pendingRes.data);
        setAllSummaryData(allRes.data);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [buildPayload],
  );

  /** Keep a ref to the latest load() so the silent poll interval never closes over stale state. */
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadRef.current({ silent: true });
    }, UNIQUE_PENDING_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(
    () =>
      assembleUniquePendingSummary({
        pendingData: pendingSummaryData,
        allData: allSummaryData,
        accessibleStates: admin?.accessibleStates,
        empCode: canShowEmpCode ? query.filters.empCode : '',
      }),
    [pendingSummaryData, allSummaryData, admin?.accessibleStates, canShowEmpCode, query.filters.empCode],
  );

  const displayRows = useMemo(
    () => filterUniquePendingDisplay(summary.rows, { gatewayName: gatewayFilter, region }),
    [summary.rows, gatewayFilter, region],
  );

  const { pageRows, totalPages, total, safePage } = useMemo(
    () => paginateUniquePendingRows(displayRows, page, itemsPerPage),
    [displayRows, page, itemsPerPage],
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const commitQuery = useCallback(() => {
    setQuery({
      startDate,
      endDate,
      filters: draft,
    });
    setPage(1);
  }, [startDate, endDate, draft]);

  const clearDates = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setQuery((prev) => ({
      ...prev,
      startDate: '',
      endDate: '',
    }));
    setPage(1);
  }, []);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const toggleGateway = useCallback((name: string) => {
    setGatewayFilter((prev) => (prev === name ? '' : name));
    setPage(1);
  }, []);

  const clearGateway = useCallback(() => {
    setGatewayFilter('');
    setPage(1);
  }, []);

  /** Region is a broader client filter than a single state — clear any active state filter. */
  const toggleRegion = useCallback((next: UniquePendingRegion) => {
    setRegion((prev) => (prev === next ? '' : next));
    setPage(1);
    setDraft((prev) => (prev.state ? { ...prev, state: '' } : prev));
    setQuery((prev) =>
      prev.filters.state ? { ...prev, filters: { ...prev.filters, state: '' } } : prev,
    );
  }, []);

  /** Clicking a state in the "By State" dialog applies/toggles the server state filter. */
  const applyStateFilter = useCallback((state: string) => {
    setDraft((prev) => ({ ...prev, state: prev.state === state ? '' : state }));
    setQuery((prev) => {
      const nextState = prev.filters.state === state ? '' : state;
      return { ...prev, filters: { ...prev.filters, state: nextState } };
    });
    setPage(1);
  }, []);

  const submitComment = useCallback(
    async (row: UniquePendingRow) => {
      const orderId = row.orderId;
      if (!orderId) {
        toast.error('Missing order id');
        return;
      }
      const reason = (comments[row._id || ''] || '').trim();
      if (!reason) {
        toast.error('Enter a comment');
        return;
      }
      setSubmittingCommentId(row._id || '');
      try {
        const res = await secureApi('uniquePending.message', {
          orderId,
          uniquePendingReason: {
            name: admin?.name || '',
            _id: admin?._id || '',
            reason,
          },
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to submit comment');
          return;
        }
        toast.success(res.message || 'Comment submitted');
        setComments((prev) => {
          const next = { ...prev };
          delete next[row._id || ''];
          return next;
        });
        void load();
      } finally {
        setSubmittingCommentId('');
      }
    },
    [admin, comments, load],
  );

  const openStatusDialog = useCallback((orderId?: string) => {
    if (!orderId) {
      toast.error('Missing order id');
      return;
    }
    setStatusOrderId(orderId);
    setStatusRemark('');
    setStatusOpen(true);
  }, []);

  const submitStatusChange = useCallback(async () => {
    const remark = statusRemark.trim();
    if (!remark) {
      toast.error('Remark is required');
      return;
    }
    setStatusSaving(true);
    try {
      const res = await secureApi('uniquePending.statusChange', {
        orderId: statusOrderId,
        uniquePendingReason: {
          name: admin?.name || '',
          _id: admin?._id || '',
          reason: remark,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to change status');
        return;
      }
      toast.success(res.message || 'Status changed');
      setStatusOpen(false);
      setStatusOrderId('');
      setStatusRemark('');
      void load();
    } finally {
      setStatusSaving(false);
    }
  }, [admin, statusOrderId, statusRemark, load]);

  const downloadExcel = useCallback(() => {
    const exportRows = displayRows.map((row) => ({
      UserName: row.userName || '',
      AppCode: appCodeForName(row.clientName),
      DPId: row.userId || '',
      Mobile: row.userMobile || row.mobile || '',
      Amount: row.amount ?? '',
      State: row.userState || row.state || '',
      City: row.userCity || row.city || '',
      TransactionId: row.orderId || row.transactionId || '',
      PaymentMethod: uniquePendingPaymentMethod(row.paymentGatewayName, row.mid),
      Date: formatDisplayDate(row.createdOn) || '',
      Time: formatDisplayTime(row.createdOn) || '',
      Status: row.status || '',
      Comment: row.uniquePendingReason?.reason || '',
      ...(canShowEmpCode ? { EmpCode: row.empCode || '' } : {}),
    }));
    return saveWorkbook(exportRows, {
      sheetName: 'Deposit Data',
      filename: `unique_pending_data_${Date.now()}.xlsx`,
    });
  }, [displayRows, canShowEmpCode]);

  const toCallingItem = useCallback(
    (row: UniquePendingRow): UserRow => ({
      _id: row._id || row.userId || '',
      name: row.userName,
      userName: row.userName,
      mobile: row.userMobile || row.mobile,
      userMobile: row.userMobile || row.mobile,
      clientName: row.clientName,
      state: row.userState || row.state,
      city: row.userCity || row.city,
    }),
    [],
  );

  const openWhatsApp = useCallback((row: UniquePendingRow) => {
    const rawMobile = row.userMobile || row.mobile;
    if (!rawMobile) return;

    let formatted = String(rawMobile).replace(/\D/g, '');
    if (formatted.length === 10) formatted = `91${formatted}`;

    const message = buildDepositWhatsAppMessage(row);
    const encodedMessage = encodeURIComponent(message);
    const appUrl = `whatsapp://send?phone=${formatted}&text=${encodedMessage}`;
    const webUrl = `https://wa.me/${formatted}?text=${encodedMessage}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = appUrl;
    } else {
      window.open(webUrl, '_blank');
    }
  }, []);

  const columns = useMemo<CommonTableColumn<UniquePendingRow>[]>(() => {
    const cols: CommonTableColumn<UniquePendingRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => {
              if (!row.userId) return;
              navigate(`/users/report/${row.userId}/${encodeURIComponent(row.userName || '')}`);
            }}
          >
            {display(row.userName)}
          </Typography>
        ),
      },
      {
        id: 'clientName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'userId',
        label: 'DP ID',
        render: (row) => display(row.userId),
      },
      ...(canShowEmpCode
        ? [
            {
              id: 'empCode',
              label: 'Emp Code',
              width: 110,
              render: (row: UniquePendingRow) => {
                const code = String(row.empCode || '').trim();
                const empName = code ? empCodeNameMap[code] : '';
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    <span>{code || '—'}</span>
                    {empName ? (
                      <Typography
                        component="span"
                        sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}
                      >
                        {empName}
                      </Typography>
                    ) : null}
                  </Box>
                );
              },
            } satisfies CommonTableColumn<UniquePendingRow>,
          ]
        : []),
      {
        id: 'mobile',
        label: 'Mobile No',
        width: 180,
        render: (row) => (
          <CallingBtn
            item={toCallingItem(row)}
            campaignName="UNIQUE PENDING DEP ALL APP KA"
            reasonList="Unique Pending Deposit"
            hideBotCall
          />
        ),
      },
      ...(canWhatsApp
        ? [
            {
              id: 'whatsapp',
              label: 'WhatsApp',
              width: 72,
              render: (row: UniquePendingRow) =>
                String(row.status || '').toLowerCase() === 'pending' ? (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => openWhatsApp(row)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      p: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      lineHeight: 0,
                    }}
                    aria-label="Open WhatsApp"
                  >
                    <Box
                      component="img"
                      src="https://img.icons8.com/?size=1200&id=16713&format=jpg"
                      alt="WhatsApp"
                      sx={{ width: 36, height: 36, borderRadius: 1 }}
                    />
                  </Box>
                ) : (
                  '—'
                ),
            } satisfies CommonTableColumn<UniquePendingRow>,
          ]
        : []),
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => display(row.userState || row.state),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => display(row.userCity || row.city),
      },
      {
        id: 'orderId',
        label: 'Transaction Id',
        render: (row) => display(row.orderId || row.transactionId),
      },
      {
        id: 'paymentMethod',
        label: 'Payment Method',
        render: (row) => uniquePendingPaymentMethod(row.paymentGatewayName, row.mid),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => formatDisplayDate(row.createdOn) || '—',
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => formatDisplayTime(row.createdOn) || '—',
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => {
          const color = uniquePendingStatusColor(row.status);
          return (
            <Chip
              size="small"
              label={display(row.status)}
              sx={{
                fontWeight: 700,
                textTransform: 'capitalize',
                bgcolor: color ? `${color}22` : 'rgba(255,255,255,0.08)',
                color: color || 'text.primary',
                border: color ? `1px solid ${color}55` : undefined,
              }}
            />
          );
        },
      },
      {
        id: 'comment',
        label: 'Comment',
        width: 220,
        render: (row) => {
          const existing = row.uniquePendingReason?.reason;
          if (existing) {
            return (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {existing}
              </Typography>
            );
          }
          const busy = submittingCommentId === (row._id || '');
          return (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="flex-end"
              sx={{ minWidth: 180, py: 0.5 }}
            >
              <TextField
                size="small"
                multiline
                minRows={2}
                placeholder="Comment"
                value={comments[row._id || ''] || ''}
                onChange={(e) =>
                  setComments((prev) => ({ ...prev, [row._id || '']: e.target.value }))
                }
                sx={{
                  flex: 1,
                  minWidth: 0,
                  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
                }}
              />
              <Tooltip title={busy ? 'Submitting…' : 'Submit comment'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={busy}
                    onClick={() => void submitComment(row)}
                    aria-label="Submit comment"
                    sx={{
                      bgcolor: '#f1a144',
                      color: '#111',
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      mb: 0.25,
                      '&:hover': { bgcolor: '#e09030' },
                      '&.Mui-disabled': { bgcolor: '#f7d2a8', color: '#666' },
                    }}
                  >
                    {busy ? (
                      <CircularProgress size={14} sx={{ color: '#111' }} />
                    ) : (
                      <SendOutlinedIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ];

    if (canChangeStatus) {
      cols.push({
        id: 'action',
        label: 'Action',
        width: 130,
        render: (row) => (
          <Button
            size="small"
            variant="contained"
            onClick={() => openStatusDialog(row.orderId)}
            sx={actionBtnSx}
          >
            Change Status
          </Button>
        ),
      });
    }

    return cols;
  }, [
    page,
    itemsPerPage,
    canChangeStatus,
    canShowEmpCode,
    canWhatsApp,
    empCodeNameMap,
    comments,
    submittingCommentId,
    submitComment,
    openStatusDialog,
    toCallingItem,
    openWhatsApp,
    navigate,
  ]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <CollapsibleFilterPanel
        title="Unique Deposit Pending User"
        summary={`${startDate || '—'} → ${endDate || '—'}`}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
            },
            gap: 1.25,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            size="small"
            label="App"
            value={draft.clientName}
            onChange={(e) => setDraftField('clientName')(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="DP ID"
            value={draft.userId}
            onChange={(e) => setDraftField('userId')(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Amount"
            value={draft.amount}
            onChange={(e) => setDraftField('amount')(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="City"
            value={draft.city}
            onChange={(e) => setDraftField('city')(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            size="small"
            label="State"
            value={draft.state}
            onChange={(e) => setDraftField('state')(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {INDIA_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="MID"
            value={draft.mid}
            onChange={(e) => setDraftField('mid')(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {midOptions.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          {canShowEmpCode ? (
            <TextField
              size="small"
              label="Emp Code"
              value={draft.empCode}
              onChange={(e) => setDraftField('empCode')(e.target.value)}
              sx={fieldSx}
            />
          ) : null}
          <TextField
            select
            size="small"
            label="Items / Page"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value) || DEFAULT_ITEMS_PER_PAGE);
              setPage(1);
            }}
            sx={fieldSx}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ gridColumn: '1 / -1' }}
          >
            <Button variant="contained" disabled={loading} onClick={commitQuery} sx={orangeBtnSx}>
              Apply
            </Button>
            <Button variant="contained" disabled={loading} onClick={clearDates} sx={orangeBtnSx}>
              Clear Dates
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
              disabled={loading}
              onClick={() => void load()}
              sx={orangeBtnSx}
            >
              Refresh
            </Button>
            {canDownload ? (
              <Button
                variant="contained"
                disabled={loading}
                onClick={() => setDownloadOpen(true)}
                sx={orangeBtnSx}
              >
                Download Data
              </Button>
            ) : null}
          </Stack>
        </Box>
      </CollapsibleFilterPanel>

      <SummaryCards all={summary.all} pending={summary.pending} approved={summary.approved} />

      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <RegionCard
          label="South"
          count={summary.regionCounts.south}
          active={region === 'south'}
          onClick={() => toggleRegion('south')}
        />
        <RegionCard
          label="North"
          count={summary.regionCounts.north}
          active={region === 'north'}
          onClick={() => toggleRegion('north')}
        />
        <GatewayChips
          counts={summary.gatewayCounts}
          active={gatewayFilter}
          onToggle={toggleGateway}
          onClear={clearGateway}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => setByStateOpen(true)} sx={orangeBtnSx}>
          By State
        </Button>
        {canCallerWise ? (
          <Button
            variant="contained"
            onClick={() =>
              navigate('/unique_deposit_pending/caller-wise', {
                state: { startDate: query.startDate, endDate: query.endDate },
              })
            }
            sx={orangeBtnSx}
          >
            Caller Wise Deposit Pending
          </Button>
        ) : null}
      </Stack>

      <TablePanel
        footer={
          <>
            <Typography variant="body2" color="text.secondary">
              Total: {total}
            </Typography>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
      >
        <CommonTable
          columns={columns}
          rows={pageRows}
          getRowKey={(row, index) => row._id || row.orderId || index}
          loading={loading}
          emptyMessage="No unique pending deposits found"
          stickyHeader
          dense
          virtualize={false}
          minWidth={2000}
          maxHeight="100%"
        />
      </TablePanel>

      <ByStateDialog
        open={byStateOpen}
        onClose={() => setByStateOpen(false)}
        rows={summary.byState}
        activeState={query.filters.state}
        onSelectState={applyStateFilter}
      />

      <Dialog
        open={statusOpen}
        onClose={() => !statusSaving && setStatusOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Change Status</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Remark"
            value={statusRemark}
            onChange={(e) => setStatusRemark(e.target.value)}
            sx={{ mt: 1, '& .MuiInputBase-root': { bgcolor: '#121218' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setStatusOpen(false)}
            disabled={statusSaving}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={statusSaving}
            onClick={() => void submitStatusChange()}
            sx={orangeBtnSx}
          >
            {statusSaving ? '…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <SheetDownloadOtpModal
        open={downloadOpen}
        filter={{ mid: 'All', type: 'Unique Pending Deposit' }}
        onClose={() => setDownloadOpen(false)}
        onVerified={downloadExcel}
      />
    </Box>
  );
}
