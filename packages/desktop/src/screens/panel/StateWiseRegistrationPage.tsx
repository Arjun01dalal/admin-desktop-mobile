import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import {
  formatDisplayDate,
  formatDisplayTime,
  todayIST,
} from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { asPaged, display } from '@/screens/panel/shared';

type ColumnFilters = {
  name: string;
  mobile: string;
  email: string;
  state: string;
  city: string;
  clientName: string;
  empCode: string;
  deviceType: string;
  played: string;
  blockUser: string;
  dump: string;
  _id: string;
  balanceRange: string;
};

type StateWisePlayer = { state: string; count: number };

type UserRow = {
  _id: string;
  name?: string;
  mobile?: string;
  email?: string;
  kyc?: boolean;
  clientName?: string;
  city?: string;
  state?: string;
  empCode?: string;
  deviceType?: string;
  played?: string;
  createdOn?: string;
  activeUser?: string;
  balance?: number | string;
  bonusWalletBalance?: number | string;
  blockUser?: boolean;
  dump?: boolean;
};

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  mobile: '',
  email: '',
  state: '',
  city: '',
  clientName: '',
  empCode: '',
  deviceType: '',
  played: '',
  blockUser: '',
  dump: '',
  _id: '',
  balanceRange: '',
};

const PER_PAGE_KEY = 'registerUserReportItemsPerPage';
const PER_PAGE_OPTIONS = Array.from(
  new Set([...ITEMS_PER_PAGE_OPTIONS.map(Number), 10, 25, 50, 75, 100, 500]),
).sort((a, b) => a - b);

const dateFieldSx = {
  width: 160,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

const selectFieldSx = {
  width: 130,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
};

const applyBtnSx = {
  bgcolor: '#f39c12',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.4,
  textTransform: 'uppercase' as const,
  px: 2.5,
  height: 40,
  minWidth: 96,
  flexShrink: 0,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none' },
};

const checkboxSx = {
  m: 0,
  flexShrink: 0,
  whiteSpace: 'nowrap' as const,
  color: 'rgba(255,255,255,0.85)',
  '& .MuiFormControlLabel-label': { fontSize: 13, whiteSpace: 'nowrap' },
};

const filterSelectSx = {
  minWidth: 110,
  '& .MuiInputBase-root': {
    bgcolor: '#f4f6f8',
    color: '#1a1a1f',
    fontSize: 12,
    height: 34,
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#c5ccd6' },
  '& .MuiSvgIcon-root': { color: '#4a5568' },
};

function buildApiFilter(filters: ColumnFilters): Record<string, unknown> {
  const apiFilter: Record<string, unknown> = {
    name: filters.name || undefined,
    mobile: filters.mobile || undefined,
    email: filters.email || undefined,
    state: filters.state || undefined,
    city: filters.city || undefined,
    clientName: filters.clientName || undefined,
    empCode: filters.empCode || undefined,
    deviceType: filters.deviceType || undefined,
    played: filters.played || undefined,
    _id: filters._id || undefined,
  };

  if (filters.blockUser === 'block') apiFilter.blockUser = true;
  if (filters.blockUser === 'unblock') apiFilter.blockUser = false;
  if (filters.dump === 'dump') apiFilter.dump = true;
  if (filters.dump === 'non-dump') apiFilter.dump = false;

  if (filters.balanceRange) {
    const [min, max] = filters.balanceRange.split('-').map(Number);
    if (!Number.isNaN(min)) apiFilter.min = min;
    if (!Number.isNaN(max)) apiFilter.max = max;
  }

  return Object.fromEntries(
    Object.entries(apiFilter).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function parseStateWisePlayers(payloadData: Record<string, unknown> | null | undefined): StateWisePlayer[] {
  if (!payloadData) return [];

  const candidates = [
    payloadData.stateWise,
    payloadData.stateWisePlayers,
    payloadData.playersStateWise,
    payloadData.stateCounts,
    payloadData.stateWiseCount,
    payloadData.playersByState,
    payloadData.groupByState,
  ];

  let raw: unknown;
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (Array.isArray(candidate)) {
      raw = candidate;
      break;
    }
    if (typeof candidate === 'object') {
      const nested = candidate as { result?: unknown; data?: unknown };
      if (Array.isArray(nested.result)) {
        raw = nested.result;
        break;
      }
      if (Array.isArray(nested.data)) {
        raw = nested.data;
        break;
      }
      raw = candidate;
      break;
    }
  }

  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          state: String(row?.state ?? row?._id ?? row?.name ?? ''),
          count: Number(row?.count ?? row?.total ?? row?.players ?? 0),
        };
      })
      .filter((item) => item.state)
      .sort((a, b) => b.count - a.count);
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([state, value]) => ({
        state,
        count:
          typeof value === 'number'
            ? value
            : Number((value as { count?: number })?.count ?? 0),
      }))
      .filter((item) => item.state)
      .sort((a, b) => b.count - a.count);
  }

  return [];
}

function aggregateStateFromUsers(items: UserRow[]): StateWisePlayer[] {
  const counts = new Map<string, number>();
  for (const user of items) {
    const state = String(user?.state || '').trim() || 'Unknown';
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

function resolveStateWise(
  payloadData: Record<string, unknown> | null | undefined,
  items: UserRow[],
): StateWisePlayer[] {
  const fromPayload = parseStateWisePlayers(payloadData);
  if (fromPayload.length > 0) return fromPayload;
  return aggregateStateFromUsers(items);
}

function unpackReport(raw: unknown): {
  items: UserRow[];
  totalPages: number;
  total: number;
  payload: Record<string, unknown>;
} {
  const paged = asPaged<UserRow>(raw);
  const payload =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    items: paged.rows,
    totalPages: Math.max(1, paged.totalPages || 1),
    total: paged.total,
    payload,
  };
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={filterSelectSx}
      SelectProps={{ displayEmpty: true }}
    >
      {options.map((opt) => (
        <MenuItem key={opt.value || label} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function StateWiseRegistrationPage() {
  const showContact = !hasPermission('contact_visibility_none');
  const showMobile = hasPermission('show_mobile');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stateWisePlayers, setStateWisePlayers] = useState<StateWisePlayer[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem(PER_PAGE_KEY);
    return saved ? Number.parseInt(saved, 10) || 50 : 50;
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [hasActiveUser, setHasActiveUser] = useState(false);
  const [activeUserToday, setActiveUserToday] = useState(false);
  const [activeUserStartDate, setActiveUserStartDate] = useState(() => todayIST());
  const [activeUserEndDate, setActiveUserEndDate] = useState(() => todayIST());

  const columnFiltersRef = useRef(columnFilters);
  columnFiltersRef.current = columnFilters;
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const loadReport = useCallback(
    async (page: number, filters: ColumnFilters) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const payload: Record<string, unknown> = {
          pageNo: page,
          itemPerPage: itemsPerPage,
          startDate,
          endDate,
          filter: buildApiFilter(filters),
        };
        if (hasActiveUser) {
          payload.hasActiveUser = true;
          payload.activeUserStartDate = activeUserStartDate;
          payload.activeUserEndDate = activeUserEndDate;
        }
        if (activeUserToday) payload.activeUserToday = true;

        const res = await secureApi<unknown>('users.registeredUsersReport', payload);
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load state wise registration');
          setRows([]);
          setTotalPages(1);
          setTotalCount(0);
          if (!filters.state) setStateWisePlayers([]);
          return;
        }

        const packed = unpackReport(res.data);
        setRows(packed.items);
        setTotalPages(packed.totalPages);
        setTotalCount(packed.total);
        if (!filters.state) {
          setStateWisePlayers(resolveStateWise(packed.payload, packed.items));
        }
      } finally {
        if (isCurrent(gen)) {
          setLoading(false);
          end();
        }
      }
    },
    [
      itemsPerPage,
      startDate,
      endDate,
      hasActiveUser,
      activeUserToday,
      activeUserStartDate,
      activeUserEndDate,
      next,
      isCurrent,
      begin,
      end,
    ],
  );

  const applyFilters = useCallback(
    (filters: ColumnFilters, page = 1) => {
      setColumnFilters(filters);
      columnFiltersRef.current = filters;
      if (pageNo === page) {
        void loadReport(page, filters);
        return;
      }
      setPageNo(page);
    },
    [loadReport, pageNo],
  );

  const updateFilter = (key: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateDropdownFilter = (key: keyof ColumnFilters, value: string) => {
    applyFilters({ ...columnFilters, [key]: value });
  };

  const handleStateChipClick = (state: string) => {
    const nextState = columnFilters.state === state ? '' : state;
    applyFilters({ ...columnFilters, state: nextState });
  };

  const handleSearch = () => {
    applyFilters(columnFiltersRef.current);
  };

  const handleApply = () => {
    applyFilters(columnFiltersRef.current);
  };

  useEffect(() => {
    void loadReport(pageNo, columnFiltersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination / page size only
  }, [pageNo, itemsPerPage]);

  const rowOffset = (pageNo - 1) * itemsPerPage;

  const columns = useMemo<CommonTableColumn<UserRow>[]>(() => {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        filter: <Box />,
        render: (_row, index) => rowOffset + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <TableSearchBar
            value={columnFilters.name}
            onChange={(e) => updateFilter('name', e.target.value)}
            onSearch={handleSearch}
            placeholder="Search name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <TableSearchBar
            value={columnFilters._id}
            onChange={(e) => updateFilter('_id', e.target.value)}
            onSearch={handleSearch}
            placeholder="User ID"
            width={150}
          />
        ),
        render: (row) => display(row._id),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <TableSearchBar
            value={columnFilters.mobile}
            onChange={(e) => updateFilter('mobile', e.target.value)}
            onSearch={handleSearch}
            placeholder="Search mobile"
          />
        ),
        render: (row) => (showMobile ? display(row.mobile) : '**********'),
      },
      {
        id: 'kyc',
        label: 'KYC',
        filter: <Box />,
        render: (row) => (row.kyc === true ? 'Done' : 'Not Done'),
      },
      {
        id: 'appName',
        label: 'App Name',
        filter: (
          <FilterSelect
            value={columnFilters.clientName}
            onChange={(v) => updateDropdownFilter('clientName', v)}
            label="App"
            options={[
              { value: '', label: 'All Apps' },
              ...CLIENT_NAMES.map((name) => ({
                value: name,
                label: `${appCodeForName(name)} (${name})`,
              })),
            ]}
          />
        ),
        render: (row) => appCodeForName(row.clientName),
      },
    ];

    if (showContact) {
      cols.push({
        id: 'email',
        label: 'Email',
        filter: (
          <TableSearchBar
            value={columnFilters.email}
            onChange={(e) => updateFilter('email', e.target.value)}
            onSearch={handleSearch}
            placeholder="Search email"
            width={140}
          />
        ),
        render: (row) => display(row.email),
      });
    }

    cols.push(
      {
        id: 'city',
        label: 'City',
        filter: (
          <TableSearchBar
            value={columnFilters.city}
            onChange={(e) => updateFilter('city', e.target.value)}
            onSearch={handleSearch}
            placeholder="Search city"
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <TableSearchBar
            value={columnFilters.state}
            onChange={(e) => updateFilter('state', e.target.value)}
            onSearch={handleSearch}
            placeholder="Search state"
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'empCode',
        label: 'Employee Code',
        filter: (
          <TableSearchBar
            value={columnFilters.empCode}
            onChange={(e) => updateFilter('empCode', e.target.value)}
            onSearch={handleSearch}
            placeholder="Emp code"
            width={100}
          />
        ),
        render: (row) => display(row.empCode),
      },
      {
        id: 'deviceType',
        label: 'Device Type',
        filter: (
          <TableSearchBar
            value={columnFilters.deviceType}
            onChange={(e) => updateFilter('deviceType', e.target.value)}
            onSearch={handleSearch}
            placeholder="Device"
            width={100}
          />
        ),
        render: (row) => display(row.deviceType),
      },
      {
        id: 'played',
        label: 'Played',
        filter: (
          <FilterSelect
            value={columnFilters.played}
            onChange={(v) => updateDropdownFilter('played', v)}
            label="Played"
            options={[
              { value: '', label: 'All' },
              { value: 'E', label: 'E' },
              { value: 'C', label: 'C' },
              { value: 'S', label: 'S' },
            ]}
          />
        ),
        render: (row) => display(row.played, ''),
      },
      {
        id: 'created',
        label: 'Created',
        filter: <Box />,
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : ''),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        filter: <Box />,
        render: (row) =>
          row.activeUser
            ? `${formatDisplayDate(row.activeUser)} | ${formatDisplayTime(row.activeUser)}`
            : '',
      },
      {
        id: 'balance',
        label: 'Balance',
        filter: (
          <FilterSelect
            value={columnFilters.balanceRange}
            onChange={(v) => updateDropdownFilter('balanceRange', v)}
            label="Balance"
            options={[
              { value: '', label: 'All' },
              { value: '0-1000', label: '0 - 1,000' },
              { value: '1000-10000', label: '1,000 - 10,000' },
              { value: '10000-50000', label: '10,000 - 50,000' },
              { value: '50000-100000', label: '50,000 - 100,000' },
              { value: '100000-1000000', label: '100,000+' },
            ]}
          />
        ),
        render: (row) => display(row.balance, '0'),
      },
      {
        id: 'bonusBalance',
        label: 'Bonus Balance',
        filter: <Box />,
        render: (row) => display(row.bonusWalletBalance, '0'),
      },
      {
        id: 'block',
        label: 'Block',
        filter: (
          <FilterSelect
            value={columnFilters.blockUser}
            onChange={(v) => updateDropdownFilter('blockUser', v)}
            label="Block"
            options={[
              { value: '', label: 'All' },
              { value: 'block', label: 'Block' },
              { value: 'unblock', label: 'Un-Block' },
            ]}
          />
        ),
        render: (row) => (row.blockUser ? 'Yes' : 'No'),
      },
      {
        id: 'dump',
        label: 'Dump',
        filter: (
          <FilterSelect
            value={columnFilters.dump}
            onChange={(v) => updateDropdownFilter('dump', v)}
            label="Dump"
            options={[
              { value: '', label: 'All' },
              { value: 'dump', label: 'Dump' },
              { value: 'non-dump', label: 'Non-Dump' },
            ]}
          />
        ),
        render: (row) => (row.dump ? 'Yes' : 'No'),
      },
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columnFilters drive filter UI; handlers are stable enough
  }, [columnFilters, rowOffset, showContact, showMobile]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          width: '100%',
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{
            width: '100%',
            overflowX: 'auto',
            pb: 0.25,
            '& > *': { flexShrink: 0 },
          }}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={dateFieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={dateFieldSx}
          />
          <TextField
            select
            size="small"
            label="Items Per Page"
            value={String(itemsPerPage)}
            onChange={(e) => {
              const perPage = Number(e.target.value);
              setItemsPerPage(perPage);
              setPageNo(1);
              localStorage.setItem(PER_PAGE_KEY, String(perPage));
            }}
            sx={selectFieldSx}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={hasActiveUser}
                onChange={(e) => setHasActiveUser(e.target.checked)}
              />
            }
            label="Active User"
            sx={checkboxSx}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={activeUserToday}
                onChange={(e) => setActiveUserToday(e.target.checked)}
              />
            }
            label="Active Today"
            sx={checkboxSx}
          />

          <Button variant="contained" onClick={handleApply} disabled={loading} sx={applyBtnSx}>
            Apply
          </Button>
        </Stack>

        {hasActiveUser && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              type="date"
              label="Active From"
              InputLabelProps={{ shrink: true }}
              value={activeUserStartDate}
              onChange={(e) => setActiveUserStartDate(e.target.value)}
              sx={dateFieldSx}
            />
            <TextField
              size="small"
              type="date"
              label="Active To"
              InputLabelProps={{ shrink: true }}
              value={activeUserEndDate}
              onChange={(e) => setActiveUserEndDate(e.target.value)}
              sx={dateFieldSx}
            />
          </Stack>
        )}

        <Typography sx={{ mt: 1.5, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
          Total Users: <b>{totalCount}</b>
        </Typography>
      </Box>

      {stateWisePlayers.length > 0 && (
        <Box
          sx={{
            mb: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'background.paper',
            border: '2px solid #f5a623',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Typography fontWeight={700} sx={{ color: '#fff' }}>
              Players State Wise
            </Typography>
            {columnFilters.state && (
              <Button
                size="small"
                onClick={() => handleStateChipClick(columnFilters.state)}
                sx={{
                  ...applyBtnSx,
                  height: 28,
                  px: 1.25,
                  fontSize: 11,
                }}
              >
                Clear: {columnFilters.state}
              </Button>
            )}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {stateWisePlayers.map((item) => {
              const selected = columnFilters.state === item.state;
              return (
                <Button
                  key={item.state}
                  size="small"
                  onClick={() => handleStateChipClick(item.state)}
                  sx={{
                    bgcolor: selected ? '#d48806' : '#f5a623',
                    color: '#000',
                    fontWeight: 600,
                    fontSize: 13,
                    textTransform: 'none',
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 1,
                    border: selected ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: selected ? '#c47a00' : '#e09020', boxShadow: 'none' },
                  }}
                >
                  {item.state}: {item.count}
                </Button>
              );
            })}
          </Stack>
        </Box>
      )}

      <CommonTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row, index) => row._id || index}
        emptyMessage="No registered users for selected filters"
        getRowSx={(_row, index) =>
          index % 2 === 1
            ? { bgcolor: 'rgba(255,255,255,0.03)', '& td': { bgcolor: 'transparent' } }
            : undefined
        }
      />

      <Stack direction="row" justifyContent="center" sx={{ mt: 2, mb: 1 }}>
        <Pagination
          count={totalPages}
          page={pageNo}
          color="secondary"
          onChange={(_e, nextPage) => setPageNo(nextPage)}
        />
      </Stack>
    </Box>
  );
}
