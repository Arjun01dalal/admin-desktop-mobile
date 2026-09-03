import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { display, maskMobile } from '@/screens/panel/shared';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { DEPOSIT_STATES } from '@/screens/panel/newRegisters/constants';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  todayIST,
} from '@/utils/dates';
import { copyToClipboard } from '@/utils/clipboard';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type Mode = 'balance' | 'bonus' | 'registered';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  email?: string;
  balance?: number;
  bonusBalance?: number;
  bonusWalletBalance?: number;
  clientName?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  createdOn?: string;
  activeUser?: string;
  userBankName?: string;
  currentAppVersion?: string;
  encryptedUserName?: string;
  kyc?: boolean;
  accountNumber?: string;
  aadhaarNumber?: string;
  previousCaller?: { name?: string; Dp_ID?: string };
  currentCaller?: { name?: string };
  referredCode?: string;
  referralCodeUser?: string;
  referralCodeUse?: string;
  referredUserId?: string;
  empCode?: string;
  subDomain?: string;
  blockUserReason?: string;
  [key: string]: unknown;
};

type ColumnFilters = {
  name: string;
  mobile: string;
  balance: string;
  bonusBalance: string;
  email: string;
  city: string;
  state: string;
  empCode: string;
  referralCodeUser: string;
  deviceType: string;
  currentAppVersion: string;
  clientName: string;
  userType: string;
  activityStart: string;
  activityEnd: string;
};

const EMPTY_COL: ColumnFilters = {
  name: '',
  mobile: '',
  balance: '',
  bonusBalance: '',
  email: '',
  city: '',
  state: '',
  empCode: '',
  referralCodeUser: '',
  deviceType: '',
  currentAppVersion: '',
  clientName: '',
  userType: '',
  activityStart: '',
  activityEnd: '',
};

const META: Record<Mode, { title: string; action: SecureAction; decreasing?: boolean }> = {
  balance: {
    title: 'Total Users Balance',
    action: 'users.getAllBalance',
    decreasing: true,
  },
  bonus: {
    title: 'Total Users Bonus Balance',
    action: 'users.getAllBonus',
    decreasing: true,
  },
  registered: {
    title: 'Total Registered Users App Today',
    action: 'users.registeredUser',
  },
};

type Props = { mode: Mode };

const filterSelectSx = {
  minWidth: 110,
  '& .MuiInputBase-root': { fontSize: 11, bgcolor: 'background.paper', height: 30 },
};

function asDashboardUsersPage(data: unknown, pageSize: number, mode: Mode) {
  const root =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const envelopes: Record<string, unknown>[] = root ? [root] : [];

  for (const key of ['payload', 'data']) {
    const nested = root?.[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      envelopes.push(nested as Record<string, unknown>);
    }
  }

  let rows: UserRow[] = Array.isArray(data) ? (data as UserRow[]) : [];
  for (const envelope of envelopes) {
    const candidate = ['users', 'items', 'user'].map((key) => envelope[key]).find(Array.isArray);
    if (Array.isArray(candidate)) {
      rows = candidate as UserRow[];
      break;
    }
    if (Array.isArray(envelope.data)) {
      rows = envelope.data as UserRow[];
      break;
    }
  }

  const readNumber = (keys: string[]) => {
    for (const envelope of envelopes) {
      for (const key of keys) {
        const value = Number(envelope[key]);
        if (Number.isFinite(value) && value > 0) return value;
      }
    }
    return 0;
  };

  const explicitTotalPages = readNumber(['totalPages', 'pages', 'pageCount']);
  const total =
    mode === 'registered'
      ? readNumber(['total', 'count', 'totalUsers', 'totalCount'])
      : readNumber(['count', 'totalUsers', 'totalCount']);
  const totalPages = explicitTotalPages || (total > 0 ? Math.ceil(total / pageSize) : 1);
  const totalBalance = readNumber(
    mode === 'registered'
      ? ['totalBalance', 'totalBonusBalance']
      : ['totalBalance', 'totalBonusBalance', 'total'],
  );

  return { rows, totalPages: Math.max(1, totalPages), totalBalance };
}

function bonusOf(row: UserRow): number {
  return Number(row.bonusWalletBalance ?? row.bonusBalance ?? 0) || 0;
}

function nameLink(
  row: UserRow,
  canOpen: boolean,
  navigate: (path: string) => void,
) {
  const label = display(row.name);
  if (!canOpen || !row._id || !row.name) return label;
  return (
    <Typography
      component="button"
      type="button"
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        navigate(
          `/users/report/${encodeURIComponent(String(row._id))}/${encodeURIComponent(String(row.name))}`,
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
}

/**
 * Shared list for dashboard KPI deep-links (balance / bonus / registered app today).
 * Columns + inline filters match laxminarayan BalanceIncrease / TotalBonus / RegisteredUsers.
 */
export function DashboardUsersListPage({ mode }: Props) {
  const meta = META[mode];
  const navigate = useNavigate();
  const canOpenUserReport = hasPermission('wallet_history');
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const hideContact = hasPermission('contact_visibility_none');

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBalance, setTotalBalance] = useState(0);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_COL);
  const [applied, setApplied] = useState<ColumnFilters>(EMPTY_COL);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});
  const [playerVersions, setPlayerVersions] = useState<string[]>([]);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const list = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, string> = {};
      for (const item of list) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPlayerVersions = useCallback(async () => {
    if (playerVersions.length > 0) return;
    const res = await secureApi<string[]>('users.appVersion', { currentAppVersion: true });
    if (!res.ok) return;
    const list = Array.isArray(res.data) ? res.data.map(String) : [];
    setPlayerVersions(list);
  }, [playerVersions.length]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Record<string, unknown> = {};
      if (applied.name.trim()) filter.name = applied.name.trim();
      if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
      if (applied.balance.trim()) filter.balance = Number(applied.balance.trim());
      if (applied.bonusBalance.trim()) {
        filter.bonusWalletBalance = Number(applied.bonusBalance.trim());
      }
      if (applied.email.trim()) filter.email = applied.email.trim();
      if (applied.city.trim()) filter.city = applied.city.trim();
      if (applied.state.trim()) filter.state = applied.state.trim();
      if (applied.empCode.trim()) filter.empCode = applied.empCode.trim();
      if (applied.referralCodeUser.trim()) {
        filter.referralCodeUser = applied.referralCodeUser.trim();
      }
      if (applied.deviceType) filter.deviceType = applied.deviceType;
      if (applied.currentAppVersion) filter.currentAppVersion = applied.currentAppVersion;
      if (applied.clientName) filter.clientName = applied.clientName;
      if (applied.userType === 'Active') filter.active = true;
      if (applied.userType === 'InActive') filter.inActive = true;

      const payload: Record<string, unknown> = {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (meta.decreasing) payload.decreasing = true;

      // Laxmi balance: top From/To; Last Activity overrides when both set.
      // Laxmi bonus: only Last Activity dates (no top dates).
      // Laxmi registered: top From/To (default today).
      if (mode === 'bonus') {
        if (applied.activityStart && applied.activityEnd) {
          payload.startDate = applied.activityStart;
          payload.endDate = applied.activityEnd;
        }
      } else if (mode === 'balance') {
        if (applied.activityStart && applied.activityEnd) {
          payload.startDate = applied.activityStart;
          payload.endDate = applied.activityEnd;
        } else {
          payload.startDate = startDate;
          payload.endDate = endDate;
        }
      } else {
        payload.startDate = startDate || todayIST();
        payload.endDate = endDate || todayIST();
      }

      const res = await secureApi(meta.action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load users');
        setRows([]);
        return;
      }

      const paged = asDashboardUsersPage(res.data, pageSize, mode);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages || 1));
      setTotalBalance(paged.totalBalance);
    } finally {
      setLoading(false);
    }
  }, [applied, endDate, meta.action, meta.decreasing, mode, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const activityFilter = useMemo(
    () => (
      <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ minWidth: 280 }}>
        <TextField
          type="date"
          label="From Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={draft.activityStart}
          onChange={(e) => setDraftField('activityStart')(e.target.value)}
          sx={{ ...filterSelectSx, width: 130 }}
        />
        <TextField
          type="date"
          label="To Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={draft.activityEnd}
          onChange={(e) => setDraftField('activityEnd')(e.target.value)}
          sx={{ ...filterSelectSx, width: 130 }}
        />
        <IconButton size="small" onClick={applyFilters} aria-label="search activity">
          <SearchIcon fontSize="small" />
        </IconButton>
      </Stack>
    ),
    [applyFilters, draft.activityEnd, draft.activityStart, setDraftField],
  );

  const appNameFilter = useMemo(
    () => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft.clientName}
        onChange={(e) => {
          setDraftField('clientName')(e.target.value);
          setApplied((prev) => ({ ...prev, clientName: e.target.value }));
          setPage(1);
        }}
        SelectProps={{ displayEmpty: true }}
        sx={filterSelectSx}
      >
        <MenuItem value="">
          <em>All</em>
        </MenuItem>
        {CLIENT_NAMES.map((name) => (
          <MenuItem key={name} value={name}>
            {appCodeForName(name)}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft.clientName, setDraftField],
  );

  const playerVersionFilter = useMemo(
    () => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft.currentAppVersion}
        onMouseDown={() => void loadPlayerVersions()}
        onChange={(e) => {
          setDraftField('currentAppVersion')(e.target.value);
          setApplied((prev) => ({ ...prev, currentAppVersion: e.target.value }));
          setPage(1);
        }}
        SelectProps={{ displayEmpty: true }}
        sx={filterSelectSx}
      >
        <MenuItem value="">
          <em>All</em>
        </MenuItem>
        {playerVersions.map((v) => (
          <MenuItem key={v} value={v}>
            {v}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft.currentAppVersion, loadPlayerVersions, playerVersions, setDraftField],
  );

  const columns = useMemo<CommonTableColumn<UserRow>[]>(() => {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_r, i) => (page - 1) * pageSize + i + 1,
      },
    ];

    if (mode === 'registered') {
      cols.push(
        {
          id: 'name',
          label: 'Name',
          width: 160,
          filter: (
            <TableSearchBar
              value={draft.name}
              onChange={(e) => setDraftField('name')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Name"
            />
          ),
          render: (r) => nameLink(r, canOpenUserReport, navigate),
        },
      );
      if (!hideContact) {
        cols.push({
          id: 'mobile',
          label: 'Mobile\nPhone',
          width: 130,
          filter: (
            <TableSearchBar
              value={draft.mobile}
              onChange={(e) => setDraftField('mobile')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Mobile"
            />
          ),
          render: (r) => display(r.mobile),
        });
      }
      cols.push(
        {
          id: 'app',
          label: 'App\nName',
          width: 100,
          filter: appNameFilter,
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'referralCodeUser',
          label: 'Referral Code User',
          width: 150,
          filter: (
            <TableSearchBar
              value={draft.referralCodeUser}
              onChange={(e) => setDraftField('referralCodeUser')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Referral"
            />
          ),
          render: (r) => display(r.referralCodeUse ?? r.referralCodeUser),
        },
      );
      if (!hideContact) {
        cols.push({
          id: 'email',
          label: 'Email',
          width: 180,
          filter: (
            <TableSearchBar
              value={draft.email}
              onChange={(e) => setDraftField('email')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Email"
            />
          ),
          render: (r) => display(r.email),
        });
      }
      cols.push(
        {
          id: 'city',
          label: 'City',
          width: 120,
          filter: (
            <TableSearchBar
              value={draft.city}
              onChange={(e) => setDraftField('city')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by City"
            />
          ),
          render: (r) => display(r.city),
        },
        {
          id: 'state',
          label: 'State',
          width: 120,
          filter: (
            <TableSearchBar
              value={draft.state}
              onChange={(e) => setDraftField('state')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by State"
            />
          ),
          render: (r) => display(r.state),
        },
        {
          id: 'empCode',
          label: 'Employee Code',
          width: 120,
          filter: (
            <TableSearchBar
              value={draft.empCode}
              onChange={(e) => setDraftField('empCode')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Emp"
            />
          ),
          render: (r) => display(r.empCode),
        },
        {
          id: 'referredUserId',
          label: 'Referred UserId',
          width: 140,
          render: (r) => display(r.referredUserId),
        },
        {
          id: 'device',
          label: 'Device\nType',
          width: 90,
          render: (r) => display(r.deviceType),
        },
        {
          id: 'playerVer',
          label: 'Player App Version',
          width: 130,
          filter: playerVersionFilter,
          render: (r) => display(r.currentAppVersion),
        },
        {
          id: 'appVer',
          label: 'App Version',
          width: 100,
          render: (r) => display(appVersions[r.clientName || '']),
        },
        {
          id: 'created',
          label: 'Created',
          width: 110,
          render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
        },
        {
          id: 'lastActivity',
          label: 'Last\nActivity',
          width: 160,
          render: (r) =>
            r.activeUser
              ? `${formatDisplayDate(r.activeUser)} | ${formatDisplayTime(r.activeUser)}`
              : '—',
        },
        {
          id: 'balance',
          label: 'Balance',
          width: 110,
          render: (r) => formatAmount(Math.floor(Number(r.balance) || 0)),
        },
        {
          id: 'bonus',
          label: 'Bonus\nBalance',
          width: 110,
          render: (r) => formatAmount(bonusOf(r)),
        },
      );
      return cols;
    }

    // —— Balance & Bonus (wide Laxmi tables) ——
    if (mode === 'balance') {
      cols.push(
        {
          id: 'name',
          label: 'Name',
          width: 160,
          filter: (
            <TableSearchBar
              value={draft.name}
              onChange={(e) => setDraftField('name')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Name"
            />
          ),
          render: (r) => nameLink(r, canOpenUserReport, navigate),
        },
        {
          id: 'bank',
          label: 'User Bank Name',
          width: 140,
          render: (r) => display(r.userBankName),
        },
        {
          id: 'app',
          label: 'App Name',
          width: 100,
          filter: appNameFilter,
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'playerVer',
          label: 'Player App Version',
          width: 130,
          filter: playerVersionFilter,
          render: (r) => display(r.currentAppVersion),
        },
        {
          id: 'appVer',
          label: 'App Version',
          width: 100,
          render: (r) => display(appVersions[r.clientName || '']),
        },
        {
          id: 'balance',
          label: 'Balance',
          width: 120,
          filter: (
            <TableSearchBar
              value={draft.balance}
              onChange={(e) => setDraftField('balance')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Balance"
            />
          ),
          render: (r) => formatAmount(Math.floor(Number(r.balance) || 0)),
        },
        {
          id: 'dpId',
          label: 'User Encrypted Dp Id',
          width: 150,
          render: (r) => display(r.encryptedUserName),
        },
        {
          id: 'mobile',
          label: 'Mobile Phone',
          width: 150,
          filter: (
            <TableSearchBar
              value={draft.mobile}
              onChange={(e) => setDraftField('mobile')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Mobile"
            />
          ),
          render: (r) => (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <span>{maskMobile(r.mobile, canShowMobile)}</span>
              {r.mobile ? (
                <IconButton
                  size="small"
                  onClick={() => void copyToClipboard(String(r.mobile))}
                  aria-label="copy mobile"
                >
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              ) : null}
            </Stack>
          ),
        },
      );
    } else {
      // bonus column order (Laxmi TotalBonusBalanceUsersPage)
      cols.push(
        {
          id: 'name',
          label: 'Name',
          width: 160,
          render: (r) => nameLink(r, canOpenUserReport, navigate),
        },
        {
          id: 'mobile',
          label: 'Mobile',
          width: 150,
          filter: (
            <TableSearchBar
              value={draft.mobile}
              onChange={(e) => setDraftField('mobile')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Mobile"
            />
          ),
          render: (r) => (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <span>{maskMobile(r.mobile, canShowMobile)}</span>
              {r.mobile ? (
                <IconButton
                  size="small"
                  onClick={() => void copyToClipboard(String(r.mobile))}
                  aria-label="copy mobile"
                >
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              ) : null}
            </Stack>
          ),
        },
        { id: 'city', label: 'City', width: 120, render: (r) => display(r.city) },
        { id: 'state', label: 'State', width: 120, render: (r) => display(r.state) },
        {
          id: 'lastActivity',
          label: 'Last Activity',
          width: 300,
          filter: activityFilter,
          render: (r) =>
            r.activeUser
              ? `${formatDisplayDate(r.activeUser)} | ${formatDisplayTime(r.activeUser)}`
              : '—',
        },
        {
          id: 'balance',
          label: 'Balance',
          width: 120,
          filter: (
            <TableSearchBar
              value={draft.balance}
              onChange={(e) => setDraftField('balance')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Balance"
            />
          ),
          render: (r) => formatAmount(Math.floor(Number(r.balance) || 0)),
        },
        {
          id: 'bonus',
          label: 'Bonus Balance',
          width: 130,
          filter: (
            <TableSearchBar
              value={draft.bonusBalance}
              onChange={(e) => setDraftField('bonusBalance')(e.target.value)}
              onSearch={applyFilters}
              placeholder="Search by Bonus"
            />
          ),
          render: (r) => formatAmount(bonusOf(r)),
        },
        {
          id: 'bank',
          label: 'User Bank Name',
          width: 140,
          render: (r) => display(r.userBankName),
        },
        {
          id: 'app',
          label: 'App Name',
          width: 100,
          filter: appNameFilter,
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'playerVer',
          label: 'Player App Version',
          width: 130,
          filter: playerVersionFilter,
          render: (r) => display(r.currentAppVersion),
        },
        {
          id: 'appVer',
          label: 'App Version',
          width: 100,
          render: (r) => display(appVersions[r.clientName || '']),
        },
        {
          id: 'dpId',
          label: 'User Encrypted Dp Id',
          width: 150,
          render: (r) => display(r.encryptedUserName),
        },
      );
    }

    // Shared tail for balance (after mobile) and bonus (after encrypted id)
    if (mode === 'balance') {
      cols.push(
        {
          id: 'kyc',
          label: 'Kyc',
          width: 90,
          render: (r) => (r.kyc === true ? 'Done' : 'Not Done'),
        },
        { id: 'account', label: 'Account Number', width: 130, render: (r) => display(r.accountNumber) },
        { id: 'aadhar', label: 'Aadhar Number', width: 130, render: (r) => display(r.aadhaarNumber) },
        { id: 'email', label: 'Email', width: 180, render: (r) => display(r.email) },
        { id: 'city', label: 'City', width: 120, render: (r) => display(r.city) },
        {
          id: 'state',
          label: 'State',
          width: 140,
          filter: (
            <TextField
              select
              size="small"
              fullWidth
              value={draft.state}
              onChange={(e) => {
                setDraftField('state')(e.target.value);
                setApplied((prev) => ({ ...prev, state: e.target.value }));
                setPage(1);
              }}
              SelectProps={{ displayEmpty: true }}
              sx={filterSelectSx}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {DEPOSIT_STATES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          ),
          render: (r) => display(r.state),
        },
        {
          id: 'prevCaller',
          label: 'previous caller name',
          width: 140,
          render: (r) => display(r.previousCaller?.name),
        },
        {
          id: 'prevCallerDp',
          label: 'Previous caller Dp_ID',
          width: 140,
          render: (r) => display(r.previousCaller?.Dp_ID),
        },
        {
          id: 'currentCaller',
          label: 'Current Caller',
          width: 130,
          render: (r) => display(r.currentCaller?.name),
        },
        {
          id: 'referredCode',
          label: 'Referred Referral Code',
          width: 140,
          render: (r) => display(r.referredCode),
        },
        {
          id: 'referralCode',
          label: 'Referral Code',
          width: 120,
          render: (r) => display(r.referralCodeUser),
        },
        {
          id: 'device',
          label: 'Device Type',
          width: 110,
          filter: (
            <TextField
              select
              size="small"
              fullWidth
              value={draft.deviceType}
              onChange={(e) => {
                setDraftField('deviceType')(e.target.value);
                setApplied((prev) => ({ ...prev, deviceType: e.target.value }));
                setPage(1);
              }}
              SelectProps={{ displayEmpty: true }}
              sx={filterSelectSx}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              <MenuItem value="app">app</MenuItem>
              <MenuItem value="web">web</MenuItem>
            </TextField>
          ),
          render: (r) => display(r.deviceType),
        },
        { id: 'platform', label: 'Platform', width: 110, render: (r) => display(r.subDomain) },
        {
          id: 'created',
          label: 'Created',
          width: 110,
          render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
        },
        {
          id: 'time',
          label: 'Time',
          width: 100,
          render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
        },
        {
          id: 'lastActivity',
          label: 'Last Activity',
          width: 300,
          filter: activityFilter,
          render: (r) =>
            r.activeUser
              ? `${formatDisplayDate(r.activeUser)} | ${formatDisplayTime(r.activeUser)}`
              : '—',
        },
        {
          id: 'bonus',
          label: 'Bonus Balance',
          width: 120,
          render: (r) => formatAmount(bonusOf(r)),
        },
        {
          id: 'block',
          label: 'Block User Reason',
          width: 150,
          render: (r) => display(r.blockUserReason),
        },
      );
    } else {
      // bonus shared tail after app version / encrypted id
      cols.push(
        {
          id: 'kyc',
          label: 'Kyc',
          width: 90,
          render: (r) => (r.kyc === true ? 'Done' : 'Not Done'),
        },
        { id: 'account', label: 'Account Number', width: 130, render: (r) => display(r.accountNumber) },
        { id: 'aadhar', label: 'Aadhar Number', width: 130, render: (r) => display(r.aadhaarNumber) },
        { id: 'email', label: 'Email', width: 180, render: (r) => display(r.email) },
        {
          id: 'prevCaller',
          label: 'previous caller name',
          width: 140,
          render: (r) => display(r.previousCaller?.name),
        },
        {
          id: 'prevCallerDp',
          label: 'Previous caller Dp_ID',
          width: 140,
          render: (r) => display(r.previousCaller?.Dp_ID),
        },
        {
          id: 'currentCaller',
          label: 'Current Caller',
          width: 130,
          render: (r) => display(r.currentCaller?.name),
        },
        {
          id: 'referredCode',
          label: 'Referred Referral Code',
          width: 140,
          render: (r) => display(r.referredCode),
        },
        {
          id: 'referralCode',
          label: 'Referral Code',
          width: 120,
          render: (r) => display(r.referralCodeUser),
        },
        { id: 'device', label: 'Device Type', width: 100, render: (r) => display(r.deviceType) },
        { id: 'platform', label: 'Platform', width: 110, render: (r) => display(r.subDomain) },
        {
          id: 'created',
          label: 'Created',
          width: 110,
          render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
        },
        {
          id: 'time',
          label: 'Time',
          width: 100,
          render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
        },
        {
          id: 'block',
          label: 'Block User Reason',
          width: 150,
          render: (r) => display(r.blockUserReason),
        },
      );
    }

    return cols;
  }, [
    activityFilter,
    appNameFilter,
    appVersions,
    applyFilters,
    canOpenUserReport,
    canShowMobile,
    draft,
    hideContact,
    mode,
    navigate,
    page,
    pageSize,
    playerVersionFilter,
    setDraftField,
  ]);

  const summaryParts = [
    mode !== 'bonus' ? `${startDate} → ${endDate}` : null,
    totalBalance > 0 ? `Total: ₹${formatAmount(totalBalance)}` : null,
  ].filter(Boolean);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title={toDisplayText(meta.title)}
        summary={summaryParts.join(' · ') || meta.title}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {mode !== 'bonus' ? (
            <>
              <TextField
                type="date"
                label="From"
                size="small"
                fullWidth={false}
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                sx={{ width: 160 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                fullWidth={false}
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                sx={{ width: 160 }}
              />
            </>
          ) : null}
          {(mode === 'balance' || mode === 'bonus') && (
            <TextField
              select
              label="User Type"
              size="small"
              fullWidth={false}
              value={draft.userType}
              onChange={(e) => {
                const value = e.target.value;
                setDraftField('userType')(value);
                setApplied((prev) => ({ ...prev, userType: value }));
                setPage(1);
              }}
              sx={{ width: 140 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="InActive">InActive</MenuItem>
            </TextField>
          )}
          <TextField
            select
            label="Per page"
            size="small"
            fullWidth={false}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ width: 120 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            color="warning"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            disabled={loading}
            onClick={applyFilters}
          >
            Apply
          </Button>
          {totalBalance > 0 && (
            <Typography variant="body2" fontWeight={700}>
              Total: ₹{formatAmount(totalBalance)}
            </Typography>
          )}
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No users"
          stickyHeader
          dense
          minWidth={mode === 'registered' ? 2200 : 3200}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}

export function BalanceUsersPage() {
  return <DashboardUsersListPage mode="balance" />;
}

export function BonusBalanceUsersPage() {
  return <DashboardUsersListPage mode="bonus" />;
}

export function RegisteredUsersAppPage() {
  return <DashboardUsersListPage mode="registered" />;
}
