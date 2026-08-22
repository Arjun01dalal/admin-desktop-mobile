import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { canShowUniqueDepositEmpCode, hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { asPaged, display, useReportQuery } from '@/screens/panel/shared';
import {
  getCachedEmpCodeNameMap,
  getEmpCodeNameMap,
} from '@/utils/empCodeNameCache';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import { SheetDownloadOtpModal } from '@/components/SheetDownloadOtpModal';
import { saveWorkbook } from '@/utils/downloadSheet';
import type { UserRow } from '@/screens/panel/users/utils';

type UniquePendingRow = {
  _id: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  orderId?: string;
  amount?: number | string;
  paymentGatewayName?: string;
  mid?: string | number;
  status?: string;
  createdOn?: string;
  clientName?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  empCode?: string;
  transactionId?: string;
  uniquePendingReason?: { reason?: string; name?: string; _id?: string };
};

type ColumnFilters = {
  clientName: string;
  userId: string;
  amount: string;
  state: string;
  city: string;
  empCode: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  filters: ColumnFilters;
};

const EMPTY_FILTERS: ColumnFilters = {
  clientName: '',
  userId: '',
  amount: '',
  state: '',
  city: '',
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

const filterSelectSx = {
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

export function UniqueDepositPendingPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{ _id?: string; name?: string; mobile?: string }>();
  const canShowEmpCode = canShowUniqueDepositEmpCode(admin);
  const canChangeStatus = hasPermission('change_status');
  const canDownload = hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');
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
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusOrderId, setStatusOrderId] = useState('');
  const [statusRemark, setStatusRemark] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(
    () => getCachedEmpCodeNameMap(),
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

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    const f = query.filters;
    if (f.clientName) filter.clientName = f.clientName;
    if (f.city.trim()) filter.city = f.city.trim();
    if (f.state) filter.state = f.state;
    if (f.amount.trim()) filter.amount = f.amount.trim();
    if (f.userId.trim()) filter.userId = f.userId.trim();
    if (canShowEmpCode && f.empCode.trim()) filter.empCode = f.empCode.trim();

    const payload: Record<string, unknown> = {
      pageNo: page,
      itemsPerPage,
      filter,
    };
    if (query.startDate) payload.startDate = query.startDate;
    if (query.endDate) payload.endDate = query.endDate;
    return payload;
  }, [query, page, itemsPerPage, canShowEmpCode]);

  const unpack = useCallback(
    (res: { data?: unknown }) => asPaged<UniquePendingRow>(res.data),
    [],
  );

  const { rows, total, totalPages, loading, load } = useReportQuery<UniquePendingRow>({
    action: 'uniquePending.list',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, query],
    errorMessage: 'Failed to load unique pending deposits',
    cacheTtlMs: 0,
  });

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const payload = {
        startDate: query.startDate || todayIST(),
        endDate: query.endDate || todayIST(),
      };
      const res = await secureApi('uniquePending.fundRequest', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load pending summary');
        return;
      }
      const body = unpackPayload(res.data);
      const detail =
        body.uniquePendingDetail && typeof body.uniquePendingDetail === 'object'
          ? (body.uniquePendingDetail as Record<string, unknown>)
          : body;
      setPendingCount(Number(detail.pendingCount) || 0);
      setPendingAmount(Number(detail.pendingAmount) || 0);
    } finally {
      setSummaryLoading(false);
    }
  }, [query.startDate, query.endDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const commitQuery = useCallback(
    (opts?: { filters?: ColumnFilters }) => {
      setQuery({
        startDate,
        endDate,
        filters: opts?.filters ?? draft,
      });
      setPage(1);
    },
    [startDate, endDate, draft],
  );

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

  const onDraftChange =
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value);

  const searchFilter = useCallback(
    (key: keyof ColumnFilters, placeholder: string) => (
      <TableSearchBar
        value={draft[key]}
        onChange={onDraftChange(key)}
        onSearch={() => commitQuery()}
        placeholder={placeholder}
      />
    ),
    [draft, commitQuery],
  );

  const submitComment = useCallback(
    async (row: UniquePendingRow) => {
      const orderId = row.orderId;
      if (!orderId) {
        toast.error('Missing order id');
        return;
      }
      const reason = (comments[row._id] || '').trim();
      if (!reason) {
        toast.error('Enter a comment');
        return;
      }
      setSubmittingCommentId(row._id);
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
          delete next[row._id];
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
      void loadSummary();
    } finally {
      setStatusSaving(false);
    }
  }, [admin, statusOrderId, statusRemark, load, loadSummary]);

  const downloadExcel = useCallback(() => {
    return saveWorkbook(rows as Record<string, unknown>[], {
      sheetName: 'Deposit Data',
      filename: `unique_pending_data_${Date.now()}.xlsx`,
    });
  }, [rows]);

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

    const state = row.userState || row.state || '';
    const stateWiseMsg =
      state === 'Karnataka'
        ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nನೀವು ಠೇವಣಿ ಮಾಡಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರುವಿರಿ ಎಂದು ಕಾಣುತ್ತದೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`
        : ['Telangana', 'Andhra Pradesh'].includes(state)
          ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nమీరు డిపాజిట్ చేయడానికి ప్రయత్నిస్తున్నారని నేను చూస్తున్నాను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?`
          : ['Tamil Nadu', 'Tiruchirappalli'].includes(state)
            ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nநீங்கள் டெப்பாசிட் செய்ய முயற்சிக்கிறீர்கள் என்று பார்க்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
            : `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nI see you're trying to make a deposit. How can I assist you today?`;

    const message = stateWiseMsg.replace(
      '{USER_NAME}',
      (row.userName || '').split(' ')[0] || '',
    );
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
              navigate(
                `/users/report/${row.userId}/${encodeURIComponent(row.userName || '')}`,
              );
            }}
          >
            {display(row.userName)}
          </Typography>
        ),
      },
      {
        id: 'clientName',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={draft.clientName}
            onChange={(e) => {
              setDraftField('clientName')(e.target.value);
              commitQuery({
                filters: { ...draft, clientName: e.target.value },
              });
            }}
            sx={filterSelectSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'userId',
        label: 'DP ID',
        filter: (
          <TableSearchBar
            value={draft.userId}
            onChange={onDraftChange('userId')}
            onSearch={() => commitQuery()}
            placeholder="DP id"
          />
        ),
        render: (row) => display(row.userId),
      },
      ...(canShowEmpCode
        ? [
            {
              id: 'empCode',
              label: 'Emp Code',
              width: 110,
              filter: searchFilter('empCode', 'Emp code'),
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
        filter: (
          <TableSearchBar
            value={draft.amount}
            onChange={onDraftChange('amount')}
            onSearch={() => commitQuery()}
            placeholder="Amount"
          />
        ),
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={draft.state}
            onChange={(e) => {
              setDraftField('state')(e.target.value);
              commitQuery({
                filters: { ...draft, state: e.target.value },
              });
            }}
            sx={filterSelectSx}
          >
            <MenuItem value="">All</MenuItem>
            {INDIA_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => display(row.userState || row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: (
          <TableSearchBar
            value={draft.city}
            onChange={onDraftChange('city')}
            onSearch={() => commitQuery()}
            placeholder="City"
          />
        ),
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
        render: (row) => {
          const gw = display(row.paymentGatewayName, '');
          const mid = row.mid != null && row.mid !== '' ? String(row.mid) : '';
          if (!gw && !mid) return '—';
          return mid ? `${gw} - ${mid}` : gw;
        },
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
        render: (row) => display(row.status),
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
          const busy = submittingCommentId === row._id;
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
                value={comments[row._id] || ''}
                onChange={(e) =>
                  setComments((prev) => ({ ...prev, [row._id]: e.target.value }))
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
    draft,
    canChangeStatus,
    canShowEmpCode,
    canWhatsApp,
    empCodeNameMap,
    comments,
    submittingCommentId,
    commitQuery,
    searchFilter,
    setDraftField,
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
        summary={`${startDate} → ${endDate}`}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))',
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
            sx={{ gridColumn: { xs: '1 / -1', lg: 'span 2' } }}
          >
            <Button
              variant="contained"
              disabled={loading}
              onClick={() => commitQuery()}
              sx={orangeBtnSx}
            >
              Apply
            </Button>
            <Button
              variant="contained"
              disabled={loading}
              onClick={clearDates}
              sx={orangeBtnSx}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={
                loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />
              }
              disabled={loading}
              onClick={() => {
                void load();
                void loadSummary();
              }}
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

      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Chip
          label={`Pending: (${pendingCount}) : ${formatAmount(pendingAmount)}`}
          sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
        />
        {summaryLoading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
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
          rows={rows}
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
