import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcCallIcon from '@mui/icons-material/AddIcCall';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { appCodeForName } from '@/constants/clientNames';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatMaskedAmount, formatDisplayDate, getStoredUser, todayIST } from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { maskMobile } from '@/screens/panel/shared';
import { RESP_SHOW_MOBILE, type CallerRow } from './constants';
import { type StoredCallerUser } from './utils';

type NavState = {
  empCode?: string;
  deposit?: number;
  activePlayersECS?: Record<string, unknown>;
};

type DetailRow = CallerRow & { status?: string };

type TodayPayload = {
  user?: CallerRow[];
  users?: CallerRow[];
  count?: number;
  totalPages?: number;
  payload?: {
    user?: CallerRow[];
    users?: CallerRow[];
    count?: number;
    totalPages?: number;
  };
};

type WarnPayload = {
  items?: CallerRow[];
  total?: number;
  payload?: { items?: CallerRow[]; total?: number };
};

type ActiveInactivePayload = {
  active?: CallerRow[];
  inactive?: CallerRow[];
  payload?: { active?: CallerRow[]; inactive?: CallerRow[] };
};

/**
 * Match laxminarayan callerDetails Active/Inactive date formatting:
 * `new Date(); setDate(getDate() - n); toISOString().split('T')[0]`.
 * (Do not use IST offset — Laxmi uses local/browser Date.)
 */
function formatDaysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapToday(data: TodayPayload | null | undefined): {
  users: CallerRow[];
  count: number;
  totalPages: number;
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const usersRaw = root.user ?? root.users ?? nested.user ?? nested.users;
  const users = Array.isArray(usersRaw) ? (usersRaw as CallerRow[]) : [];
  const count = Number(root.count ?? nested.count ?? users.length) || 0;
  const totalPages =
    Number(root.totalPages ?? nested.totalPages) ||
    Math.max(1, Math.ceil(count / Math.max(users.length, 1)) || 1);
  return { users, count, totalPages };
}

function unwrapWarn(data: WarnPayload | null | undefined): {
  items: CallerRow[];
  total: number;
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const itemsRaw = root.items ?? nested.items;
  const items = Array.isArray(itemsRaw) ? (itemsRaw as CallerRow[]) : [];
  const total = Number(root.total ?? nested.total ?? items.length) || 0;
  return { items, total };
}

function unwrapActiveInactive(data: ActiveInactivePayload | null | undefined): {
  active: CallerRow[];
  inactive: CallerRow[];
} {
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  const activeRaw = root.active ?? nested.active;
  const inactiveRaw = root.inactive ?? nested.inactive;
  return {
    active: Array.isArray(activeRaw) ? (activeRaw as CallerRow[]) : [],
    inactive: Array.isArray(inactiveRaw) ? (inactiveRaw as CallerRow[]) : [],
  };
}

function extensionIds(admin: StoredCallerUser | null): string[] {
  const raw = admin?.extensionId;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function alternateMobileList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const s = String(value).trim();
  return s ? [s] : [];
}

function formatAlternateMobile(value: unknown, canShow: boolean): string {
  const list = alternateMobileList(value);
  if (!list.length) return '-';
  if (!canShow) return '**********';
  return list.join(', ');
}

/**
 * Fetch every Today page so the table shows full results (API is paginated).
 * Matches laxminarayan callerDetails payloads: pageNo + itemsPerPage.
 */
async function fetchAllTodayUsers(args: {
  empCode: string;
  startDate: string;
  endDate: string;
  pageSize?: number;
}): Promise<{ users: CallerRow[]; count: number }> {
  const pageSize = args.pageSize ?? 100;
  let page = 1;
  let totalPages = 1;
  let count = 0;
  const users: CallerRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi<TodayPayload>('caller.callerActiveToday', {
      empCode: args.empCode,
      filter: {},
      startDate: args.startDate,
      endDate: args.endDate,
      pageNo: page,
      itemsPerPage: pageSize,
    });
    const parsed = unwrapToday(res.data);
    if (page === 1) {
      count = parsed.count;
      totalPages = Math.max(
        1,
        Number(parsed.totalPages) ||
          Math.ceil(parsed.count / pageSize) ||
          1,
      );
    }
    for (const row of parsed.users) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      users.push(row);
    }
    // Stop if API returned fewer than a full page (last page) or empty.
    if (!parsed.users.length || parsed.users.length < pageSize) break;
    page += 1;
  } while (page <= totalPages && page <= 200);

  return { users, count: count || users.length };
}

/**
 * Non-performing list — API key is `itemPerPage` (not itemsPerPage).
 * Page through until all rows are loaded.
 */
async function fetchAllWarningUsers(args: {
  empCode: string;
  userId?: string;
  pageSize?: number;
}): Promise<{ items: CallerRow[]; total: number }> {
  const pageSize = args.pageSize ?? 1000;
  let page = 1;
  let total = 0;
  const items: CallerRow[] = [];
  const seen = new Set<string>();

  do {
    const res = await secureApi<WarnPayload>('caller.nonPerforming', {
      empCode: args.empCode,
      _id: args.userId,
      pageNo: page,
      itemPerPage: pageSize,
      filter: {},
    });
    const parsed = unwrapWarn(res.data);
    if (page === 1) total = parsed.total;
    for (const row of parsed.items) {
      const key = String(row._id || row.userId || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      items.push(row);
    }
    if (!parsed.items.length || parsed.items.length < pageSize) break;
    if (total > 0 && items.length >= total) break;
    page += 1;
  } while (page <= 200);

  return { items, total: total || items.length };
}

export function CallerDetailsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state || {}) as NavState;
  const empCode = String(nav.empCode || '');
  const user = getStoredUser<StoredCallerUser>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);
  const canOpenUserReport = hasPermission('wallet_history', user);

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [tab, setTab] = useState('Today');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [counts, setCounts] = useState({
    Today: 0,
    Active: 0,
    Warning: 0,
    Inactive: 0,
  });

  // Client-side paging for Today tab (all rows are loaded; pager only slices UI).
  const [todayPage, setTodayPage] = useState(1);
  const [todayPageSize, setTodayPageSize] = useState(50);
  const [searchName, setSearchName] = useState('');
  const [dialerBusyId, setDialerBusyId] = useState<string | null>(null);
  const [addDialerBusy, setAddDialerBusy] = useState(false);
  /** Selected Non Performing row ids for Add Dialer Data (Laxmi checkboxes). */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [altOpen, setAltOpen] = useState(false);
  const [altUser, setAltUser] = useState<DetailRow | null>(null);
  const [altMobile, setAltMobile] = useState('');
  const [altLoading, setAltLoading] = useState(false);

  const load = useCallback(async () => {
    if (!empCode) return;
    setLoading(true);
    try {
      // Mirror laxminarayan callerDetails Active/Inactive payload exactly:
      // startDate = yesterday, endDate = 4 days ago (intentionally reversed).
      const [todayBundle, warning, aiRes] = await Promise.all([
        fetchAllTodayUsers({ empCode, startDate, endDate }),
        fetchAllWarningUsers({ empCode, userId: user?._id ? String(user._id) : undefined }),
        secureApi<ActiveInactivePayload>('caller.callerActiveInactive', {
          empCode,
          startDate: formatDaysAgoLocal(1),
          endDate: formatDaysAgoLocal(4),
          filter: {},
        }),
      ]);

      const { active, inactive } = unwrapActiveInactive(aiRes.data);

      const combined: DetailRow[] = [
        ...todayBundle.users.map((u) => ({ ...u, status: 'Today' })),
        ...active.map((u) => ({ ...u, status: 'Active' })),
        ...warning.items.map((u) => ({ ...u, status: 'Warning' })),
        ...inactive.map((u) => ({ ...u, status: 'Inactive' })),
      ];
      setRows(combined);
      setCounts({
        Today: todayBundle.count || todayBundle.users.length,
        Active: active.length,
        Warning: warning.total || warning.items.length,
        Inactive: inactive.length,
      });
      setTodayPage(1);
      setSelectedIds(new Set());

      if (!aiRes.ok && todayBundle.users.length === 0 && warning.items.length === 0) {
        toast.error('Failed to load caller details');
      }
    } finally {
      setLoading(false);
    }
  }, [empCode, startDate, endDate, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dialerCall = useCallback(
    async (item: DetailRow) => {
      const ids = extensionIds(user);
      const numericCampaignId = ids.find((val) => /^\d+$/.test(val)) || '';
      if (!numericCampaignId) {
        toast.error('Dialer extension / campaign ID not found for this admin');
        return;
      }
      const mobile = String(item.mobile || item.userMobile || '');
      if (!mobile) {
        toast.error('Mobile number not found');
        return;
      }
      const rowId = String(item._id || item.userId || '');
      setDialerBusyId(rowId);
      try {
        const res = await secureApi('callLogs.externalDialerSingle', {
          details: {
            client_name: item.name || item.userName,
            phone_number: mobile,
            city: item.city,
            state: item.state,
            clientName: item.clientName,
            app_name: item.clientName,
            caller_user_id: item._id,
          },
          extensionId: ids,
          adminName: user?.name || 'ADMIN',
          serverId: user?.serverId,
        });
        if (!res.ok) {
          toast.error(res.message || 'API request failed');
          return;
        }
        toast.success(res.message || 'Data sent successfully');
      } finally {
        setDialerBusyId(null);
      }
    },
    [user],
  );

  /** Laxmi addDialerData — push checked Non Performing customers to dialer. */
  const addDialerData = useCallback(async () => {
    const ids = extensionIds(user);
    const numericCampaignId = ids.find((val) => /^\d+$/.test(val)) || '';
    if (!numericCampaignId) {
      toast.error('Dialer extension / campaign ID not found for this admin');
      return;
    }

    const selected = rows.filter(
      (r) =>
        r.status === 'Warning' &&
        selectedIds.has(String(r._id || r.userId || '')),
    );
    const leads = selected
      .map((item) => ({
        first_name: String(item.name || item.userName || ''),
        phone_number: String(item.mobile || item.userMobile || ''),
        city: String(item.city || ''),
        state: String(item.state || ''),
        email: String(item.clientName || ''),
        comments: String(item.clientName || ''),
        province: String(item._id || ''),
      }))
      .filter((l) => l.phone_number.replace(/\D/g, ''));

    if (!leads.length) {
      toast.error('Leads should not be empty.');
      return;
    }

    setAddDialerBusy(true);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId: numericCampaignId,
        campaign_id: numericCampaignId,
        listId: `9${numericCampaignId}`,
        list_id: `9${numericCampaignId}`,
        listName: `${String(user?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
        list_name: `${String(user?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
        leads,
        serverId: user?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'API request failed');
        return;
      }
      toast.success(res.message || 'Data sent successfully');
      setSelectedIds(new Set());
    } finally {
      setAddDialerBusy(false);
    }
  }, [rows, selectedIds, user]);

  const rowKey = (r: DetailRow) => String(r._id || r.userId || '');

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const openAlternateMobile = (item: DetailRow) => {
    setAltUser(item);
    setAltMobile('');
    setAltOpen(true);
  };

  const closeAlternateMobile = () => {
    setAltOpen(false);
    setAltUser(null);
    setAltMobile('');
  };

  const handleAlternateMobile = async (action: 'add' | 'remove') => {
    const mobile = altMobile.trim();
    if (!mobile) {
      toast.error('Please enter mobile number');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!altUser?._id) {
      toast.error('User not found');
      return;
    }
    if (
      action === 'add' &&
      alternateMobileList(altUser.alternateMobile).length >= 1
    ) {
      toast.error('Only 1 alternate mobile is allowed');
      return;
    }
    setAltLoading(true);
    try {
      const res = await secureApi('users.updateAlternateMobile', {
        _id: altUser._id,
        mobile,
        action,
        updatedBy: {
          userId: user?._id,
          userName: user?.name,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Something went wrong');
        return;
      }
      toast.success(
        action === 'add'
          ? 'Alternate mobile added successfully'
          : 'Alternate mobile removed successfully',
      );
      closeAlternateMobile();
      await load();
    } finally {
      setAltLoading(false);
    }
  };

  const filteredAll = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.status !== tab) return false;
      if (!q) return true;
      const name = String(r.name || r.userName || '').toLowerCase();
      return name.includes(q);
    });
  }, [rows, tab, searchName]);

  const filtered = useMemo(() => {
    if (tab !== 'Today') return filteredAll;
    const start = (todayPage - 1) * todayPageSize;
    return filteredAll.slice(start, start + todayPageSize);
  }, [filteredAll, tab, todayPage, todayPageSize]);

  const todayTotalPages = Math.max(
    1,
    Math.ceil((tab === 'Today' ? filteredAll.length : 0) / todayPageSize) || 1,
  );

  const allWarningSelected =
    tab === 'Warning' &&
    filteredAll.length > 0 &&
    filteredAll.every((r) => selectedIds.has(rowKey(r)));

  const toggleSelectAllWarning = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of filteredAll) {
          const id = rowKey(r);
          if (!id) continue;
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [filteredAll],
  );

  const columns = useMemo<CommonTableColumn<DetailRow>[]>(() => {
    const cols: CommonTableColumn<DetailRow>[] = [];

    if (tab === 'Warning') {
      cols.push({
        id: 'select',
        label: (
          <Checkbox
            size="small"
            checked={allWarningSelected}
            indeterminate={
              selectedIds.size > 0 && !allWarningSelected && filteredAll.length > 0
            }
            onChange={(e) => toggleSelectAllWarning(e.target.checked)}
            inputProps={{ 'aria-label': 'Select all non performing' }}
          />
        ),
        width: 52,
        render: (r) => {
          const id = rowKey(r);
          return (
            <Checkbox
              size="small"
              checked={selectedIds.has(id)}
              onChange={(e) => toggleSelect(id, e.target.checked)}
              inputProps={{ 'aria-label': `Select ${id}` }}
            />
          );
        },
      });
    }

    cols.push(
      {
        id: '#',
        label: '#',
        width: 64,
        render: (_r, i) =>
          tab === 'Today' ? (todayPage - 1) * todayPageSize + i + 1 : i + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: 180,
        render: (r) => {
          const label = String(r.name || r.userName || '-');
          const id = String(r._id || r.userId || '');
          if (!id || label === '-') return label;
          if (!canOpenUserReport) return label;
          return (
            <Typography
              component="button"
              type="button"
              title={label}
              onClick={(e) => {
                e.stopPropagation();
                // Laxmi callerDetails: /user-report/:id/:name
                navigate(
                  `/users/report/${encodeURIComponent(id)}/${encodeURIComponent(label)}`,
                );
              }}
              sx={{
                all: 'unset',
                cursor: 'pointer',
                color: '#4fc3f7',
                fontSize: 12,
                fontWeight: 600,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {label}
            </Typography>
          );
        },
      },
      {
        id: 'dp',
        label: 'DP ID',
        width: 220,
        render: (r) => <CopyText value={String(r._id || r.userId || '')} />,
      },
      {
        id: 'mobile',
        label: 'Mobile',
        width: 180,
        render: (r) => {
          const mobile = String(r.mobile || r.userMobile || '');
          const id = rowKey(r);
          const busy = dialerBusyId === id;
          return (
            <Stack spacing={0.5} alignItems="center" sx={{ py: 0.25 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {canShowMobile && mobile ? (
                  <CopyText value={mobile} />
                ) : (
                  <Typography variant="body2" sx={{ fontSize: 12 }}>
                    {maskMobile(mobile, canShowMobile)}
                  </Typography>
                )}
                {canShowMobile && (
                  <Tooltip title="Add / Remove Alternate Mobile">
                    <IconButton
                      size="small"
                      onClick={() => openAlternateMobile(r)}
                      sx={{ color: '#1976d2', p: 0.25 }}
                    >
                      <AddIcCallIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                disabled={busy || !mobile}
                onClick={() => void dialerCall(r)}
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  py: 0.15,
                  px: 1,
                  minWidth: 0,
                  lineHeight: 1.4,
                }}
              >
                {busy ? 'Sending…' : 'Dialer Call'}
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'alternateMobile',
        label: 'Alternate Mobile',
        width: 140,
        render: (r) => formatAlternateMobile(r.alternateMobile, canShowMobile),
      },
      {
        id: 'app',
        label: 'App Code',
        width: 120,
        render: (r) => appCodeForName(r.clientName || r.appName),
      },
      {
        id: 'createdAt',
        label: 'Created At',
        width: 130,
        render: (r) =>
          formatDisplayDate(r.createdOn || r.createdAt) || '-',
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        width: 130,
        render: (r) =>
          formatDisplayDate(
            r.activeUser || r.lastActivity || r.lastActive,
          ) || '-',
      },
      {
        id: 'city',
        label: 'City',
        width: 140,
        render: (r) => String(r.city || '-'),
      },
      {
        id: 'state',
        label: 'State',
        width: 140,
        render: (r) => String(r.state || '-'),
      },
    );
    return cols;
  }, [
    canShowMobile,
    canOpenUserReport,
    navigate,
    tab,
    todayPage,
    todayPageSize,
    dialerBusyId,
    dialerCall,
    allWarningSelected,
    selectedIds,
    filteredAll.length,
    toggleSelect,
    toggleSelectAllWarning,
  ]);

  if (!empCode) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Caller Details
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No caller selected.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const ecs = nav.activePlayersECS || {};
  const hasAlternateMobile =
    alternateMobileList(altUser?.alternateMobile).length >= 1;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Caller Details — {empCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Deposit:{' '}
            {nav.deposit != null ? formatMaskedAmount(nav.deposit) : '-'}
            {' · '}
            E:{String(ecs.E ?? '-')} C:{String(ecs.C ?? '-')} S:
            {String(ecs.S ?? '-')}
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            label="Search by Name"
            size="small"
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value);
              setTodayPage(1);
            }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 160 } }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 160 } }}
          />
          {tab === 'Today' && (
            <TextField
              select
              label="Items Per Page"
              size="small"
              value={String(todayPageSize)}
              onChange={(e) => {
                setTodayPageSize(Number(e.target.value));
                setTodayPage(1);
              }}
              sx={{ width: { xs: '100%', sm: 130 } }}
            >
              {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => void addDialerData()}
            disabled={loading || addDialerBusy || selectedIds.size === 0}
          >
            {addDialerBusy
              ? 'Sending…'
              : selectedIds.size > 0
                ? `Add Dialer Data (${selectedIds.size})`
                : 'Add Dialer Data'}
          </Button>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Stack>

      <Box sx={{ flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => {
            setTab(v);
            setTodayPage(1);
            setSelectedIds(new Set());
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none' },
          }}
        >
          {(
            [
              { key: 'Today', label: 'Today' },
              { key: 'Active', label: 'Active' },
              { key: 'Warning', label: 'Non Performing Users' },
              { key: 'Inactive', label: 'Inactive' },
            ] as const
          ).map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={`${t.label} (${counts[t.key]})`}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
        <CommonTable
          columns={columns}
          rows={filtered}
          getRowKey={(r, i) => String(r._id || r.userId || i)}
          loading={loading}
          emptyMessage="No users in this tab"
          stickyHeader
          minWidth={1600}
          maxHeight="calc(100vh - 220px)"
        />
      </Box>

      {tab === 'Today' && todayTotalPages > 1 && (
        <Stack direction="row" justifyContent="center" py={1}>
          <Pagination
            color="primary"
            page={todayPage}
            count={todayTotalPages}
            onChange={(_e, p) => setTodayPage(p)}
          />
        </Stack>
      )}

      <Dialog
        open={altOpen}
        onClose={() => {
          if (!altLoading) closeAlternateMobile();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Alternate Mobile</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Only 1 alternate mobile is allowed per user.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Mobile number"
            value={altMobile}
            onChange={(e) => setAltMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            disabled={altLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAlternateMobile} disabled={altLoading}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => void handleAlternateMobile('remove')}
            disabled={altLoading || !hasAlternateMobile}
          >
            Remove
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAlternateMobile('add')}
            disabled={altLoading || hasAlternateMobile}
          >
            {altLoading ? 'Please wait…' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
