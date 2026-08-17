import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { display, maskMobile } from '@/screens/panel/shared';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type DepositStat = { count?: number; totalAmount?: number };

type SupportDepositEntry = Record<
  string,
  { depositData?: DepositStat[]; coinData?: DepositStat[] } | undefined
>;

type AllotmentRow = {
  _id: string;
  name?: string;
  mobile?: string;
  city?: string;
  email?: string;
  empCode?: string;
  allotedCustomer?: unknown[];
  block?: boolean;
  Role_ID?: string;
  blockReason?: string;
  depositData?: DepositStat[];
  coinData?: DepositStat[];
  [key: string]: unknown;
};

type Filters = {
  name: string;
  mobile: string;
  empCode: string;
};

const EMPTY_FILTERS: Filters = { name: '', mobile: '', empCode: '' };

type CallerReportData = {
  handleCustomer?: number;
  feedBackCompleted?: number;
  handleCall?: number;
  incomingMissedCall?: number;
  outgoingMissedCall?: number;
  spentCallTime?: number;
  depositData?: {
    depositData?: DepositStat[];
    coinData?: DepositStat[];
  };
};

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const headerFieldSx = {
  width: 160,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
  '&:hover': { bgcolor: '#e08c00' },
};

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

function roundAmount(value: unknown): number {
  return Math.floor(Number(value) || 0);
}

function depositLabel(stat?: DepositStat[]): string {
  const first = stat?.[0];
  if (!first) return '(0) : 0';
  return `(${first.count ?? 0}) : ${roundAmount(first.totalAmount)}`;
}

function isAllotmentRow(value: unknown): value is AllotmentRow {
  if (!value || typeof value !== 'object') return false;
  const id = (value as AllotmentRow)._id;
  return id != null && String(id).trim() !== '';
}

function normalizeAllotmentRow(value: AllotmentRow): AllotmentRow {
  return { ...value, _id: String(value._id) };
}

function extractCustomerItems(data: unknown): {
  items: AllotmentRow[];
  totalPages: number;
  total: number;
} {
  const obj =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  const raw = Array.isArray(nested.items)
    ? nested.items
    : Array.isArray(obj.items)
      ? obj.items
      : Array.isArray(data)
        ? data
        : [];
  const items = raw.filter(isAllotmentRow).map(normalizeAllotmentRow);
  return {
    items,
    totalPages: Math.max(1, Number(nested.totalPages ?? obj.totalPages ?? 1) || 1),
    total: Number(nested.total ?? obj.total ?? items.length) || 0,
  };
}

export function CustomerAllotmentPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [customers, setCustomers] = useState<AllotmentRow[]>([]);
  const [depositMap, setDepositMap] = useState<SupportDepositEntry>({});
  const [depositLoading, setDepositLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const [blockTarget, setBlockTarget] = useState<AllotmentRow | null>(null);
  const [blockRemark, setBlockRemark] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const [reportTarget, setReportTarget] = useState<AllotmentRow | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<CallerReportData | null>(null);

  const loadDeposits = useCallback(async (pageNo: number, size: number) => {
    setDepositLoading(true);
    try {
      const res = await secureApi('ops.customerSupportDeposit', {
        itemPerPage: size,
        pageNo,
      });
      if (!res.ok || res.success === false) {
        console.warn('[CustomerAllotment] deposit API:', res.message || res);
        return;
      }

      const raw = res.data;
      let list: SupportDepositEntry[] = [];
      if (Array.isArray(raw)) {
        list = raw as SupportDepositEntry[];
      } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.items)) list = obj.items as SupportDepositEntry[];
        else if (Array.isArray(obj.payload)) list = obj.payload as SupportDepositEntry[];
        else {
          // Single map { [callerId]: stats } — wrap as one entry.
          list = [obj as SupportDepositEntry];
        }
      }

      const merged: SupportDepositEntry = {};
      for (const entry of list) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        for (const [key, value] of Object.entries(entry)) {
          if (!key || value == null) continue;
          merged[key] = value as SupportDepositEntry[string];
        }
      }
      setDepositMap(merged);
    } catch (err) {
      console.warn('[CustomerAllotment] deposit load failed', err);
    } finally {
      setDepositLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(
    async (pageNo = page, filtersOverride?: Filters) => {
      const active = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filter: Record<string, string> = {};
        if (active.name.trim()) filter.name = active.name.trim();
        if (active.mobile.trim()) filter.mobile = active.mobile.trim();
        if (active.empCode.trim()) filter.empCode = active.empCode.trim();

        const size = Number(pageSize) || DEFAULT_ITEMS_PER_PAGE;
        const safePage = Number(pageNo) || 1;

        // Exact laxminarayan shape for initial load (no empty filter object).
        const payload: Record<string, unknown> = {
          itemPerPage: size,
          pageNo: safePage,
        };
        if (Object.keys(filter).length > 0) {
          payload.filter = filter;
        }

        const res = await secureApi('ops.customerSupportGetAll', payload);
        if (!isCurrent(gen)) return;

        if (!res.ok || res.success === false) {
          const msg =
            res.message ||
            'Failed to load customer allotment (get-all-customerSupport)';
          console.error('[CustomerAllotment] customers API failed', {
            message: res.message,
            status: res.status,
            payload,
            data: res.data,
          });
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setCustomers([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const extracted = extractCustomerItems(res.data);
        startTransition(() => {
          setCustomers(extracted.items);
          setTotalPages(extracted.totalPages);
          setTotal(extracted.total);
        });

        // Load deposit stats after the list succeeds (never block / toast on failure).
        void loadDeposits(safePage, size);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to load customer allotment';
        console.error('[CustomerAllotment] unexpected error', err);
        setError(msg);
        toast.error(msg);
        startTransition(() => {
          setCustomers([]);
          setTotal(0);
          setTotalPages(1);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, appliedFilters, next, begin, end, isCurrent, loadDeposits],
  );

  useEffect(() => {
    void loadCustomers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const rows = useMemo<AllotmentRow[]>(() => {
    const safe: AllotmentRow[] = [];
    for (const c of customers) {
      if (!c || c._id == null || String(c._id).trim() === '') continue;
      const id = String(c._id);
      const stat = depositMap[id];
      safe.push(
        stat
          ? { ...c, _id: id, depositData: stat.depositData, coinData: stat.coinData }
          : { ...c, _id: id },
      );
    }
    return safe;
  }, [customers, depositMap]);
  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void loadCustomers(1, draftFilters);
  }, [draftFilters, loadCustomers]);

  const openAllotted = useCallback(
    (row: AllotmentRow) => {
      if (!row?._id) return;
      const ids = (Array.isArray(row.allotedCustomer) ? row.allotedCustomer : [])
        .map((item) => {
          if (item == null) return null;
          if (typeof item === 'string' || typeof item === 'number') return String(item);
          if (typeof item === 'object' && item !== null && '_id' in item) {
            const id = (item as { _id?: unknown })._id;
            return id == null ? null : String(id);
          }
          return null;
        })
        .filter((id): id is string => Boolean(id));

      navigate('/customer-allotted', {
        state: {
          customer: ids,
          _id: row._id,
          callerId: row._id,
          callerName: row.name,
          empCode: row.empCode,
        },
      });
    },
    [navigate],
  );

  const submitBlock = useCallback(async () => {
    if (!blockTarget?._id || !blockRemark.trim()) {
      toast.error('Please enter a remark');
      return;
    }
    setBlockSubmitting(true);
    try {
      const res = await secureApi('ops.blockCaller', {
        _id: blockTarget._id,
        Role_ID: blockTarget.Role_ID,
        status: !blockTarget.block,
        blockReason: blockRemark.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update block status');
        return;
      }
      toast.success(blockTarget.block ? 'Caller unblocked' : 'Caller blocked');
      setBlockTarget(null);
      setBlockRemark('');
      void loadCustomers(page);
    } finally {
      setBlockSubmitting(false);
    }
  }, [blockTarget, blockRemark, loadCustomers, page]);

  const runCallerReport = useCallback(
    async (mode: 'today' | 'range' | 'all') => {
      if (!reportTarget?._id) return;
      setReportLoading(true);
      setReportData(null);
      try {
        const payload =
          mode === 'range'
            ? {
                _id: reportTarget._id,
                startDate: reportStartDate,
                endDate: reportEndDate,
                todayData: false,
                allData: false,
              }
            : mode === 'all'
              ? {
                  _id: reportTarget._id,
                  startDate: '',
                  endDate: '',
                  todayData: false,
                  allData: true,
                }
              : {
                  _id: reportTarget._id,
                  startDate: '',
                  endDate: '',
                  todayData: true,
                  allData: false,
                };

        const res = await secureApi<CallerReportData>('ops.callerReport', payload);
        if (!res.ok) {
          toast.error(res.message || 'Failed to load caller report');
          return;
        }
        setReportData(res.data || {});
      } finally {
        setReportLoading(false);
      }
    },
    [reportTarget, reportStartDate, reportEndDate],
  );

  const openCallerReport = useCallback((row: AllotmentRow) => {
    setReportTarget(row);
    setReportStartDate('');
    setReportEndDate('');
    setReportData(null);
  }, []);

  useEffect(() => {
    if (reportTarget) void runCallerReport('today');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportTarget?._id]);

  const columns = useMemo<CommonTableColumn<AllotmentRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <ColumnSearch
            value={draftFilters.name}
            placeholder="Search name"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, name: v }))}
            onSearch={search}
          />
        ),
        render: (row) => (
          <Typography variant="body2" fontWeight={600}>
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <ColumnSearch
            value={draftFilters.mobile}
            placeholder="Search mobile"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, mobile: v }))}
            onSearch={search}
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'empCode',
        label: 'Emp Code',
        filter: (
          <ColumnSearch
            value={draftFilters.empCode}
            placeholder="Search emp code"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, empCode: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.empCode),
      },
      {
        id: 'autoDeposit',
        label: 'Todays Automatic Deposit',
        render: (row) => (depositLoading ? '…' : depositLabel(row.depositData)),
      },
      {
        id: 'coinDeposit',
        label: 'Todays Coin Deposit',
        render: (row) => (depositLoading ? '…' : depositLabel(row.coinData)),
      },
      {
        id: 'alloted',
        label: 'Allotted Customer',
        render: (row) => (
          <Button
            size="small"
            variant="text"
            startIcon={<PeopleAltIcon sx={{ fontSize: 16 }} />}
            onClick={() => openAllotted(row)}
            sx={{ color: '#ff9f0a', textTransform: 'none', fontWeight: 700 }}
          >
            {row.allotedCustomer?.length ?? 0}
          </Button>
        ),
      },
      {
        id: 'block',
        label: 'Action',
        render: (row) => (
          <Button
            size="small"
            variant="contained"
            startIcon={<BlockIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              setBlockTarget(row);
              setBlockRemark('');
            }}
            sx={
              row.block
                ? {
                    ...orangeBtnSx,
                    fontSize: 11,
                    px: 1.25,
                    py: 0.25,
                    minHeight: 28,
                  }
                : {
                    bgcolor: '#d32f2f',
                    color: '#fff',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 11,
                    px: 1.25,
                    py: 0.25,
                    minHeight: 28,
                    '&:hover': { bgcolor: '#b71c1c' },
                  }
            }
          >
            {row.block ? 'Unblock' : 'Block'}
          </Button>
        ),
      },
      {
        id: 'callerReport',
        label: 'Caller Report',
        render: (row) => (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AssessmentIcon sx={{ fontSize: 16 }} />}
            onClick={() => openCallerReport(row)}
            sx={{
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              fontSize: 11,
              px: 1.25,
              py: 0.25,
              minHeight: 28,
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Report
          </Button>
        ),
      },
      {
        id: 'blockReason',
        label: 'Block Reason',
        render: (row) => display(row.blockReason),
      },
    ],
    [
      draftFilters,
      search,
      canShowMobile,
      page,
      pageSize,
      depositLoading,
      openAllotted,
      openCallerReport,
    ],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title="Customer Allotment"
        summary={`${pageSize} per page · ${total} total`}
        headerActions={
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={(event) => {
              event.stopPropagation();
              void loadCustomers(page);
            }}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        }
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{ minWidth: 'max-content' }}
        >
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Typography
            variant="body2"
            fontWeight={700}
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Total: {total}
          </Typography>
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          <>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => row?._id || i}
          loading={loading}
          emptyMessage="No callers found"
          stickyHeader
          dense
          minWidth={1400}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={Boolean(blockTarget)}
        onClose={() => setBlockTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{blockTarget?.block ? 'Unblock Caller' : 'Block Caller'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Remark"
            value={blockRemark}
            onChange={(e) => setBlockRemark(e.target.value)}
            placeholder="Please enter remark"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockTarget(null)} disabled={blockSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitBlock()}
            disabled={blockSubmitting}
            sx={orangeBtnSx}
          >
            {blockSubmitting ? (
              <CircularProgress size={18} color="inherit" />
            ) : blockTarget?.block ? (
              'Unblock'
            ) : (
              'Block'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Caller Report{reportTarget?.name ? ` — ${reportTarget.name}` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap pt={1}>
            <TextField
              type="date"
              label="From Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              sx={headerFieldSx}
            />
            <TextField
              type="date"
              label="To Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              sx={headerFieldSx}
            />
            <Button
              variant="contained"
              size="small"
              disabled={!reportStartDate || !reportEndDate || reportLoading}
              onClick={() => void runCallerReport('range')}
              sx={{ ...orangeBtnSx, height: 36 }}
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={reportLoading}
              onClick={() => void runCallerReport('today')}
              sx={{ textTransform: 'none' }}
            >
              Today
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={reportLoading}
              onClick={() => void runCallerReport('all')}
              sx={{ textTransform: 'none' }}
            >
              All Data
            </Button>
          </Stack>

          {reportLoading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={28} />
            </Stack>
          ) : reportData ? (
            <Stack spacing={2} mt={2}>
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                <Typography variant="body2">
                  <strong>Automatic deposit:</strong>{' '}
                  {depositLabel(reportData.depositData?.depositData)}
                </Typography>
                <Typography variant="body2">
                  <strong>Scanner deposit:</strong>{' '}
                  {depositLabel(reportData.depositData?.coinData)}
                </Typography>
              </Stack>
              <Box
                display="grid"
                gridTemplateColumns={{ xs: '1fr 1fr', sm: '1fr 1fr 1fr' }}
                gap={1.5}
              >
                {[
                  ['Handle Customer', reportData.handleCustomer],
                  ['Feedback Completed', reportData.feedBackCompleted],
                  ['Handle Call', reportData.handleCall],
                  ['Incoming Missed', reportData.incomingMissedCall],
                  ['Outgoing Missed', reportData.outgoingMissedCall],
                  [
                    'Spent Call Time',
                    `${((reportData.spentCallTime || 0) / 60).toFixed(2)} min`,
                  ],
                ].map(([label, value]) => (
                  <Paper key={String(label)} sx={{ p: 1.5, bgcolor: '#121218', textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {value ?? 0}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
