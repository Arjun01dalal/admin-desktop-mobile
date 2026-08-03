import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { formatDisplayDate, todayIST } from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { BOT_ID_OPTIONS } from '@/screens/panel/callLogs/constants';
import { CAMPAIGN_LIST } from '@/screens/panel/newRegisters/campaignList';
import { asPaged, display, maskMobile, useReportQuery } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import { mapUsersToDialerLeads } from '@/screens/panel/users/toolbarHelpers';
import type { UserRow } from '@/screens/panel/users/utils';

type BotPerfRow = {
  _id: string;
  name?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  client_name?: string;
  empCode?: string;
  bot_id?: string | number;
  balance?: number | string;
  createdOn?: string;
  activeUser?: string;
  phone_number?: string;
};

type ColumnFilters = {
  name: string;
  mobile: string;
  city: string;
  state: string;
  clientName: string;
  empCode: string;
  min: string;
  max: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  type: string;
  botIds: string[];
  filters: ColumnFilters;
};

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  mobile: '',
  city: '',
  state: '',
  clientName: '',
  empCode: '',
  min: '',
  max: '',
};

const TYPE_OPTIONS = [
  'non_performing',
  'active',
  'today_active',
  'inactive',
  'active_by_bot',
] as const;

const PAGE_SIZE_OPTIONS = [
  ...ITEMS_PER_PAGE_OPTIONS,
  '1000',
  '1500',
  '5000',
  '10000',
  '20000',
] as const;

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
  overflow: 'visible',
  '&:hover': { bgcolor: '#e08c00' },
};

const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

function formatBalance(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

export function BotPerformancePage() {
  const canShowMobile = hasPermission('show_mobile');
  const today = todayIST();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<string>('non_performing');
  const [botIds, setBotIds] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    type: 'non_performing',
    botIds: [],
    filters: EMPTY_FILTERS,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    const f = query.filters;
    if (f.name.trim()) filter.name = f.name.trim();
    if (f.clientName) filter.clientName = f.clientName;
    if (f.state) filter.state = f.state;
    if (f.mobile.trim()) filter.mobile = f.mobile.trim();
    if (f.city.trim()) filter.city = f.city.trim();
    if (f.empCode.trim()) filter.empCode = f.empCode.trim();
    if (f.min) filter.min = Number(f.min);
    if (f.max) filter.max = Number(f.max);

    return {
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate,
      pageNo: page,
      itemPerPage: itemsPerPage,
      botId: query.botIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)),
      status: 'completed',
      filter,
    };
  }, [query, page, itemsPerPage]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<BotPerfRow>(res.data), []);

  const { rows, totalPages, loading, load } = useReportQuery<BotPerfRow>({
    action: 'botPerformance.callerUserActivity',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, query],
    errorMessage: 'Failed to load bot performance',
    cacheTtlMs: 0,
  });

  const commitQuery = useCallback(
    (filters: ColumnFilters = draft) => {
      setQuery({
        startDate,
        endDate,
        type,
        botIds,
        filters,
      });
      setPage(1);
      setSelectedIds(new Set());
    },
    [startDate, endDate, type, botIds, draft],
  );

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const onDraftChange =
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r._id));

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r) => r._id).filter(Boolean)));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const addToDialer = async () => {
    if (!campaignId) {
      toast.error('Campaign should not be empty');
      return;
    }
    const selected = rows.filter((r) => selectedIds.has(r._id));
    if (!selected.length) {
      toast.error('Select at least one user');
      return;
    }
    const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId.trim());
    setPushing(true);
    try {
      const leads = mapUsersToDialerLeads(
        selected.map(
          (r): UserRow => ({
            _id: r._id,
            name: r.name || r.client_name,
            mobile: r.mobile || r.phone_number,
            city: r.city,
            state: r.state,
            clientName: r.clientName,
          }),
        ),
      );
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId: campaignId.trim(),
        leads,
        serverId: campaign?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add to dialer');
        return;
      }
      toast.success(res.message || 'Added to dialer');
      setSelectedIds(new Set());
      void load();
    } finally {
      setPushing(false);
    }
  };

  const columns = useMemo<CommonTableColumn<BotPerfRow>[]>(
    () => [
      {
        id: 'select',
        label: (
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={selectedIds.size > 0 && !allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            sx={{ color: '#1a1200', '&.Mui-checked': { color: '#1a1200' } }}
          />
        ),
        width: 72,
        filter: (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {(page - 1) * itemsPerPage + 1}+
          </Typography>
        ),
        render: (row, index) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography sx={{ fontSize: 12, minWidth: 20 }}>
              {(page - 1) * itemsPerPage + index + 1}
            </Typography>
            <Checkbox
              size="small"
              checked={selectedIds.has(row._id)}
              onChange={(e) => toggleOne(row._id, e.target.checked)}
            />
          </Stack>
        ),
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <TableSearchBar
            value={draft.name}
            onChange={onDraftChange('name')}
            onSearch={() => commitQuery()}
            placeholder="Name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        render: (row) => display(row._id),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <TableSearchBar
            value={draft.mobile}
            onChange={onDraftChange('mobile')}
            onSearch={() => commitQuery()}
            placeholder="Mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile || row.phone_number, canShowMobile),
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
        render: (row) => display(row.city),
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
            onChange={(e) => setDraftField('state')(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
          >
            <MenuItem value="">All</MenuItem>
            {INDIA_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => display(row.state),
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
            onChange={(e) => setDraftField('clientName')(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
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
        id: 'empCode',
        label: 'Emp Code',
        filter: (
          <TableSearchBar
            value={draft.empCode}
            onChange={onDraftChange('empCode')}
            onSearch={() => commitQuery()}
            placeholder="Emp Code"
          />
        ),
        render: (row) => display(row.empCode),
      },
      {
        id: 'botId',
        label: 'Bot ID',
        render: (row) => display(row.bot_id),
      },
      {
        id: 'balance',
        label: 'Balance',
        filter: (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              size="small"
              placeholder="Min"
              value={draft.min}
              onChange={(e) => setDraftField('min')(e.target.value)}
              sx={{ width: 64, '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
            />
            <TextField
              size="small"
              placeholder="Max"
              value={draft.max}
              onChange={(e) => setDraftField('max')(e.target.value)}
              sx={{ width: 64, '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
            />
          </Stack>
        ),
        render: (row) => formatBalance(row.balance),
      },
      {
        id: 'createdOn',
        label: 'Created At',
        render: (row) => formatDisplayDate(row.createdOn) || '—',
      },
      {
        id: 'activeUser',
        label: 'Last Activity',
        render: (row) => formatDisplayDate(row.activeUser) || '—',
      },
    ],
    [
      allSelected,
      selectedIds,
      page,
      itemsPerPage,
      draft,
      canShowMobile,
      commitQuery,
      onDraftChange,
      setDraftField,
    ],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: '#1a1a1f',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
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
            label="Items / Page"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value) || 10);
              setPage(1);
              setSelectedIds(new Set());
            }}
            sx={fieldSx}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={fieldSx}
          >
            {TYPE_OPTIONS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Bot ID"
            SelectProps={{
              multiple: true,
              renderValue: (v) => {
                const vals = v as string[];
                return vals.length > 3
                  ? `${vals.slice(0, 3).join(', ')} +${vals.length - 3}`
                  : vals.join(', ') || 'All';
              },
            }}
            value={botIds}
            onChange={(e) => setBotIds(e.target.value as unknown as string[])}
            sx={fieldSx}
          >
            {BOT_ID_OPTIONS.map((id) => (
              <MenuItem key={id} value={id}>
                <Checkbox size="small" checked={botIds.includes(id)} />
                {id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Campaign"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">Select</MenuItem>
            {CAMPAIGN_LIST.map((c) => (
              <MenuItem key={c.id} value={c.id.trim()}>
                {c.id.trim()}
              </MenuItem>
            ))}
          </TextField>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ gridColumn: '1 / -1', pt: 0.25 }}
          >
            <Button
              variant="contained"
              disabled={loading}
              onClick={() => commitQuery()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Apply
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              disabled={loading}
              onClick={() => void load()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              disabled={pushing || !selectedIds.size}
              onClick={() => void addToDialer()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Add to Dialer
            </Button>
          </Stack>
        </Box>
      </Box>

      <CommonTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No records found"
        virtualize={false}
        getRowKey={(row) => row._id}
      />

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 1.5 }}>
          <Pagination
            count={Math.max(1, totalPages)}
            page={page}
            color="secondary"
            onChange={(_e, next) => {
              setPage(next);
              setSelectedIds(new Set());
            }}
          />
        </Stack>
      )}
    </Box>
  );
}
