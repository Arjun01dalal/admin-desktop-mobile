import {
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { type CommonTableColumn } from '@/components/CommonTable';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { BLOCK_STATUS_OPTIONS, type UserType } from './constants';
import {
  CompactDpId,
  DateRangeFilter,
  FilterInput,
  StateMultiFilter,
} from './FilterControls';
import { CallingBtn } from './CallingBtn';
import {
  INDEX_COL,
  NAME_COL,
  DP_ID_COL,
  BANK_COL,
  APP_COL,
  EMP_COL,
  PLAY_COL,
  MOBILE_COL,
  KYC_COL,
  ACCOUNT_COL,
  AADHAR_COL,
  EMAIL_COL,
  CITY_COL,
  STATE_COL,
  CALLER_COL,
  AMOUNT_COL,
  DATETIME_COL,
  REASON_COL,
  NAME_COL_WIDTH,
  NAME_COL_SX,
  DP_ID_COL_WIDTH,
  DP_ID_COL_SX,
  STATE_COL_WIDTH,
  STATE_COL_SX,
  CITY_COL_WIDTH,
  CITY_COL_SX,
  DATETIME_COL_WIDTH,
  DATETIME_COL_SX,
} from './columnLayout';
import { SUBADMIN_LOCATIONS } from './usersHelpers';
import { reasonForUserType } from './toolbarHelpers';
import {
  nestedCallerName,
  pickAccountNumber,
  pickAadharNumber,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
  type UserFilters,
  type UserRow,
} from './utils';

/** Icon CTAs for Sub_Admin Location / Action columns. */
const subAdminIconBtnSx = {
  bgcolor: '#f1a144',
  color: '#111',
  width: 32,
  height: 32,
  borderRadius: 1.5,
  '&:hover': { bgcolor: '#e09030' },
  '&.Mui-disabled': { bgcolor: '#f7d2a8', color: '#666' },
};

const subAdminSelectSx = {
  width: '100%',
  minWidth: 120,
  '& .MuiInputBase-root': {
    fontSize: 12,
    bgcolor: 'background.paper',
    color: 'text.primary',
    borderRadius: 1.5,
    minHeight: 32,
  },
  '& .MuiInputBase-input': {
    color: 'text.primary',
    WebkitTextFillColor: 'currentColor',
    py: 0.75,
  },
  '& .MuiSelect-icon': { color: 'text.secondary' },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#f1a144',
  },
};

export type UseUsersColumnsParams = {
  userType: UserType;
  page: number;
  itemsPerPage: number;
  draft: UserFilters;
  setDraft: Dispatch<SetStateAction<UserFilters>>;
  setDraftField: (key: keyof UserFilters) => (value: string) => void;
  search: () => void;
  clientName: string;
  setClientName: (v: string) => void;
  setPage: (p: number) => void;
  botId: string;
  canShowMobile: boolean;
  showMobileColumn: boolean;
  hideContact: boolean;
  isCaller: boolean;
  loginEmpCode: string;
  actionBusyId: string;
  otpSending: boolean;
  blockCallerBusy: boolean;
  canEditSubAdminRole: boolean;
  locationDraft: Record<string, string>;
  setLocationDraft: Dispatch<SetStateAction<Record<string, string>>>;
  locationBusyId: string;
  renderUserName: (r: { _id?: string; name?: string }) => ReactNode;
  renderEmpCodeCell: (r: UserRow) => ReactNode;
  openSubEdit: (id: string, type: 'name' | 'mobile' | 'telegram' | 'empCode', current?: string) => void;
  openRoleEdit: (row: UserRow) => void;
  updateSubAdminLocation: (row: UserRow) => void;
  startBlockCaller: (row: UserRow) => void;
  openRealName: (row: UserRow) => void;
  startBlockWithOtp: (row: UserRow) => void;
  openDump: (row: UserRow) => void;
};

export function useUsersColumns(p: UseUsersColumnsParams) {
  const {
    userType,
    page,
    itemsPerPage,
    draft,
    setDraft,
    setDraftField,
    search,
    clientName,
    setClientName,
    setPage,
    botId,
    canShowMobile,
    showMobileColumn,
    hideContact,
    isCaller,
    loginEmpCode,
    actionBusyId,
    otpSending,
    blockCallerBusy,
    canEditSubAdminRole,
    locationDraft,
    setLocationDraft,
    locationBusyId,
    renderUserName,
    renderEmpCodeCell,
    openSubEdit,
    openRoleEdit,
    updateSubAdminLocation,
    startBlockCaller,
    openRealName,
    startBlockWithOtp,
    openDump,
  } = p;

  return useMemo<CommonTableColumn<UserRow>[]>(() => {
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
            {canShowMobile
              ? String(r.mobile || '-')
              : r.mobile
                ? '**********'
                : '-'}
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
      width: 168,
      filter: null,
      render: (r) => {
        const current =
          locationDraft[r._id] ??
          String(r.officeLocation || r.location || '');
        const busy = locationBusyId === r._id;
        return (
          <Stack
            spacing={0.75}
            alignItems="stretch"
            sx={{ py: 0.75, width: 148, mx: 'auto' }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.3,
                textAlign: 'left',
              }}
            >
              {String(r.officeLocation || '—')}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TextField
                select
                size="small"
                value={current}
                onChange={(e) =>
                  setLocationDraft((prev) => ({
                    ...prev,
                    [r._id]: e.target.value,
                  }))
                }
                sx={{ ...subAdminSelectSx, flex: 1, minWidth: 0 }}
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
              <Tooltip title={busy ? 'Updating…' : 'Update Location'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={busy}
                    onClick={() => void updateSubAdminLocation(r)}
                    sx={subAdminIconBtnSx}
                    aria-label="Update Location"
                  >
                    {busy ? (
                      <CircularProgress size={14} sx={{ color: '#111' }} />
                    ) : (
                      <SaveOutlinedIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        );
      },
    },
    {
      id: 'action',
      label: 'Action',
      width: 96,
      filter: null,
      render: (r) => {
        const blocked = r.block === true;
        return (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="center"
            sx={{ py: 0.75 }}
          >
            <Tooltip title={blocked ? 'Unblock Caller' : 'Block Caller'}>
              <span>
                <IconButton
                  size="small"
                  disabled={blockCallerBusy}
                  onClick={() => void startBlockCaller(r)}
                  sx={subAdminIconBtnSx}
                  aria-label={blocked ? 'Unblock Caller' : 'Block Caller'}
                >
                  {blocked ? (
                    <LockOpenIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <BlockIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Add Real Name">
              <IconButton
                size="small"
                onClick={() => openRealName(r)}
                sx={subAdminIconBtnSx}
                aria-label="Add Real Name"
              >
                <BadgeOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
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
          hideBotCall
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
      filter: !isCaller && canShowMobile ? (
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
          hideBotCall
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
          hideBotCall
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
    cols.push({
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
    });
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
          userType === 'Active_User') && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Button
              size="small"
              variant="contained"
              disabled={actionBusyId === r._id}
              onClick={() => openDump(r)}
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
            {!isCaller && (
              <IconButton
                size="small"
                disabled={actionBusyId === r._id || otpSending}
                onClick={() => void startBlockWithOtp(r)}
                title={Boolean(r.blockUser || r.block) ? 'Unblock' : 'Block'}
                aria-label={
                  Boolean(r.blockUser || r.block) ? 'Unblock user' : 'Block user'
                }
                sx={{
                  p: 0.35,
                  color: Boolean(r.blockUser || r.block)
                    ? 'success.main'
                    : 'error.main',
                  border: '1px solid',
                  borderColor: Boolean(r.blockUser || r.block)
                    ? 'success.main'
                    : 'error.main',
                  borderRadius: 1,
                  bgcolor: Boolean(r.blockUser || r.block)
                    ? 'rgba(46,125,50,0.12)'
                    : 'rgba(211,47,47,0.12)',
                  '&:hover': {
                    bgcolor: Boolean(r.blockUser || r.block)
                      ? 'rgba(46,125,50,0.22)'
                      : 'rgba(211,47,47,0.22)',
                  },
                }}
              >
                {Boolean(r.blockUser || r.block) ? (
                  <LockOpenIcon sx={{ fontSize: 16 }} />
                ) : (
                  <BlockIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            )}
          </Stack>
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
    filter: !isCaller && canShowMobile ? (
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
        hideBotCall
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

// Caller panel: hide Block Reason
if (
  !isCaller &&
  (userType === 'User' || userType === 'Todays_Active')
) {
  cols.push({
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
    render: (r) => String(r.blockUserReason || '-'),
  });
}

return cols;

  }, [
    actionBusyId,
    blockCallerBusy,
    botId,
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
    openDump,
    openRealName,
    openRoleEdit,
    openSubEdit,
    otpSending,
    page,
    renderEmpCodeCell,
    renderUserName,
    search,
    setClientName,
    setDraft,
    setDraftField,
    setLocationDraft,
    setPage,
    showMobileColumn,
    startBlockCaller,
    startBlockWithOtp,
    updateSubAdminLocation,
    userType,
  ]);
}
