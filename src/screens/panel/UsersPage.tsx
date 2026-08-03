import { useNavigate } from 'react-router-dom';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  getRoleId,
  getRoleName,
  hasPermission,
  Permissions,
} from '@/auth/permissions';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import {
  CommonTable,
  type CommonTableColumn,
} from '@/components/CommonTable';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';
import { CAMPAIGN_LIST } from '@/screens/panel/newRegisters/campaignList';
import { DEPOSIT_STATES } from '@/screens/panel/newRegisters/constants';
import { copyToClipboard } from '@/utils/clipboard';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
} from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { AddUserDataDialog } from './users/AddUserDataDialog';
import { CallingBtn } from './users/CallingBtn';
import {
  CreateUserDialog,
  type CreateUserMode,
} from './users/CreateUserDialog';
import { UsersToolbar } from './users/UsersToolbar';
import {
  BLOCK_STATUS_OPTIONS,
  resolveBlockOtpMobile,
  SHOW_EDIT_EMP_CODE,
  type UserType,
} from './users/constants';
import {
  mapUsersToBotSettings,
  mapUsersToDialerLeads,
  reasonForUserType,
  todayIstYmd,
  unpackGlobalsPayload,
} from './users/toolbarHelpers';
import {
  EMPTY_USER_FILTERS,
  actionForType,
  buildPayloadForType,
  buildUserFilter,
  empCodesEqual,
  excludeDumped,
  filterListByLoginEmpCode,
  filterSearchByEmpCode,
  hasOtherUserSearch,
  nestedCallerName,
  pickAccountNumber,
  pickAadharNumber,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
  resolveSearchEmpCode,
  unpackByType,
  type UserFilters,
  type UserRow,
} from './users/utils';

const MAX_REMARK = 200;

/** Sub_Admin office locations. */
const SUBADMIN_LOCATIONS = ['Nagpur', 'Dubai', 'Nagpur/Dubai'] as const;

type SubAdminEditType = 'name' | 'mobile' | 'telegram' | 'empCode';

type RoleOption = { _id: string; Name?: string; name?: string };

/** Fixed column sizing — keeps Users table compact without clipping actions. */
function fixedCol(width: number, opts?: { fontSize?: number; px?: number }) {
  const px = opts?.px ?? 0.5;
  return {
    width,
    sx: {
      width,
      minWidth: width,
      maxWidth: width,
      px,
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      whiteSpace: 'nowrap' as const,
      verticalAlign: 'middle' as const,
      ...(opts?.fontSize != null ? { fontSize: opts.fontSize } : {}),
    },
  };
}

const INDEX_COL = fixedCol(44);
const NAME_COL = fixedCol(128, { px: 0.75 });
const DP_ID_COL = fixedCol(158, { px: 0.75 });
const BANK_COL = fixedCol(100);
const APP_COL = fixedCol(52);
const EMP_COL = fixedCol(100);
const PLAY_COL = fixedCol(52);
const MOBILE_COL = {
  width: 168,
  sx: {
    width: 168,
    minWidth: 168,
    maxWidth: 180,
    px: 0.5,
    boxSizing: 'border-box' as const,
    overflow: 'hidden' as const,
    whiteSpace: 'normal' as const,
    verticalAlign: 'middle' as const,
  },
};
const KYC_COL = fixedCol(64);
const ACCOUNT_COL = fixedCol(108);
const AADHAR_COL = fixedCol(108);
const EMAIL_COL = fixedCol(120);
const CITY_COL = fixedCol(84);
const STATE_COL = fixedCol(92);
const CALLER_COL = fixedCol(96);
const AMOUNT_COL = fixedCol(78);
const DATETIME_COL = fixedCol(126, { fontSize: 11 });
const ACTION_COL = fixedCol(88);
const REASON_COL = fixedCol(100);

/** @deprecated aliases used by other user-type tables */
const NAME_COL_WIDTH = NAME_COL.width;
const NAME_COL_SX = NAME_COL.sx;
const DP_ID_COL_WIDTH = DP_ID_COL.width;
const DP_ID_COL_SX = DP_ID_COL.sx;
const STATE_COL_WIDTH = STATE_COL.width;
const STATE_COL_SX = STATE_COL.sx;
const CITY_COL_WIDTH = CITY_COL.width;
const CITY_COL_SX = CITY_COL.sx;
const DATETIME_COL_WIDTH = DATETIME_COL.width;
const DATETIME_COL_SX = DATETIME_COL.sx;

/** Fixed-width multi-select for State filter — never grows the column. */
function StateMultiFilter({
  value,
  onChange,
  onSearch,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onSearch: () => void;
}) {
  return (
    <Stack
      spacing={0.5}
      alignItems="stretch"
      sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}
    >
      <TextField
        select
        size="small"
        fullWidth
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(typeof next === 'string' ? next.split(',') : next);
        }}
        SelectProps={{
          multiple: true,
          displayEmpty: true,
          renderValue: (selected) => {
            const list = selected as string[];
            if (!list.length) return 'State';
            if (list.length === 1) return list[0];
            return `${list.length} selected`;
          },
          MenuProps: {
            PaperProps: { sx: { maxHeight: 320 } },
          },
        }}
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          '& .MuiInputBase-root': {
            bgcolor: '#fff',
            color: '#111',
            fontSize: 11,
            maxWidth: '100%',
            overflow: 'hidden',
          },
          '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pr: '24px !important',
          },
        }}
      >
        {DEPOSIT_STATES.map((state) => (
          <MenuItem key={state} value={state} dense sx={{ fontSize: 12 }}>
            {state}
          </MenuItem>
        ))}
      </TextField>
      <Button size="small" variant="outlined" onClick={onSearch}>
        Search
      </Button>
    </Stack>
  );
}

/** DP ID cell that ellipsizes instead of overlapping the next column. */
function CompactDpId({ value }: { value: string }) {
  if (!value) return <>-</>;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Typography
        component="span"
        title={value}
        sx={{
          fontSize: 12,
          minWidth: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          void copyToClipboard(value);
        }}
        aria-label="Copy"
        sx={{ flexShrink: 0, p: 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}

function FilterInput({
  value,
  onChange,
  onSearch,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
  /** Narrow filter field for compact columns (Name / DP ID). */
  compact?: boolean;
}) {
  return (
    <TextField
      size="small"
      fullWidth={!compact}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={{
        width: compact ? '100%' : undefined,
        maxWidth: compact ? '100%' : undefined,
        '& .MuiInputBase-root': {
          bgcolor: '#fff',
          color: '#111',
          fontSize: compact ? 11 : 12,
        },
      }}
    />
  );
}

function DateRangeFilter({
  start,
  end,
  onStart,
  onEnd,
  onSearch,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onSearch: () => void;
}) {
  const fieldSx = {
    minWidth: 110,
    '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 11 },
  };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        type="date"
        size="small"
        value={start}
        onChange={(e) => onStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <TextField
        type="date"
        size="small"
        value={end}
        onChange={(e) => onEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <IconButton
        size="small"
        onClick={onSearch}
        aria-label="search"
        sx={{
          bgcolor: '#7c4dff',
          color: '#fff',
          borderRadius: 1,
          '&:hover': { bgcolor: '#651fff' },
        }}
      >
        <SearchIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function isCallerRole(roleId?: string, roleName?: string): boolean {
  const id = String(roleId || localStorage.getItem('role_id') || '');
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(
    roleName || localStorage.getItem('role') || '',
  )
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}

/** Users page — converted from laxminarayan Users (caller + core admin). */
export function UsersPage() {
  const navigate = useNavigate();
  const canOpenUserReport = hasPermission('wallet_history');
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    mobile?: string;
    empCode?: string;
    Role_ID?: string;
    clientName?: string | string[];
    allotedApps?: string | string[];
    accessibleStates?: string[];
    appWithState?: Record<string, string[]>;
    extensionId?: string[] | string;
    serverId?: string | number;
  }>();
  const isCaller = isCallerRole(getRoleId(admin) || admin?.Role_ID, getRoleName(admin));

  const renderUserName = useCallback(
    (r: { _id?: string; name?: string }) => {
      const label = String(r.name || '-');
      if (!canOpenUserReport || !r._id || !r.name) return label;
      return (
        <Typography
          component="button"
          type="button"
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/users/report/${encodeURIComponent(String(r._id))}/${encodeURIComponent(String(r.name))}`,
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
    [canOpenUserReport, navigate],
  );
  const appsKey = stableKey(admin?.clientName ?? admin?.allotedApps);
  const statesKey = stableKey(admin?.accessibleStates);
  const allottedApps = useMemo(() => {
    const raw = admin?.clientName || admin?.allotedApps;
    return raw || undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appsKey]);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const accessibleStates = useMemo(() => {
    const raw = admin?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.map((s) => String(s).toLowerCase()).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statesKey]);

  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');
  // Match laxminarayan: CallingBtn column when contact_visibility_none is off
  const showMobileColumn = !hideContact;
  const showDates =
    hasPermission('user_table') ||
    hasPermission('View_Users') ||
    hasPermission('All_user_table');
  const canRegister = !isCaller && hasPermission('Register_New_User');
  // Match laxminarayan + keep visible for Users operators
  const canCreateUser =
    !isCaller &&
    (hasPermission('create_new_user') ||
      hasPermission('Register_New_User') ||
      hasPermission('View_Users'));
  const canCreateAdmin =
    !isCaller &&
    (hasPermission('create_new_user') || hasPermission('View_Users'));
  const canAddToBot = hasPermission('add_to_bot');
  const canAddToDialer = hasPermission('add_to_dilaler');
  const canAddUserData = hasPermission('show_user_upload_data');

  const canViewSubAdmin = hasPermission('View_Subadmin_User');
  const canViewUserType =
    hasPermission('All_user_table') ||
    hasPermission('user_tab_with_search_only') ||
    hasPermission('View_Users') ||
    hasPermission('user_table');

  const typeOptions = useMemo(() => {
    // Match laxminarayan Users select options (permission + caller gates)
    const values: UserType[] = [];
    if (canViewUserType) values.push('User');
    if (canViewSubAdmin) values.push('Sub_Admin');
    if (!isCaller) {
      values.push('Todays_Active', 'Active_User');
    }
    values.push(
      'Non_Performing_User',
      'In_Active_Deposit',
      'Non_Performing_Active_User',
    );
    if (!isCaller) values.push('LAXMI_999_Users');

    // Fallback: always allow User so the page is never empty
    if (values.length === 0) values.push('User');

    return values.map((value) => ({ value, label: value }));
  }, [canViewSubAdmin, canViewUserType, isCaller]);

  const [userType, setUserType] = useState<UserType>('User');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [playedIn, setPlayedIn] = useState('');
  const [uniqueUser, setUniqueUser] = useState(false);
  const [botId, setBotId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [globalCount, setGlobalCount] = useState(0);
  const [dialerData, setDialerData] = useState<UserRow[]>([]);
  const [dialerLoading, setDialerLoading] = useState(false);
  const [addUserDataOpen, setAddUserDataOpen] = useState(false);
  const [draft, setDraft] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [applied, setApplied] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [createMode, setCreateMode] = useState<CreateUserMode | null>(null);
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);
  const [blockNextStatus, setBlockNextStatus] = useState(false);
  const [dumpTarget, setDumpTarget] = useState<UserRow | null>(null);
  const [remark, setRemark] = useState('');
  const [otp, setOtp] = useState('');
  const [dumpReason, setDumpReason] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');

  // Sub_Admin edit / actions (admin-panel-domains Users.tsx)
  const [subEdit, setSubEdit] = useState<{
    id: string;
    type: SubAdminEditType;
  } | null>(null);
  const [subEditValue, setSubEditValue] = useState('');
  const [subEditBusy, setSubEditBusy] = useState(false);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState('');
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [roleEditBusy, setRoleEditBusy] = useState(false);
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>(
    {},
  );
  const [locationBusyId, setLocationBusyId] = useState('');
  const [realNameTargetId, setRealNameTargetId] = useState<string | null>(null);
  const [realNameValue, setRealNameValue] = useState('');
  const [realNameBusy, setRealNameBusy] = useState(false);
  const [blockCallerTarget, setBlockCallerTarget] = useState<UserRow | null>(
    null,
  );
  const [blockCallerNext, setBlockCallerNext] = useState(false);
  const [blockCallerRemark, setBlockCallerRemark] = useState('');
  const [blockCallerOtp, setBlockCallerOtp] = useState('');
  const [blockCallerBusy, setBlockCallerBusy] = useState(false);

  const canEditSubAdminRole = useMemo(() => {
    if (hasPermission(Permissions.Edit_Role)) return true;
    const name = String(getRoleName(admin) || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
    return (
      name === 'full_access' ||
      name === 'dev_full_access' ||
      name.endsWith('_full_access')
    );
  }, [admin]);

  const canEditEmpCode = useMemo(() => {
    const mobile = String(admin?.mobile || '').trim();
    return (SHOW_EDIT_EMP_CODE as readonly string[]).includes(mobile);
  }, [admin?.mobile]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const deferredRows = useDeferredValue(rows);
  const isClientPagedType = userType === 'Non_Performing_Active_User';
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage) || 1);
  const tableRows = useMemo(() => {
    // API returns the full list (no pageNo) — paginate on the client.
    if (!isClientPagedType) return deferredRows;
    const start = (page - 1) * itemsPerPage;
    return deferredRows.slice(start, start + itemsPerPage);
  }, [deferredRows, isClientPagedType, page, itemsPerPage]);

  // Keep selection on allowed types (caller / permission gates)
  useEffect(() => {
    if (!typeOptions.some((opt) => opt.value === userType)) {
      setUserType('User');
    }
  }, [typeOptions, userType]);

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const isNonPerfActive = userType === 'Non_Performing_Active_User';
        const applyEmpRules =
          userType === 'User' ||
          userType === 'Non_Performing_User' ||
          isNonPerfActive;
        // Non_Performing_Active only searches by empCode (laxminarayan always passes false)
        const otherSearch = isNonPerfActive
          ? false
          : hasOtherUserSearch(applied, clientName, playedIn);
        let empResolved: Extract<
          ReturnType<typeof resolveSearchEmpCode>,
          { ok: true }
        > = { ok: true };

        if (applyEmpRules) {
          const resolved = resolveSearchEmpCode(
            applied.empCode,
            loginEmpCode,
            otherSearch,
          );
          if (!resolved.ok) {
            toast.error(resolved.message);
            setRows([]);
            setTotal(0);
            return;
          }
          empResolved = resolved;
        }

        const filter = buildUserFilter(
          userType,
          applied,
          clientName,
          playedIn,
          uniqueUser,
          applyEmpRules ? empResolved : undefined,
        );

        const payload = buildPayloadForType(userType, {
          pageNo,
          itemsPerPage,
          filter,
          startDate,
          endDate,
          allottedApps: userType === 'User' ? undefined : allottedApps,
          appWithState:
            userType === 'User' || userType === 'Sub_Admin'
              ? undefined
              : admin?.appWithState,
          selectedClientName: clientName || undefined,
          activeUserStart: applied.activeUserStart || undefined,
          activeUserEnd: applied.activeUserEnd || undefined,
        });

        const res = await secureApi(actionForType(userType), payload);
        if (!isCurrent(gen)) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load users');
          return;
        }

        const parsed = unpackByType(userType, res.data);
        let list = parsed.rows;

        if (userType === 'User') {
          list = excludeDumped(list);
        }

        const trimmedEmp = String(applied.empCode || '').trim();
        if (applyEmpRules && loginEmpCode) {
          if (empResolved.allowOwnAndDefault || empResolved.matchDefault) {
            list = filterSearchByEmpCode(list, loginEmpCode, empResolved);
          } else if (empResolved.apiEmpCode) {
            list = filterListByLoginEmpCode(list, empResolved.apiEmpCode);
          } else {
            list = filterListByLoginEmpCode(list, loginEmpCode);
          }
        } else if (isNonPerfActive && !loginEmpCode && trimmedEmp) {
          // Admin without login empCode: API may ignore filter — match client-side
          list = list.filter((row) =>
            empCodesEqual(row.empCode, trimmedEmp),
          );
        }

        if (accessibleStates.length > 0) {
          list = list.filter((row: UserRow) =>
            accessibleStates.includes(String(row.state || '').toLowerCase()),
          );
        }

        // Match reference: dialer/bot source tracks the current loaded table.
        setRows(list);
        setDialerData(list);
        setTotal(Number(parsed.total) || list.length);
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      accessibleStates,
      admin?.appWithState,
      allottedApps,
      applied,
      begin,
      clientName,
      end,
      endDate,
      isCurrent,
      itemsPerPage,
      loginEmpCode,
      next,
      page,
      playedIn,
      startDate,
      uniqueUser,
      userType,
    ],
  );

  useEffect(() => {
    // Non_Performing_Active_User has no server pagination — fetch once per filter set.
    void load(isClientPagedType ? 1 : page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isClientPagedType ? 0 : page,
    isClientPagedType ? 0 : itemsPerPage,
    userType,
    applied,
    clientName,
    playedIn,
    uniqueUser,
    startDate,
    endDate,
    appsKey,
  ]);

  const setDraftField = useCallback(
    (key: keyof UserFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const loadGlobals = useCallback(async () => {
    const from = startDate && endDate ? startDate : todayIstYmd();
    const to = startDate && endDate ? endDate : todayIstYmd();
    const res = await secureApi('users.getGlobalsCount', {
      startDate: from,
      endDate: to,
    });
    if (!res.ok) return 0;
    let items = unpackGlobalsPayload(res.data);
    if (accessibleStates.length > 0) {
      items = items.filter((row) =>
        accessibleStates.includes(String(row.state || '').toLowerCase()),
      );
    }
    // Count only — do not replace dialer source (list load owns dialerData).
    setGlobalCount(items.length);
    return items.length;
  }, [accessibleStates, endDate, startDate]);

  const handleApply = useCallback(() => {
    setApplied(draft);
    setPage(1);
    void loadGlobals();
  }, [draft, loadGlobals]);

  const handleAddToBot = useCallback(async () => {
    if (!botId) {
      toast.error('Bot ID should not be empty.');
      return;
    }
    // Prefer current table (dialerData synced on load); fall back to rows.
    const source = dialerData.length ? dialerData : rows;
    if (!source.length) {
      toast.error('No users available for bot');
      return;
    }
    setDialerLoading(true);
    try {
      const res = await secureApi('callLogs.addToBotDialer', {
        userId: admin?._id,
        created_by: admin?.name,
        dialout_settings: mapUsersToBotSettings(
          source,
          botId,
          reasonForUserType(userType),
        ),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add to bot');
        return;
      }
      toast.success(res.message || 'Call Initiated Successfully.');
    } finally {
      setDialerLoading(false);
    }
  }, [admin?._id, admin?.name, botId, dialerData, rows, userType]);

  const handleAddToDialer = useCallback(async () => {
    if (!campaignId) {
      toast.error('Campaign Name should not be empty');
      return;
    }
    const source = dialerData.length ? dialerData : rows;
    if (!source.length) {
      toast.error('No users available for dialer');
      return;
    }
    const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId);
    setDialerLoading(true);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId,
        leads: mapUsersToDialerLeads(source),
        serverId: campaign?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Dialer call failed');
        return;
      }
      await secureApi('ops.savePerformanceData', {
        subAdminId: admin?._id,
        dialledUserIds: source.map((r) => r._id).filter(Boolean),
        extensionId: campaignId,
      });
      toast.success(res.message || 'Dialer call queued');
    } finally {
      setDialerLoading(false);
    }
  }, [admin?._id, campaignId, dialerData, rows]);

  useEffect(() => {
    void loadGlobals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeBlockDialog = useCallback(() => {
    setBlockTarget(null);
    setRemark('');
    setOtp('');
    setBlockNextStatus(false);
  }, []);

  /** Open OTP+remark dialog, then send OTP to SuperAdmin (always asks OTP). */
  const startBlockWithOtp = useCallback(
    async (row: UserRow) => {
      if (isCaller) return;
      const currentlyBlocked = Boolean(row.blockUser || row.block);
      const nextBlocked = !currentlyBlocked;
      setBlockTarget(row);
      setBlockNextStatus(nextBlocked);
      setRemark('');
      setOtp('');
      setOtpSending(true);
      setActionBusyId(row._id);
      try {
        const res = await secureApi('users.sendBlockOtp', {
          mobile: resolveBlockOtpMobile(admin?.mobile),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to send OTP');
          return;
        }
        toast.success('OTP sent successfully to SuperAdmin');
      } finally {
        setOtpSending(false);
        setActionBusyId('');
      }
    },
    [admin?.mobile, isCaller],
  );

  const resendBlockOtp = useCallback(async () => {
    setOtpSending(true);
    try {
      const res = await secureApi('users.sendBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to resend OTP');
        return;
      }
      toast.success('OTP resent successfully to SuperAdmin');
    } finally {
      setOtpSending(false);
    }
  }, [admin?.mobile]);

  const confirmBlock = useCallback(async () => {
    if (!blockTarget) return;
    if (!otp.trim()) {
      toast.error('Please enter OTP');
      return;
    }
    if (!remark.trim()) {
      toast.error('Please enter remark');
      return;
    }

    const targetId = blockTarget._id;
    const nextBlocked = blockNextStatus;
    const reason = remark.trim();

    setActionBusyId(targetId);
    try {
      const verify = await secureApi('users.verifyBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
        otp: Number.parseInt(otp.trim(), 10),
      });
      if (!verify.ok) {
        toast.error(verify.message || 'Invalid OTP');
        return;
      }

      const res = await secureApi('users.blockUnblock', {
        _id: targetId,
        blockUser: nextBlocked,
        blockUserReason: reason,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update block status');
        return;
      }
      toast.success(nextBlocked ? 'User blocked' : 'User unblocked');

      // Immediate UI update (don't wait for list refetch)
      setRows((prev) => {
        const leaveList =
          (applied.blockStatus === 'unblock' && nextBlocked) ||
          (applied.blockStatus === 'block' && !nextBlocked);
        if (leaveList) return prev.filter((row) => row._id !== targetId);
        return prev.map((row) =>
          row._id === targetId
            ? {
                ...row,
                blockUser: nextBlocked,
                block: nextBlocked,
                blockUserReason: reason,
              }
            : row,
        );
      });
      closeBlockDialog();
      // Force fresh list from API
      await load(page);
    } finally {
      setActionBusyId('');
    }
  }, [
    admin?.mobile,
    applied.blockStatus,
    blockNextStatus,
    blockTarget,
    closeBlockDialog,
    load,
    otp,
    page,
    remark,
  ]);

  const confirmDump = useCallback(async () => {
    if (!dumpTarget) return;
    if (!dumpReason.trim()) {
      toast.error('Reason is Required');
      return;
    }
    setActionBusyId(dumpTarget._id);
    try {
      // Match laxminarayan: IST date as YYYY-MM-DD
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const res = await secureApi('ops.dumpUsersUpdate', {
        _id: dumpTarget._id,
        dump: true,
        dumpReason: {
          name: admin?.name || '',
          reason: dumpReason.trim(),
          Date: istDate,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to dump user');
        return;
      }
      toast.success('User dumped');
      setDumpTarget(null);
      setDumpReason('');
      void load(page);
    } finally {
      setActionBusyId('');
    }
  }, [admin?.name, dumpReason, dumpTarget, load, page]);

  const openSubEdit = useCallback((id: string, type: SubAdminEditType, current?: string) => {
    setSubEdit({ id, type });
    setSubEditValue(String(current || ''));
  }, []);

  const submitSubEdit = useCallback(async () => {
    if (!subEdit) return;
    const value = subEditValue.trim();
    if (!value) {
      toast.error('Value is required');
      return;
    }
    setSubEditBusy(true);
    try {
      if (subEdit.type === 'telegram') {
        const res = await secureApi('ops.updateSubadminAttributes', {
          userId: subEdit.id,
          telegramUsername: value,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update telegram');
          return;
        }
      } else if (subEdit.type === 'empCode') {
        const res = await secureApi('users.setUserEmpCode', {
          _id: subEdit.id,
          empCode: value,
          modifiedBy: admin?._id,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update emp code');
          return;
        }
      } else {
        const res = await secureApi('users.updateSubAdminName', {
          _id: subEdit.id,
          ...(subEdit.type === 'name' ? { name: value } : { mobile: value }),
          updatedBy: { _id: admin?._id, name: admin?.name },
          reason:
            subEdit.type === 'name'
              ? 'Correcting wrong Name'
              : 'Correcting wrong Mobile Number',
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update');
          return;
        }
      }
      toast.success('Updated successfully');
      setSubEdit(null);
      setSubEditValue('');
      void load(page);
    } finally {
      setSubEditBusy(false);
    }
  }, [admin?._id, admin?.name, load, page, subEdit, subEditValue]);

  const renderEmpCodeCell = useCallback(
    (r: UserRow) => (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={0.5}
        sx={{ width: '100%' }}
      >
        <Typography variant="body2" noWrap>
          {String(r.empCode || '001')}
        </Typography>
        {canEditEmpCode ? (
          <IconButton
            size="small"
            title="Edit emp code"
            onClick={() => openSubEdit(r._id, 'empCode', String(r.empCode || '001'))}
            sx={{ color: '#ff9f0a' }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ) : null}
      </Stack>
    ),
    [canEditEmpCode, openSubEdit],
  );

  const openRoleEdit = useCallback(
    async (row: UserRow) => {
      setRoleEditId(row._id);
      setRoleEditValue(String(row.Role_ID || ''));
      try {
        const res = await secureApi('roles.list', {});
        if (!res.ok) {
          toast.error(res.message || 'Failed to load roles');
          return;
        }
        const data = res.data as
          | RoleOption[]
          | { items?: RoleOption[]; payload?: RoleOption[] }
          | undefined;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.payload)
              ? data.payload
              : [];
        setRoleOptions(list);
      } catch {
        toast.error('Failed to load roles');
      }
    },
    [],
  );

  const submitRoleEdit = useCallback(async () => {
    if (!roleEditId || !roleEditValue) {
      toast.error('Please select a role');
      return;
    }
    setRoleEditBusy(true);
    try {
      const res = await secureApi('users.updateSubAdminRole', {
        subAdminId: roleEditId,
        updatedBy: admin?._id,
        roleId: roleEditValue,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      setRoleEditId(null);
      void load(page);
    } finally {
      setRoleEditBusy(false);
    }
  }, [admin?._id, load, page, roleEditId, roleEditValue]);

  const updateSubAdminLocation = useCallback(
    async (row: UserRow) => {
      const loc = (locationDraft[row._id] || row.officeLocation || '').toString().trim();
      if (!loc) {
        toast.error('Please select a location');
        return;
      }
      setLocationBusyId(row._id);
      try {
        const res = await secureApi('ops.updateOfficeLocation', {
          _id: row._id,
          officeLocation: loc,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update location');
          return;
        }
        toast.success('Location updated successfully');
        void load(page);
      } finally {
        setLocationBusyId('');
      }
    },
    [load, locationDraft, page],
  );

  const submitRealName = useCallback(async () => {
    if (!realNameTargetId) return;
    if (!realNameValue.trim()) {
      toast.error('Please enter Real Name');
      return;
    }
    setRealNameBusy(true);
    try {
      const res = await secureApi('users.updateRealName', {
        _id: realNameTargetId,
        realName: realNameValue.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update real name');
        return;
      }
      toast.success(res.message || 'Real name updated');
      setRealNameTargetId(null);
      setRealNameValue('');
      void load(page);
    } finally {
      setRealNameBusy(false);
    }
  }, [load, page, realNameTargetId, realNameValue]);

  const startBlockCaller = useCallback(
    async (row: UserRow) => {
      const next = !Boolean(row.block);
      setBlockCallerBusy(true);
      try {
        const res = await secureApi('users.sendBlockOtp', {
          mobile: resolveBlockOtpMobile(admin?.mobile),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to send OTP');
          return;
        }
        toast.success('OTP sent successfully to SuperAdmin');
        setBlockCallerTarget(row);
        setBlockCallerNext(next);
        setBlockCallerRemark('');
        setBlockCallerOtp('');
      } finally {
        setBlockCallerBusy(false);
      }
    },
    [admin?.mobile],
  );

  const confirmBlockCaller = useCallback(async () => {
    if (!blockCallerTarget) return;
    if (!blockCallerOtp.trim()) {
      toast.error('Please enter OTP');
      return;
    }
    if (!blockCallerRemark.trim()) {
      toast.error('Please enter remark');
      return;
    }
    setBlockCallerBusy(true);
    try {
      const verify = await secureApi('users.verifyBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
        otp: Number(blockCallerOtp.trim()),
      });
      if (!verify.ok) {
        toast.error(verify.message || 'Invalid OTP');
        return;
      }
      const res = await secureApi('ops.blockCaller', {
        _id: blockCallerTarget._id,
        Role_ID: blockCallerTarget.Role_ID,
        status: blockCallerNext,
        blockReason: blockCallerRemark.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update caller block');
        return;
      }
      toast.success(res.message || 'Updated successfully');
      setBlockCallerTarget(null);
      void load(page);
    } finally {
      setBlockCallerBusy(false);
    }
  }, [
    admin?.mobile,
    blockCallerNext,
    blockCallerOtp,
    blockCallerRemark,
    blockCallerTarget,
    load,
    page,
  ]);

  const columns = useMemo<CommonTableColumn<UserRow>[]>(() => {
    if (userType === 'Sub_Admin') {
      return [
        {
          id: 'index',
          label: '#',
          width: 56,
          filter: null,
          render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
        },
        {
          id: 'name',
          label: 'Name',
          width: 160,
          filter: (
            <FilterInput
              value={draft.name}
              onChange={setDraftField('name')}
              onSearch={search}
              placeholder="Search name"
              compact
            />
          ),
          render: (r) => (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={0.5}
              sx={{ width: '100%' }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>{renderUserName(r)}</Box>
              <IconButton
                size="small"
                title="Edit name"
                onClick={() => openSubEdit(r._id, 'name', r.name)}
                sx={{ color: '#ff9f0a' }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          ),
        },
        {
          id: 'mobile',
          label: 'Mobile Phone',
          width: 200,
          filter: canShowMobile ? (
            <FilterInput
              value={draft.mobile}
              onChange={setDraftField('mobile')}
              onSearch={search}
              placeholder="Search mobile"
            />
          ) : null,
          render: (r) => (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={0.5}
              sx={{ width: '100%' }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                {showMobileColumn ? (
                  <CallingBtn item={r} reasonList="User List" botId={botId || '1'} />
                ) : canShowMobile ? (
                  String(r.mobile || '-')
                ) : r.mobile ? (
                  '**********'
                ) : (
                  '-'
                )}
              </Box>
              <IconButton
                size="small"
                title="Edit mobile"
                onClick={() => openSubEdit(r._id, 'mobile', r.mobile)}
                sx={{ color: '#ff9f0a' }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          ),
        },
        {
          id: 'telegram',
          label: 'Telegram ID',
          width: 150,
          filter: null,
          render: (r) => (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={0.5}
            >
              <Typography variant="body2" noWrap>
                {String(r.telegram_username || r.telegramUsername || '-')}
              </Typography>
              <IconButton
                size="small"
                title="Edit telegram"
                onClick={() =>
                  openSubEdit(
                    r._id,
                    'telegram',
                    String(r.telegram_username || r.telegramUsername || ''),
                  )
                }
                sx={{ color: '#ff9f0a' }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          ),
        },
        {
          id: 'email',
          label: 'Email',
          filter: null,
          render: (r) => String(r.email || '-'),
        },
        {
          id: 'role',
          label: 'Role',
          width: 160,
          filter: null,
          render: (r) => (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2" noWrap>
                {String(r.Role_Name || '-')}
              </Typography>
              {canEditSubAdminRole ? (
                <IconButton
                  size="small"
                  title="Edit role"
                  onClick={() => void openRoleEdit(r)}
                  sx={{ color: '#ff9f0a' }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null}
            </Stack>
          ),
        },
        {
          id: 'location',
          label: 'Location',
          width: 180,
          filter: null,
          render: (r) => {
            const current =
              locationDraft[r._id] ??
              String(r.officeLocation || r.location || '');
            return (
              <Stack spacing={0.75} sx={{ py: 0.5, minWidth: 150 }}>
                <Typography variant="caption" color="text.secondary">
                  Location :- {String(r.officeLocation || '-')}
                </Typography>
                <TextField
                  select
                  size="small"
                  fullWidth={false}
                  value={current}
                  onChange={(e) =>
                    setLocationDraft((prev) => ({
                      ...prev,
                      [r._id]: e.target.value,
                    }))
                  }
                  sx={{
                    width: 150,
                    '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
                  }}
                >
                  <MenuItem value="" disabled>
                    Select location
                  </MenuItem>
                  {SUBADMIN_LOCATIONS.map((loc) => (
                    <MenuItem key={loc} value={loc}>
                      {loc}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="contained"
                  disabled={locationBusyId === r._id}
                  onClick={() => void updateSubAdminLocation(r)}
                  sx={{
                    bgcolor: '#ff9f0a',
                    color: '#1a1200',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: 11,
                    '&:hover': { bgcolor: '#e08c00' },
                  }}
                >
                  {locationBusyId === r._id ? '…' : 'Update Location'}
                </Button>
              </Stack>
            );
          },
        },
        {
          id: 'action',
          label: 'Action',
          width: 150,
          filter: null,
          render: (r) => (
            <Stack spacing={0.75} sx={{ py: 0.5 }}>
              <Button
                size="small"
                variant="contained"
                disabled={blockCallerBusy}
                onClick={() => void startBlockCaller(r)}
                sx={{
                  bgcolor: '#ff9f0a',
                  color: '#1a1200',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: 11,
                  '&:hover': { bgcolor: '#e08c00' },
                }}
              >
                {r.block === true ? 'Un Block Caller' : 'Block Caller'}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setRealNameTargetId(r._id);
                  setRealNameValue(String(r.realName || ''));
                }}
                sx={{
                  bgcolor: '#ff9f0a',
                  color: '#1a1200',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: 11,
                  '&:hover': { bgcolor: '#e08c00' },
                }}
              >
                Add Real Name
              </Button>
            </Stack>
          ),
        },
        {
          id: 'lastActivity',
          label: 'Last Activity',
          width: DATETIME_COL_WIDTH,
          headSx: DATETIME_COL_SX,
          cellSx: DATETIME_COL_SX,
          filter: null,
          render: (r) => pickLastActivity(r),
        },
      ];
    }

    // Laxminarayan Non_Performing_Active_User table
    if (userType === 'Non_Performing_Active_User') {
      const cols: CommonTableColumn<UserRow>[] = [
        {
          id: 'index',
          label: '#',
          width: 56,
          filter: null,
          render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
        },
        {
          id: 'name',
          label: 'Name',
          width: NAME_COL_WIDTH,
          headSx: NAME_COL_SX,
          cellSx: NAME_COL_SX,
          filter: null,
          render: (r) => renderUserName(r),
        },
        {
          id: 'dpId',
          label: 'Dp Id',
          width: DP_ID_COL_WIDTH,
          headSx: DP_ID_COL_SX,
          cellSx: DP_ID_COL_SX,
          filter: null,
          render: (r) => <CompactDpId value={String(r._id || '')} />,
        },
      ];
      if (showMobileColumn) {
        cols.push({
          id: 'mobile',
          label: (
            <>
              Mobile
              <br />
              Phone
            </>
          ),
          width: MOBILE_COL.width,
          headSx: MOBILE_COL.sx,
          cellSx: MOBILE_COL.sx,
          filter: null,
          render: (r) => (
            <CallingBtn
              item={r}
              botId={botId}
              reasonList={reasonForUserType(userType)}
            />
          ),
        });
      }
      cols.push(
        {
          id: 'app',
          label: (
            <>
              App
              <br />
              Code
            </>
          ),
          filter: null,
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'empCode',
          label: 'Emp Code',
          filter: canShowMobile ? (
            <FilterInput
              value={draft.empCode}
              onChange={setDraftField('empCode')}
              onSearch={search}
              placeholder={
                loginEmpCode
                  ? `Emp Code (${loginEmpCode}/001)`
                  : 'Search by Emp Code'
              }
            />
          ) : null,
          render: (r) => renderEmpCodeCell(r),
        },
        {
          id: 'lastActive',
          label: 'Last Active',
          filter: null,
          render: (r) => {
            const raw =
              r.lastEngagementDate ??
              r.lastActive ??
              r.activeUser ??
              r.lastActivity;
            if (raw == null || raw === '') return '-';
            return formatDisplayDate(raw) || String(raw);
          },
        },
        {
          id: 'previousActive',
          label: 'Previous Active',
          filter: null,
          render: (r) => {
            const raw =
              r.prevEngagementDate ??
              r.previousActive ??
              r.prevActive ??
              r.previousEngagementDate;
            if (raw == null || raw === '') return '-';
            return formatDisplayDate(raw) || String(raw);
          },
        },
      );
      return cols;
    }

    // Laxminarayan LAXMI_999_Users table
    if (userType === 'LAXMI_999_Users') {
      const cols: CommonTableColumn<UserRow>[] = [
        {
          id: 'index',
          label: '#',
          width: 56,
          filter: null,
          render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
        },
        {
          id: 'name',
          label: 'Name',
          width: NAME_COL_WIDTH,
          headSx: NAME_COL_SX,
          cellSx: NAME_COL_SX,
          filter: null,
          render: (r) => renderUserName(r),
        },
        {
          id: 'dpId',
          label: 'Dp Id',
          width: DP_ID_COL_WIDTH,
          headSx: DP_ID_COL_SX,
          cellSx: DP_ID_COL_SX,
          filter: null,
          render: (r) => (
            <CompactDpId value={String(r.dp_id ?? r._id ?? '')} />
          ),
        },
        {
          id: 'userId',
          label: 'User Id',
          filter: (
            <FilterInput
              value={draft.userId}
              onChange={setDraftField('userId')}
              onSearch={search}
              placeholder="Search by User ID"
            />
          ),
          render: (r) => String(r.userId || '-'),
        },
      ];

      if (showMobileColumn) {
        cols.push({
          id: 'mobile',
          label: (
            <>
              Mobile
              <br />
              Phone
            </>
          ),
          width: MOBILE_COL.width,
          headSx: MOBILE_COL.sx,
          cellSx: MOBILE_COL.sx,
          filter: canShowMobile ? (
            <FilterInput
              value={draft.mobile}
              onChange={setDraftField('mobile')}
              onSearch={search}
              placeholder="Search by Mobile"
            />
          ) : null,
          render: (r) => (
            <CallingBtn
              item={r}
              botId={botId}
              reasonList={reasonForUserType(userType)}
            />
          ),
        });
      }

      cols.push(
        {
          id: 'activeUserDate',
          label: (
            <>
              Active User
              <br />
              Date
            </>
          ),
          filter: (
            <DateRangeFilter
              start={draft.activeUserStart}
              end={draft.activeUserEnd}
              onStart={setDraftField('activeUserStart')}
              onEnd={setDraftField('activeUserEnd')}
              onSearch={search}
            />
          ),
          render: (r) =>
            r.activeUser ? formatDisplayDate(r.activeUser) || '-' : '-',
        },
        {
          id: 'activeDays',
          label: 'Active Days',
          filter: null,
          render: (r) => String(r.active_days ?? '-'),
        },
        {
          id: 'firstWallet',
          label: (
            <>
              First Wallet
              <br />
              Date
            </>
          ),
          filter: null,
          render: (r) =>
            r.first_wallet_date
              ? formatDisplayDate(r.first_wallet_date) || '-'
              : '-',
        },
        {
          id: 'lastWallet',
          label: (
            <>
              Last Wallet
              <br />
              Date
            </>
          ),
          filter: (
            <DateRangeFilter
              start={draft.lastWalletStart}
              end={draft.lastWalletEnd}
              onStart={setDraftField('lastWalletStart')}
              onEnd={setDraftField('lastWalletEnd')}
              onSearch={search}
            />
          ),
          render: (r) =>
            r.last_wallet_date
              ? formatDisplayDate(r.last_wallet_date) || '-'
              : '-',
        },
        {
          id: 'totalDeposit',
          label: 'Total Deposit',
          align: 'right',
          filter: null,
          render: (r) => formatAmount(r.total_deposit ?? r.totalDeposit),
        },
        {
          id: 'totalWithdraw',
          label: 'Total Withdrawal',
          align: 'right',
          filter: null,
          render: (r) =>
            formatAmount(r.total_withdraw ?? r.totalWithdrawal),
        },
        {
          id: 'app',
          label: (
            <>
              App
              <br />
              Code
            </>
          ),
          filter: null,
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'netCashFlow',
          label: (
            <>
              Net Cash
              <br />
              Flow
            </>
          ),
          align: 'right',
          filter: null,
          render: (r) => formatAmount(r.net_cash_flow),
        },
        {
          id: 'state',
          label: 'State',
          width: STATE_COL_WIDTH,
          headSx: STATE_COL_SX,
          cellSx: STATE_COL_SX,
          filter: (
            <StateMultiFilter
              value={draft.states}
              onChange={(states) => setDraft((prev) => ({ ...prev, states }))}
              onSearch={search}
            />
          ),
          render: (r) => String(r.state || '-'),
        },
        {
          id: 'city',
          label: 'City',
          width: CITY_COL_WIDTH,
          headSx: CITY_COL_SX,
          cellSx: CITY_COL_SX,
          filter: (
            <FilterInput
              value={draft.city}
              onChange={setDraftField('city')}
              onSearch={search}
              placeholder="City"
              compact
            />
          ),
          render: (r) => String(r.city || '-'),
        },
      );

      return cols;
    }

    // Laxminarayan In_Active_Deposit table (header + column filters)
    if (userType === 'In_Active_Deposit') {
      const cols: CommonTableColumn<UserRow>[] = [
        {
          id: 'index',
          label: '#',
          width: 56,
          filter: null,
          render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
        },
        {
          id: 'name',
          label: 'Name',
          width: NAME_COL_WIDTH,
          headSx: NAME_COL_SX,
          cellSx: NAME_COL_SX,
          filter: (
            <FilterInput
              value={draft.name}
              onChange={setDraftField('name')}
              onSearch={search}
              placeholder="Name"
              compact
            />
          ),
          render: (r) => renderUserName(r),
        },
        {
          id: 'dpId',
          label: 'Dp Id',
          width: DP_ID_COL_WIDTH,
          headSx: DP_ID_COL_SX,
          cellSx: DP_ID_COL_SX,
          filter: (
            <FilterInput
              value={draft.dpId}
              onChange={setDraftField('dpId')}
              onSearch={search}
              placeholder="DP ID"
              compact
            />
          ),
          render: (r) => <CompactDpId value={String(r._id || '')} />,
        },
        {
          id: 'bank',
          label: (
            <>
              User Bank
              <br />
              Name
            </>
          ),
          filter: null,
          render: (r) => pickUserBankName(r),
        },
        {
          id: 'app',
          label: (
            <>
              App
              <br />
              Code
            </>
          ),
          filter: (
            <TextField
              select
              size="small"
              fullWidth
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setPage(1);
              }}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#fff',
                  color: '#111',
                  fontSize: 12,
                },
              }}
            >
              <MenuItem value="">All</MenuItem>
              {CLIENT_NAMES.map((name) => (
                <MenuItem key={name} value={name}>
                  {appCodeForName(name)}
                </MenuItem>
              ))}
            </TextField>
          ),
          render: (r) => appCodeForName(r.clientName),
        },
        {
          id: 'encrypted',
          label: (
            <>
              User Encrypted
              <br />
              Dp Id
            </>
          ),
          filter: null,
          render: (r) => String(r.encryptedUserName || '-'),
        },
      ];

      if (showMobileColumn) {
        cols.push({
          id: 'mobile',
          label: (
            <>
              Mobile
              <br />
              Phone
            </>
          ),
          width: MOBILE_COL.width,
          headSx: MOBILE_COL.sx,
          cellSx: MOBILE_COL.sx,
          filter: canShowMobile ? (
            <FilterInput
              value={draft.mobile}
              onChange={setDraftField('mobile')}
              onSearch={search}
              placeholder="Search by mobile"
              compact
            />
          ) : null,
          render: (r) => (
            <CallingBtn
              item={r}
              botId={botId}
              reasonList={reasonForUserType(userType)}
            />
          ),
        });
      }

      if (!isCaller) {
        cols.push(
          {
            id: 'account',
            label: (
              <>
                Account
                <br />
                Number
              </>
            ),
            filter: (
              <FilterInput
                value={draft.accountNumber}
                onChange={setDraftField('accountNumber')}
                onSearch={search}
                placeholder="Search by acc no"
              />
            ),
            render: (r) => pickAccountNumber(r),
          },
          {
            id: 'aadhaar',
            label: (
              <>
                Aadhar
                <br />
                Number
              </>
            ),
            filter: (
              <FilterInput
                value={draft.aadhaarNumber}
                onChange={setDraftField('aadhaarNumber')}
                onSearch={search}
                placeholder="Search by aadhar no"
              />
            ),
            render: (r) => pickAadharNumber(r),
          },
        );

        if (!hideContact) {
          cols.push({
            id: 'email',
            label: 'Email',
            filter: (
              <FilterInput
                value={draft.email}
                onChange={setDraftField('email')}
                onSearch={search}
                placeholder="Search by email"
              />
            ),
            render: (r) => String(r.email || '-'),
          });
        }
      }

      cols.push(
        {
          id: 'city',
          label: 'City',
          width: CITY_COL_WIDTH,
          headSx: CITY_COL_SX,
          cellSx: CITY_COL_SX,
          filter: (
            <FilterInput
              value={draft.city}
              onChange={setDraftField('city')}
              onSearch={search}
              placeholder="City"
              compact
            />
          ),
          render: (r) => String(r.city || '-'),
        },
        {
          id: 'state',
          label: 'State',
          width: STATE_COL_WIDTH,
          headSx: STATE_COL_SX,
          cellSx: STATE_COL_SX,
          filter: (
            <StateMultiFilter
              value={draft.states}
              onChange={(states) => setDraft((prev) => ({ ...prev, states }))}
              onSearch={search}
            />
          ),
          render: (r) => String(r.state || '-'),
        },
        {
          id: 'device',
          label: (
            <>
              Device
              <br />
              Type
            </>
          ),
          filter: (
            <FilterInput
              value={draft.deviceType}
              onChange={setDraftField('deviceType')}
              onSearch={search}
              placeholder="Device Type"
            />
          ),
          render: (r) => String(r.deviceType || '-'),
        },
        {
          id: 'appVersion',
          label: (
            <>
              Current App
              <br />
              Version
            </>
          ),
          filter: null,
          render: (r) => String(r.currentAppVersion || '-'),
        },
        {
          id: 'updatedVersion',
          label: (
            <>
              Updated App
              <br />
              Version
            </>
          ),
          filter: null,
          render: (r) => String(r.updatedAppVersion || '-'),
        },
        {
          id: 'balance',
          label: 'Balance',
          align: 'right',
          filter: null,
          render: (r) => formatAmount(r.balance),
        },
        {
          id: 'created',
          label: 'Created',
          width: DATETIME_COL_WIDTH,
          headSx: DATETIME_COL_SX,
          cellSx: DATETIME_COL_SX,
          filter: null,
          render: (r) =>
            r.createdOn ? formatDisplayDate(r.createdOn) : '-',
        },
        {
          id: 'time',
          label: 'Time',
          filter: null,
          render: (r) =>
            r.createdOn ? formatDisplayTime(r.createdOn) || '-' : '-',
        },
        {
          id: 'lastActivity',
          label: (
            <>
              Last
              <br />
              Activity
            </>
          ),
          width: DATETIME_COL_WIDTH,
          headSx: DATETIME_COL_SX,
          cellSx: DATETIME_COL_SX,
          filter: null,
          render: (r) => pickLastActivity(r),
        },
        {
          id: 'bonus',
          label: (
            <>
              Free Points
              <br />
              Bonus
            </>
          ),
          align: 'right',
          filter: null,
          render: (r) =>
            formatAmount(
              r.bonusWalletBalance ?? r.bonusBalance ?? r.bonus,
            ),
        },
      );

      if (!isCaller) {
        cols.push(
          {
            id: 'action',
            label: 'Action',
            filter: null,
            render: (r) => {
              const blocked = Boolean(r.blockUser || r.block);
              const busy = actionBusyId === r._id || otpSending;
              return (
                <Button
                  size="small"
                  variant="contained"
                  color={blocked ? 'success' : 'error'}
                  disabled={busy}
                  onClick={() => void startBlockWithOtp(r)}
                >
                  {blocked ? 'Unblock' : 'Block'}
                </Button>
              );
            },
          },
          {
            id: 'blockReason',
            label: (
              <>
                Block User
                <br />
                Reason
              </>
            ),
            filter: null,
            render: (r) => String(r.blockUserReason || '-'),
          },
        );
      }

      return cols;
    }

    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: INDEX_COL.width,
        headSx: INDEX_COL.sx,
        cellSx: INDEX_COL.sx,
        filter: null,
        render: (_r, i) => (page - 1) * itemsPerPage + i + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: NAME_COL.width,
        headSx: NAME_COL.sx,
        cellSx: NAME_COL.sx,
        filter: (
          <FilterInput
            value={draft.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Name"
            compact
          />
        ),
        render: (r) => (
          <Stack spacing={0.5} alignItems="center" sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            {renderUserName(r)}
            {(userType === 'User' ||
              userType === 'Non_Performing_User' ||
              userType === 'Todays_Active' ||
              userType === 'Active_User') &&
              !isCaller && (
              <Button
                size="small"
                variant="contained"
                disabled={actionBusyId === r._id}
                onClick={() => {
                  setDumpTarget(r);
                  setDumpReason('');
                }}
                sx={{
                  minWidth: 56,
                  px: 1.25,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#f1a144',
                  color: '#000',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#e09030', boxShadow: 'none' },
                }}
              >
                Dump
              </Button>
            )}
          </Stack>
        ),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        width: DP_ID_COL.width,
        headSx: DP_ID_COL.sx,
        cellSx: DP_ID_COL.sx,
        filter: (
          <FilterInput
            value={draft.dpId}
            onChange={setDraftField('dpId')}
            onSearch={search}
            placeholder="DP ID"
            compact
          />
        ),
        render: (r) => {
          const id = String(r._id || '');
          if (!id) return '-';
          return <CompactDpId value={id} />;
        },
      },
    ];

    // Caller panel: hide User Bank Name
    if (!isCaller) {
      cols.push({
        id: 'bank',
        label: (
          <>
            User Bank
            <br />
            Name
          </>
        ),
        width: BANK_COL.width,
        headSx: BANK_COL.sx,
        cellSx: BANK_COL.sx,
        filter: null,
        render: (r) => pickUserBankName(r),
      });
    }

    cols.push(
      {
        id: 'app',
        label: (
          <>
            App
            <br />
            Code
          </>
        ),
        width: APP_COL.width,
        headSx: APP_COL.sx,
        cellSx: APP_COL.sx,
        filter: null,
        render: (r) => appCodeForName(r.clientName),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        width: EMP_COL.width,
        headSx: EMP_COL.sx,
        cellSx: EMP_COL.sx,
        filter: canShowMobile ? (
          <FilterInput
            value={draft.empCode}
            onChange={setDraftField('empCode')}
            onSearch={search}
            placeholder="Emp"
            compact
          />
        ) : null,
        render: (r) => renderEmpCodeCell(r),
      },
      {
        id: 'playIn',
        label: 'In',
        width: PLAY_COL.width,
        headSx: PLAY_COL.sx,
        cellSx: PLAY_COL.sx,
        filter: null,
        render: (r) => pickPlayIn(r),
      },
    );

    // Mobile + Call / Bot Call (laxminarayan CallingBtn). Number only with show_mobile.
    if (showMobileColumn) {
      cols.push({
        id: 'mobile',
        label: (
          <>
            Mobile
            <br />
            Phone
          </>
        ),
        width: MOBILE_COL.width,
        headSx: MOBILE_COL.sx,
        cellSx: MOBILE_COL.sx,
        filter: canShowMobile ? (
          <FilterInput
            value={draft.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Mobile"
            compact
          />
        ) : null,
        render: (r) => (
          <CallingBtn
            item={r}
            botId={botId}
            reasonList={reasonForUserType(userType)}
          />
        ),
      });
    }

    if (!isCaller) {
      cols.push({
        id: 'kyc',
        label: 'Kyc',
        width: KYC_COL.width,
        headSx: KYC_COL.sx,
        cellSx: KYC_COL.sx,
        filter: null,
        render: (r) => (r.kyc ? 'Done' : 'Not Done'),
      });
    }

    // Caller panel: hide Account / Aadhar / Email
    if (!isCaller) {
      cols.push(
        {
          id: 'account',
          label: (
            <>
              Account
              <br />
              Number
            </>
          ),
          width: ACCOUNT_COL.width,
          headSx: ACCOUNT_COL.sx,
          cellSx: ACCOUNT_COL.sx,
          filter: (
            <FilterInput
              value={draft.accountNumber}
              onChange={setDraftField('accountNumber')}
              onSearch={search}
              placeholder="Acc No"
              compact
            />
          ),
          render: (r) => pickAccountNumber(r),
        },
        {
          id: 'aadhaar',
          label: (
            <>
              Aadhar
              <br />
              Number
            </>
          ),
          width: AADHAR_COL.width,
          headSx: AADHAR_COL.sx,
          cellSx: AADHAR_COL.sx,
          filter: (
            <FilterInput
              value={draft.aadhaarNumber}
              onChange={setDraftField('aadhaarNumber')}
              onSearch={search}
              placeholder="Aadhar"
              compact
            />
          ),
          render: (r) => pickAadharNumber(r),
        },
      );

      if (!hideContact) {
        cols.push({
          id: 'email',
          label: 'Email',
          width: EMAIL_COL.width,
          headSx: EMAIL_COL.sx,
          cellSx: EMAIL_COL.sx,
          filter: (
            <FilterInput
              value={draft.email}
              onChange={setDraftField('email')}
              onSearch={search}
              placeholder="Email"
              compact
            />
          ),
          render: (r) => String(r.email || '-'),
        });
      }
    }

    cols.push(
      {
        id: 'city',
        label: 'City',
        width: CITY_COL.width,
        headSx: CITY_COL.sx,
        cellSx: CITY_COL.sx,
        filter: (
          <FilterInput
            value={draft.city}
            onChange={setDraftField('city')}
            onSearch={search}
            placeholder="City"
            compact
          />
        ),
        render: (r) => String(r.city || '-'),
      },
      {
        id: 'state',
        label: 'State',
        width: STATE_COL.width,
        headSx: STATE_COL.sx,
        cellSx: STATE_COL.sx,
        filter: (
          <StateMultiFilter
            value={draft.states}
            onChange={(states) => setDraft((prev) => ({ ...prev, states }))}
            onSearch={search}
          />
        ),
        render: (r) => String(r.state || '-'),
      },
    );

    // Caller panel: hide Previous Caller
    if (!isCaller) {
      cols.push({
        id: 'prevCaller',
        label: (
          <>
            Previous
            <br />
            Caller
          </>
        ),
        width: CALLER_COL.width,
        headSx: CALLER_COL.sx,
        cellSx: CALLER_COL.sx,
        filter: null,
        render: (r) => nestedCallerName(r.previousCaller),
      });
    }

    cols.push(
      {
        id: 'currCaller',
        label: (
          <>
            Current
            <br />
            Caller
          </>
        ),
        width: CALLER_COL.width,
        headSx: CALLER_COL.sx,
        cellSx: CALLER_COL.sx,
        filter: null,
        render: (r) => nestedCallerName(r.currentCaller),
      },
      {
        id: 'balance',
        label: 'Balance',
        width: AMOUNT_COL.width,
        headSx: AMOUNT_COL.sx,
        cellSx: AMOUNT_COL.sx,
        align: 'right',
        filter: null,
        render: (r) => formatAmount(r.balance),
      },
    );

    // Caller panel: hide Total Deposit
    if (!isCaller) {
      cols.push({
        id: 'deposit',
        label: (
          <>
            Total
            <br />
            Deposit
          </>
        ),
        width: AMOUNT_COL.width,
        headSx: AMOUNT_COL.sx,
        cellSx: AMOUNT_COL.sx,
        align: 'right',
        filter: null,
        render: (r) => formatAmount(r.totalDeposit),
      });
    }

    cols.push(
      {
        id: 'lastActivity',
        label: (
          <>
            Last
            <br />
            Activity
          </>
        ),
        width: DATETIME_COL.width,
        headSx: DATETIME_COL.sx,
        cellSx: DATETIME_COL.sx,
        filter: null,
        render: (r) => pickLastActivity(r),
      },
      {
        id: 'created',
        label: 'Created',
        width: DATETIME_COL.width,
        headSx: DATETIME_COL.sx,
        cellSx: DATETIME_COL.sx,
        filter: null,
        render: (r) =>
          r.createdOn
            ? `${formatDisplayDate(r.createdOn)}${
                formatDisplayTime(r.createdOn)
                  ? ` | ${formatDisplayTime(r.createdOn)}`
                  : ''
              }`
            : '-',
      },
    );

    // Caller panel: hide Action + Block Reason
    if (
      !isCaller &&
      (userType === 'User' || userType === 'Todays_Active')
    ) {
      cols.push(
        {
          id: 'action',
          label: 'Action',
          width: ACTION_COL.width,
          headSx: ACTION_COL.sx,
          cellSx: { ...ACTION_COL.sx, whiteSpace: 'normal' },
          filter: (
            <TextField
              select
              size="small"
              fullWidth
              value={draft.blockStatus}
              onChange={(e) => {
                setDraftField('blockStatus')(e.target.value);
              }}
              sx={{
                width: '100%',
                maxWidth: '100%',
                '& .MuiInputBase-root': {
                  bgcolor: '#fff',
                  color: '#111',
                  fontSize: 11,
                },
              }}
            >
              {BLOCK_STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          ),
          render: (r) => {
            const blocked = Boolean(r.blockUser || r.block);
            const busy = actionBusyId === r._id || otpSending;
            return (
              <Button
                size="small"
                variant="contained"
                color={blocked ? 'success' : 'error'}
                disabled={busy}
                onClick={() => void startBlockWithOtp(r)}
                sx={{ minWidth: 72, px: 1, fontSize: 11 }}
              >
                {blocked ? 'Unblock' : 'Block'}
              </Button>
            );
          },
        },
        {
          id: 'blockReason',
          label: (
            <>
              Block
              <br />
              Reason
            </>
          ),
          width: REASON_COL.width,
          headSx: REASON_COL.sx,
          cellSx: REASON_COL.sx,
          filter: null,
          render: (r) => String(r.blockUserReason || '-'),
        },
      );
    }

    return cols;
  }, [
    actionBusyId,
    blockCallerBusy,
    botId,
    canEditEmpCode,
    canEditSubAdminRole,
    canShowMobile,
    clientName,
    draft,
    hideContact,
    isCaller,
    itemsPerPage,
    locationBusyId,
    locationDraft,
    loginEmpCode,
    openRoleEdit,
    openSubEdit,
    otpSending,
    page,
    renderEmpCodeCell,
    renderUserName,
    search,
    setDraftField,
    showMobileColumn,
    startBlockCaller,
    startBlockWithOtp,
    updateSubAdminLocation,
    userType,
  ]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Users
      </Typography>

      <UsersToolbar
        startDate={startDate}
        endDate={endDate}
        userType={userType}
        typeOptions={typeOptions}
        itemsPerPage={itemsPerPage}
        uniqueUser={uniqueUser}
        clientName={clientName}
        playedIn={playedIn}
        botId={botId}
        campaignId={campaignId}
        globalCount={globalCount}
        total={total}
        loading={loading}
        dialerLoading={dialerLoading}
        showDates={showDates}
        canRegister={canRegister}
        canAddToBot={canAddToBot}
        canAddUserData={canAddUserData}
        canAddToDialer={canAddToDialer}
        canCreateUser={canCreateUser}
        canCreateAdmin={canCreateAdmin}
        isCaller={isCaller}
        onStartDate={setStartDate}
        onEndDate={setEndDate}
        onClearDates={() => {
          setStartDate('');
          setEndDate('');
        }}
        onApply={handleApply}
        onUserType={(v) => {
          setUserType(v);
          setPage(1);
        }}
        onItemsPerPage={(v) => {
          setItemsPerPage(v);
          setPage(1);
        }}
        onUniqueUser={(v) => {
          setUniqueUser(v);
          setPage(1);
        }}
        onClientName={(v) => {
          setClientName(v);
          setPage(1);
        }}
        onPlayedIn={(v) => {
          setPlayedIn(v);
          setPage(1);
        }}
        onBotId={setBotId}
        onCampaignId={setCampaignId}
        onRegister={() => setCreateMode('user')}
        onGlobalUser={() => {
          void loadGlobals().then((count) => {
            toast.info(`Global users: ${count}`);
          });
        }}
        onAddToBot={() => void handleAddToBot()}
        onAddUserData={() => setAddUserDataOpen(true)}
        onAddToDialer={() => void handleAddToDialer()}
        onCreateUser={() => setCreateMode('user')}
        onCreateAdmin={() => setCreateMode('admin')}
      />

      <CommonTable
        columns={columns}
        rows={tableRows}
        getRowKey={(row, i) => String(row._id || i)}
        loading={loading}
        emptyMessage="No users found"
        stickyHeader
        minWidth={
          userType === 'Sub_Admin'
            ? 1600
            : userType === 'Non_Performing_Active_User'
              ? 1000
              : userType === 'LAXMI_999_Users'
                ? 1800
                : userType === 'In_Active_Deposit'
                  ? 2000
                  : isCaller
                    ? 1500
                    : 2000
        }
        dense
      />

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
        />
      </Stack>

      <CreateUserDialog
        open={createMode !== null}
        mode={createMode || 'user'}
        onClose={() => setCreateMode(null)}
        onCreated={() => void load(page)}
      />

      <AddUserDataDialog
        open={addUserDataOpen}
        uploader={admin}
        onClose={() => setAddUserDataOpen(false)}
      />

      <Dialog open={Boolean(blockTarget)} onClose={closeBlockDialog}>
        <DialogTitle>
          {blockNextStatus ? 'Block' : 'Unblock'} user
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {otpSending
              ? 'Sending OTP to SuperAdmin…'
              : 'Enter OTP and remark to continue.'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required
            label="Please enter OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            inputMode="numeric"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            label="Please enter remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value.slice(0, MAX_REMARK))}
            inputProps={{ maxLength: MAX_REMARK }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={closeBlockDialog}>Cancel</Button>
          <Button
            variant="outlined"
            disabled={otpSending}
            onClick={() => void resendBlockOtp()}
          >
            Resend OTP
          </Button>
          <Button
            variant="contained"
            disabled={actionBusyId === blockTarget?._id || otpSending}
            onClick={() => void confirmBlock()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(dumpTarget)} onClose={() => setDumpTarget(null)}>
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            Are you sure you want to dump this user?
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Reason"
            variant="outlined"
            value={dumpReason}
            onChange={(e) => setDumpReason(e.target.value.slice(0, MAX_REMARK))}
            inputProps={{ maxLength: MAX_REMARK }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={() => setDumpTarget(null)}>
            No
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={actionBusyId === dumpTarget?._id}
            onClick={() => void confirmDump()}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(subEdit)}
        onClose={() => !subEditBusy && setSubEdit(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Edit{' '}
          {subEdit?.type === 'name'
            ? 'Name'
            : subEdit?.type === 'mobile'
              ? 'Mobile'
              : subEdit?.type === 'empCode'
                ? 'Emp Code'
                : 'Telegram ID'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={
              subEdit?.type === 'name'
                ? 'Name'
                : subEdit?.type === 'mobile'
                  ? 'Mobile'
                  : subEdit?.type === 'empCode'
                    ? 'Emp Code'
                    : 'Telegram Username'
            }
            value={subEditValue}
            onChange={(e) => setSubEditValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubEdit(null)} disabled={subEditBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={subEditBusy}
            onClick={() => void submitSubEdit()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {subEditBusy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(roleEditId)}
        onClose={() => !roleEditBusy && setRoleEditId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Role"
            value={roleEditValue}
            onChange={(e) => setRoleEditValue(e.target.value)}
            sx={{ mt: 1 }}
          >
            {roleOptions.map((role) => (
              <MenuItem key={role._id} value={role._id}>
                {role.Name || role.name || role._id}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleEditId(null)} disabled={roleEditBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={roleEditBusy}
            onClick={() => void submitRoleEdit()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {roleEditBusy ? 'Saving…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(realNameTargetId)}
        onClose={() => !realNameBusy && setRealNameTargetId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Real Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Real Name"
            value={realNameValue}
            onChange={(e) => setRealNameValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRealNameTargetId(null)}
            disabled={realNameBusy}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={realNameBusy}
            onClick={() => void submitRealName()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {realNameBusy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(blockCallerTarget)}
        onClose={() => !blockCallerBusy && setBlockCallerTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {blockCallerNext ? 'Block Caller' : 'Un Block Caller'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="OTP"
            value={blockCallerOtp}
            onChange={(e) =>
              setBlockCallerOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Remark"
            value={blockCallerRemark}
            onChange={(e) =>
              setBlockCallerRemark(e.target.value.slice(0, MAX_REMARK))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBlockCallerTarget(null)}
            disabled={blockCallerBusy}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={blockCallerBusy}
            onClick={() => void confirmBlockCaller()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {blockCallerBusy ? 'Saving…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
