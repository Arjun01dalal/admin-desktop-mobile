import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  CAMPAIGN_LIST,
  buildExtensionAssigneeMap,
  dialerCampaignLabel,
  pickPageSizes,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { canAccessNavItem, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { todayIST, formatDisplayDate, formatDisplayTime } from '@/utils/dates';

type DialerPushRow = Record<string, unknown> & {
  _id?: string;
  list_id?: string | number;
  list_name?: string;
  campaign_id?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  city?: string;
  state?: string;
  email?: string;
  province?: string;
  subAdminId?: string;
  subAdminName?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZES = pickPageSizes([10, 25, 50, 100, 200, 500, 1000]);

const COLUMN_LABELS: Record<string, string> = {
  province: 'User ID',
  Province: 'User ID',
  provience: 'User ID',
  Provience: 'User ID',
  userId: 'User ID',
  user_id: 'User ID',
  email: 'App Name',
  phone_number: 'Mobile No',
  last_name: 'Last Name',
  first_name: 'First Name',
  subAdminId: 'SubAdmin ID',
  campaign_id: 'Campaign ID',
  list_id: 'List ID',
  list_name: 'List Name',
  createdAt: 'Created On',
  createdOn: 'Created On',
  created_at: 'Created On',
  updatedAt: 'Updated On',
  updatedOn: 'Updated On',
  updated_at: 'Updated On',
  city: 'City',
  state: 'State',
};

const HIDDEN_COLUMNS = new Set([
  '__v',
  '_id',
  'comments',
  'subAdminName',
  'campaign_id',
  'count',
  'data',
  'items',
  'leads',
  'records',
  'docs',
]);

const FALLBACK_COLUMNS = [
  'list_id',
  'list_name',
  'first_name',
  'last_name',
  'phone_number',
  'city',
  'state',
  'email',
  'province',
  'userId',
  'subAdminId',
  'createdAt',
  'createdOn',
  'updatedAt',
  'updatedOn',
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const obj = value as { $date?: string };
    if (obj?.$date) return formatDateTime(obj.$date);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  const joined = [d, t].filter(Boolean).join(' ');
  return joined || '—';
}

const META_KEYS = new Set([
  'totalCount',
  'total',
  'count',
  'totalPages',
  'pageNo',
  'itemsPerPage',
  'pagination',
  'payload',
  'success',
  'message',
  'status',
  'statusCode',
]);

/** List wrapper keys — never treat these as Campaign IDs. */
const LIST_KEYS = new Set([
  'data',
  'items',
  'docs',
  'leads',
  'records',
  'list',
  'result',
  'results',
]);

/** True when row looks like a real dialer lead (not a campaign wrapper). */
function isLeadRow(row: Record<string, unknown>): boolean {
  return (
    row.list_id != null ||
    row.phone_number != null ||
    row.first_name != null ||
    row.list_name != null ||
    row.province != null
  );
}

function withCampaign(lead: DialerPushRow, wrapperCampaign?: string | number): DialerPushRow {
  if (lead.campaign_id != null && String(lead.campaign_id).trim() !== '') {
    return lead;
  }
  if (wrapperCampaign == null || String(wrapperCampaign).trim() === '') {
    return lead;
  }
  return { ...lead, campaign_id: String(wrapperCampaign) };
}

/**
 * Expand campaign-keyed objects:
 * `{ "1011": { count, data: [...] }, "1020": [...] }` → all leads.
 * Must walk EVERY key — stopping at the first campaign was dropping the rest.
 */
function extractCampaignMap(obj: Record<string, unknown>): DialerPushRow[] {
  const out: DialerPushRow[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (META_KEYS.has(key) || LIST_KEYS.has(key)) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        if (isLeadRow(item as Record<string, unknown>)) {
          out.push(withCampaign(item as DialerPushRow, key));
        } else {
          out.push(...flattenDialerRows([item], key));
        }
      }
      continue;
    }

    if (!value || typeof value !== 'object') continue;
    const group = value as Record<string, unknown>;

    const nested =
      group.data ?? group.items ?? group.leads ?? group.records ?? group.docs ?? group.list;

    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        out.push(
          withCampaign(
            item as DialerPushRow,
            (group.campaign_id as string | number | undefined) ?? key,
          ),
        );
      }
      continue;
    }

    if (isLeadRow(group)) {
      out.push(withCampaign(group as DialerPushRow, key));
      continue;
    }

    // Nested campaign map / wrapper without a standard list key.
    out.push(...flattenDialerRows([group], key));
  }
  return out;
}

function isCampaignMapObject(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).filter((k) => !META_KEYS.has(k) && !LIST_KEYS.has(k));
  if (keys.length === 0) return false;
  let hits = 0;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      hits += 1;
      continue;
    }
    if (v && typeof v === 'object') {
      const g = v as Record<string, unknown>;
      if (
        Array.isArray(g.data) ||
        Array.isArray(g.items) ||
        Array.isArray(g.leads) ||
        typeof g.count === 'number' ||
        isLeadRow(g)
      ) {
        hits += 1;
      }
    }
  }
  // Majority of non-meta keys look like per-campaign buckets.
  return hits > 0 && hits >= Math.ceil(keys.length * 0.5);
}

/**
 * API sometimes returns wrappers like:
 * `{ campaign_id, count, data: [lead, ...] }` or campaign-keyed maps.
 * Flatten to individual lead rows for the table.
 */
function flattenDialerRows(list: unknown[], inheritedCampaign?: string | number): DialerPushRow[] {
  const out: DialerPushRow[] = [];

  for (const entry of list) {
    if (entry == null) continue;

    if (Array.isArray(entry)) {
      out.push(...flattenDialerRows(entry, inheritedCampaign));
      continue;
    }

    if (typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;

    if (isLeadRow(row)) {
      out.push(withCampaign(row as DialerPushRow, inheritedCampaign));
      continue;
    }

    // One object that is itself a multi-campaign map.
    if (isCampaignMapObject(row)) {
      out.push(...extractCampaignMap(row));
      continue;
    }

    const nested =
      row.data ??
      row.items ??
      row.leads ??
      row.records ??
      row.docs ??
      row.list ??
      row.result ??
      row.results;

    const campaignHint =
      row.campaign_id != null ? (row.campaign_id as string | number) : inheritedCampaign;

    if (Array.isArray(nested)) {
      out.push(...flattenDialerRows(nested, campaignHint));
      continue;
    }

    // Collect leads from EVERY array-valued field (do not break after first).
    let foundArray = false;
    for (const [key, value] of Object.entries(row)) {
      if (META_KEYS.has(key) || key === 'campaign_id' || key === 'subAdminId') {
        continue;
      }
      if (!Array.isArray(value) || value.length === 0) continue;
      if (!value[0] || typeof value[0] !== 'object' || Array.isArray(value[0])) {
        continue;
      }
      foundArray = true;
      out.push(...flattenDialerRows(value, campaignHint));
    }
    if (!foundArray && isLeadRow(row)) {
      out.push(withCampaign(row as DialerPushRow, campaignHint));
    }
  }

  return out;
}

function unpackList(data: unknown): {
  rows: DialerPushRow[];
  total: number;
  totalPages: number;
} {
  const metaRoot =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const metaPayload =
    metaRoot.payload && typeof metaRoot.payload === 'object' && !Array.isArray(metaRoot.payload)
      ? (metaRoot.payload as Record<string, unknown>)
      : metaRoot.data && typeof metaRoot.data === 'object' && !Array.isArray(metaRoot.data)
        ? (metaRoot.data as Record<string, unknown>)
        : metaRoot;

  const attempts: unknown[] = [data];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    attempts.push(
      obj.payload,
      obj.items,
      obj.docs,
      obj.leads,
      obj.records,
      obj.result,
      obj.results,
      obj.list,
      obj.data,
      (obj.payload as Record<string, unknown> | undefined)?.items,
      (obj.payload as Record<string, unknown> | undefined)?.data,
      (obj.payload as Record<string, unknown> | undefined)?.docs,
      (obj.payload as Record<string, unknown> | undefined)?.leads,
      (obj.data as Record<string, unknown> | undefined)?.items,
      (obj.data as Record<string, unknown> | undefined)?.docs,
    );
  }

  // Prefer the interpretation that yields the most lead rows (avoids taking only
  // the first campaign's nested `data` array when a campaign map is present).
  let rows: DialerPushRow[] = [];
  for (const attempt of attempts) {
    if (attempt == null) continue;
    let candidate: DialerPushRow[] = [];
    if (Array.isArray(attempt)) {
      candidate = flattenDialerRows(attempt);
    } else if (typeof attempt === 'object') {
      const obj = attempt as Record<string, unknown>;
      if (isCampaignMapObject(obj)) {
        candidate = extractCampaignMap(obj);
      } else {
        candidate = flattenDialerRows([obj]);
      }
    }
    if (candidate.length > rows.length) {
      rows = candidate;
    }
  }

  const total = Number(
    metaPayload.totalCount ??
      (metaPayload.pagination as { totalCount?: number } | undefined)?.totalCount ??
      metaPayload.total ??
      rows.length,
  );

  const totalPages = Number(
    metaPayload.totalPages ??
      (metaPayload.pagination as { totalPages?: number } | undefined)?.totalPages ??
      0,
  );

  return {
    rows,
    total: Number.isFinite(total) ? total : rows.length,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 0,
  };
}

/** Dialer Push Data — lists SubAdmin/get-dialer-datas records. */
export function DialerPushDataPage() {
  // Full-access / dialer_push_data / call_logs (same audience that pushes to dialer).
  const canView =
    canAccessNavItem({
      id: 'dialerPushData',
      permission: Permissions.dialer_push_data,
    }) ||
    canAccessNavItem({
      id: 'callLogs',
      permission: Permissions.call_logs,
    });

  const [listId, setListId] = useState('');
  const [listName, setListName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [subAdminId, setSubAdminId] = useState('');
  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [pageNo, setPageNo] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DialerPushRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  /** extension / dialer id → assignee name (Caller Allotment). */
  const [extensionAssigneeMap, setExtensionAssigneeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await secureApi<{ byRole?: unknown[] }>('ops.callerAllotmentSubadmins', {
          filter: {},
        });
        if (cancelled || !res.ok) return;
        const raw = (res.data ?? {}) as Record<string, unknown>;
        const byRole = (raw.byRole ??
          (raw.payload as Record<string, unknown> | undefined)?.byRole ??
          []) as Array<{
          subAdmins?: Array<Record<string, unknown>>;
        }>;
        setExtensionAssigneeMap(buildExtensionAssigneeMap(byRole));
      } catch {
        /* non-fatal — campaign headers still show without assignee */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const load = useCallback(
    async (page = pageNo) => {
      if (startDate && endDate && startDate > endDate) {
        toast.error('From date cannot be greater than To date');
        return;
      }

      setLoading(true);
      try {
        const body: Record<string, unknown> = {
          pageNo: page,
          itemsPerPage: Number(itemsPerPage),
          startDate,
          endDate,
        };
        const trimmedListId = listId.trim();
        const trimmedListName = listName.trim();
        const trimmedCampaignId = campaignId.trim();
        const trimmedSubAdminId = subAdminId.trim();
        if (trimmedListId) {
          body.list_id = Number(trimmedListId) || trimmedListId;
        }
        if (trimmedListName) body.list_name = trimmedListName;
        if (trimmedCampaignId) body.campaign_id = trimmedCampaignId;
        if (trimmedSubAdminId) body.subAdminId = trimmedSubAdminId;

        const res = await secureApi('callLogs.getDialerDatas', body);
        if (!res.ok) {
          toast.error(res.message || 'Failed to load dialer push data');
          setRows([]);
          setTotalCount(0);
          setTotalPages(1);
          return;
        }

        const unpacked = unpackList(res.data);
        setRows(unpacked.rows);
        setTotalCount(unpacked.total);
        const pagesFromCount = Math.max(
          1,
          Math.ceil(unpacked.total / Math.max(1, Number(itemsPerPage))),
        );
        setTotalPages(unpacked.totalPages > 0 ? unpacked.totalPages : pagesFromCount);
        if (unpacked.rows.length === 0 && unpacked.total === 0) {
          // Soft hint — empty is valid when no pushes in range.
          // Avoid noisy toasts on every filter change.
        }
      } finally {
        setLoading(false);
      }
    },
    [pageNo, itemsPerPage, startDate, endDate, listId, listName, campaignId, subAdminId],
  );

  useEffect(() => {
    if (!canView) return;
    void load(pageNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, pageNo, itemsPerPage]);

  const handleApply = useCallback(() => {
    if (pageNo !== 1) setPageNo(1);
    else void load(1);
  }, [pageNo, load]);

  const columnsKeys = useMemo(() => {
    if (!rows.length) return FALLBACK_COLUMNS;
    return Object.keys(rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key));
  }, [rows]);

  const groupedByCampaign = useMemo(() => {
    const groups: Record<string, DialerPushRow[]> = {};
    for (const row of rows) {
      const key =
        row?.campaign_id !== undefined &&
        row?.campaign_id !== null &&
        String(row.campaign_id).trim() !== ''
          ? String(row.campaign_id).trim()
          : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [rows]);

  // First campaign open by default; rest collapsed. Reset when groups change.
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>({});
  /** Per-campaign page for the nested table (50 rows at a time). */
  const [campaignPage, setCampaignPage] = useState<Record<string, number>>({});
  const CAMPAIGN_PAGE_SIZE = 50;

  useEffect(() => {
    if (!groupedByCampaign.length) {
      setOpenCampaigns({});
      setCampaignPage({});
      return;
    }
    const next: Record<string, boolean> = {};
    const pages: Record<string, number> = {};
    groupedByCampaign.forEach(([key], index) => {
      next[key] = index === 0;
      pages[key] = 1;
    });
    setOpenCampaigns(next);
    setCampaignPage(pages);
  }, [groupedByCampaign]);

  const toggleCampaign = useCallback((campaignKey: string) => {
    setOpenCampaigns((prev) => ({
      ...prev,
      [campaignKey]: !prev[campaignKey],
    }));
  }, []);

  const makeColumns = useCallback(
    (rowOffset = 0): CommonTableColumn<DialerPushRow>[] => [
      {
        id: 'sr',
        label: 'SR',
        width: 56,
        render: (_row, index) => String(rowOffset + index + 1),
      },
      ...columnsKeys.map((col) => ({
        id: col,
        label: COLUMN_LABELS[col] || col,
        width: col === 'province' || col === 'subAdminId' ? 160 : 120,
        render: (row: DialerPushRow) => {
          if (col === 'subAdminId') {
            const idValue = display(row.subAdminId);
            const nameValue = String(row.subAdminName || '').trim();
            return (
              <Box sx={{ lineHeight: 1.25 }}>
                <div>{idValue}</div>
                {nameValue ? (
                  <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {nameValue}
                  </Typography>
                ) : null}
              </Box>
            );
          }
          if (
            col === 'createdAt' ||
            col === 'updatedAt' ||
            col === 'createdOn' ||
            col === 'updatedOn' ||
            col === 'created_at' ||
            col === 'updated_at'
          ) {
            return formatDateTime(row[col]);
          }
          return display(row[col]);
        },
      })),
    ],
    [columnsKeys],
  );

  if (!canView) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography color="text.secondary">
          You do not have permission to view this page.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 1.5 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexShrink: 0, lineHeight: '46px', mb: 0 }}>
          Dialer Push Data
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CollapsibleFilterPanel
            title="Filters"
            summary={`${startDate} – ${endDate} · ${totalCount} total`}
            sx={{ mb: 0 }}
            contentSx={{ overflowX: 'auto' }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                type="date"
                label="From Date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={{ width: 160 }}
              />
              <TextField
                type="date"
                label="To Date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={{ width: 160 }}
              />
              <TextField
                label="List ID"
                size="small"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                sx={{ width: 120 }}
              />
              <TextField
                label="List Name"
                size="small"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                sx={{ width: 140 }}
              />
              <TextField
                select
                label="Campaign ID"
                size="small"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                sx={{ width: 220 }}
              >
                <MenuItem value="">All</MenuItem>
                {CAMPAIGN_LIST.map((item) => (
                  <MenuItem key={item.id} value={item.id.trim()}>
                    {item.id.trim()} - {item.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Sub Admin ID"
                size="small"
                value={subAdminId}
                onChange={(e) => setSubAdminId(e.target.value)}
                sx={{ width: 180 }}
              />
              <TextField
                select
                label="Rows"
                size="small"
                value={String(itemsPerPage)}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setPageNo(1);
                }}
                sx={{ width: 100 }}
              >
                {PAGE_SIZES.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                onClick={handleApply}
                disabled={loading}
                sx={{ fontWeight: 700 }}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => void load(pageNo)}
                disabled={loading}
                sx={{ fontWeight: 700 }}
              >
                Refresh
              </Button>
              {loading ? <CircularProgress size={22} /> : null}
            </Stack>
          </CollapsibleFilterPanel>
        </Box>
      </Stack>

      {!loading && rows.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography color="text.secondary">No data found</Typography>
        </Box>
      ) : (
        groupedByCampaign.map(([campaignKey, campaignRows]) => {
          const isOpen = Boolean(openCampaigns[campaignKey]);
          const page = Math.max(1, campaignPage[campaignKey] || 1);
          const campaignTotalPages = Math.max(
            1,
            Math.ceil(campaignRows.length / CAMPAIGN_PAGE_SIZE),
          );
          const safePage = Math.min(page, campaignTotalPages);
          const pageStart = (safePage - 1) * CAMPAIGN_PAGE_SIZE;
          const pagedRows = campaignRows.slice(pageStart, pageStart + CAMPAIGN_PAGE_SIZE);
          return (
            <Box key={campaignKey} sx={{ mb: 1.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onClick={() => toggleCampaign(campaignKey)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton
                    size="small"
                    aria-label={isOpen ? 'Collapse campaign' : 'Expand campaign'}
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCampaign(campaignKey);
                    }}
                    sx={{
                      p: 0.25,
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </IconButton>
                  <Typography fontWeight={700}>
                    {dialerCampaignLabel(campaignKey, extensionAssigneeMap)}
                  </Typography>
                </Stack>
                <Typography variant="body2">Count: {campaignRows.length}</Typography>
              </Stack>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <Box sx={{ minWidth: 0, overflowX: 'auto', mt: 1 }}>
                  <CommonTable
                    columns={makeColumns(pageStart)}
                    rows={pagedRows}
                    getRowKey={(row, index) =>
                      String(row._id || `${campaignKey}-${pageStart + index}`)
                    }
                    loading={loading}
                    emptyMessage="No data found"
                    stickyHeader
                    dense
                    minWidth={1400}
                  />
                </Box>
                {campaignTotalPages > 1 ? (
                  <Stack
                    alignItems="center"
                    sx={{ mt: 1.25, mb: 0.5 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pagination
                      count={campaignTotalPages}
                      page={safePage}
                      color="primary"
                      size="small"
                      showFirstButton
                      showLastButton
                      onChange={(_e, value) =>
                        setCampaignPage((prev) => ({
                          ...prev,
                          [campaignKey]: value,
                        }))
                      }
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Showing {pageStart + 1}–
                      {Math.min(pageStart + CAMPAIGN_PAGE_SIZE, campaignRows.length)} of{' '}
                      {campaignRows.length}
                    </Typography>
                  </Stack>
                ) : null}
              </Collapse>
            </Box>
          );
        })
      )}

      {totalPages > 0 ? (
        <Stack alignItems="center" sx={{ mt: 2, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={pageNo}
            color="primary"
            showFirstButton
            showLastButton
            onChange={(_e, value) => setPageNo(value)}
          />
        </Stack>
      ) : null}
    </Box>
  );
}
