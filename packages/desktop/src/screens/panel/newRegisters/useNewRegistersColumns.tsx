import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Link as RouterLink } from 'react-router-dom';
import { hasPermission } from '@/auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { CopyText, type CommonTableColumn } from '@/components/CommonTable';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import {
  AadharFilter,
  AccNoFilter,
  AppNameFilter,
  BalanceFilter,
  CityFilter,
  DpIdFilter,
  EmailFilter,
  EmptyRecordFilter,
  MobileFilter,
  NameFilter,
  PlayInFilter,
  ReferralCodeFilter,
  ReferredFilter,
  StateFilter,
  UserComesFromFilter,
} from './ColumnFilters';
import type {
  RegistrationCallLog,
  RegistrationComment,
  UserRow,
} from './types';
import {
  nestedDpId,
  nestedName,
  pickAadharNumber,
  pickAccountNumber,
  pickAppName,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
} from './utils';

const actionStackSx = {
  minWidth: 118,
  py: 0.25,
  gap: 0.75,
};

const actionBtnSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  borderRadius: 1,
  px: 1.25,
  py: 0.5,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.2,
  textTransform: 'none' as const,
  minWidth: 0,
  whiteSpace: 'nowrap',
  boxShadow: 'none',
  '&:hover': { boxShadow: 'none' },
  '& .MuiButton-startIcon': { mr: 0.5, ml: 0 },
  '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: 14 },
};


function AadharAddressCell({ row }: { row: UserRow }) {
  const addr = (row.aadharAddress ||
    (row as { aadhaarAddress?: Record<string, unknown> }).aadhaarAddress ||
    {}) as Record<string, unknown>;
  if (!row.kyc || !Object.keys(addr).length) return <>{'-'}</>;

  const line = (label: string, key: string) =>
    addr[key] != null && String(addr[key]).trim() !== '' ? (
      <Typography
        key={key}
        component="span"
        variant="caption"
        sx={{ display: 'inline', mr: 1, fontSize: 12 }}
      >
        {label} : <strong>{String(addr[key])}</strong>
      </Typography>
    ) : null;

  return (
    <Box sx={{ textAlign: 'left', lineHeight: 1.45, py: 0.5, minWidth: 220 }}>
      <Box>
        {line('Country', 'country')}
        {line('Dist', 'dist')}
        {line('House', 'house')}
      </Box>
      <Box>
        {line('Landmark', 'landmark')}
        {line('Loc', 'loc')}
      </Box>
      <Box>
        {line('Po', 'po')}
        {line('State', 'state')}
        {line('Street', 'street')}
        {line('Subdist', 'subdist')}
        {line('Vtc', 'vtc')}
        {line('Pin', 'pin')}
      </Box>
    </Box>
  );
}

/**
 * Sensitive columns hidden for caller / caller_new roles.
 * Comment, Call Logs, and Mobile+Call stay visible (Laxmi New Registers parity).
 */
const CALLER_HIDDEN_COLUMN_IDS = new Set([
  'userBankName',
  'accountNumber',
  'aadharNumber',
  'email',
  'previousCallerName',
  'previousCallerDpId',
  'currentCaller',
  'referredCode',
  'referralCode',
  'action',
  'blockReason',
  'aadharAddress',
  'kyc',
]);

export function registrationComments(row: UserRow): RegistrationComment[] {
  const raw =
    row.newRegistrationComments || row.registrationComments || row.comments || [];
  return Array.isArray(raw) ? raw : [];
}

export function registrationCallLogs(row: UserRow): RegistrationCallLog[] {
  const raw = row.callLogsForNewRegistration || row.callLogs || [];
  return Array.isArray(raw) ? raw : [];
}

export type UseNewRegistersColumnsParams = {
  page: number;
  itemsPerPage: number;
  setBlockTarget: Dispatch<SetStateAction<UserRow | null>>;
  isCaller?: boolean;
  appVersions?: Record<string, string>;
  onAddComment: (row: UserRow) => void;
  onViewComments: (row: UserRow) => void;
  onViewCallLogs: (row: UserRow) => void;
  onCallSuccess?: () => void;
};

export function useNewRegistersColumns({
  page,
  itemsPerPage,
  setBlockTarget,
  isCaller = false,
  appVersions = {},
  onAddComment,
  onViewComments,
  onViewCallLogs,
  onCallSuccess,
}: UseNewRegistersColumnsParams): CommonTableColumn<UserRow>[] {
  const rowOffset = (page - 1) * itemsPerPage;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const canBlock = hasPermission('withdrawals_button');

  return useMemo<CommonTableColumn<UserRow>[]>(() => {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        align: 'center',
        stickyLeft: true,
        filter: null,
        render: (_row, index) => rowOffset + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: 140,
        stickyLeft: true,
        filter: <NameFilter />,
        render: (row) => {
          const name = String(row.name || '-');
          if (!row._id || name === '-') return name;
          return (
            <Typography
              component={RouterLink}
              to={`/users/report/${row._id}/${encodeURIComponent(name)}`}
              variant="body2"
              sx={{ color: 'warning.main', fontWeight: 600, textDecoration: 'none' }}
            >
              {name}
            </Typography>
          );
        },
      },
      {
        id: 'dpId',
        label: 'DP ID',
        width: 260,
        stickyLeft: true,
        filter: <DpIdFilter />,
        cellSx: {
          whiteSpace: 'nowrap',
          fontSize: 12,
          letterSpacing: 0,
        },
        render: (row) => <CopyText value={String(row._id || '')} />,
      },
      {
        id: 'userComesFrom',
        label: (
          <>
            User Comes
            <br />
            From
          </>
        ),
        width: 88,
        headSx: { maxWidth: 88, width: 88 },
        filter: <UserComesFromFilter />,
        cellSx: {
          maxWidth: 88,
          width: 88,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          fontSize: 12,
        },
        render: (row) => String(row.userComesFrom || '-'),
      },
      {
        id: 'balance',
        label: 'Balance',
        width: 72,
        align: 'right',
        headSx: { maxWidth: 72, width: 72 },
        filter: <BalanceFilter />,
        cellSx: { maxWidth: 72, width: 72, fontSize: 12 },
        render: (row) => {
          const n = Number(row.balance);
          return Number.isFinite(n) ? Math.floor(n) : '-';
        },
      },
      {
        id: 'lastActivity',
        label: (
          <>
            Last <br /> Activity
          </>
        ),
        width: 100,
        headSx: { maxWidth: 100, width: 100 },
        filter: <EmptyRecordFilter />,
        cellSx: {
          maxWidth: 100,
          width: 100,
          whiteSpace: 'normal',
          lineHeight: 1.25,
          fontSize: 11,
        },
        render: (row) => {
          const v = pickLastActivity(row);
          return v === '-' ? '' : v;
        },
      },
      {
        id: 'userBankName',
        label: (
          <>
            User Bank <br /> Name
          </>
        ),
        filter: null,
        render: (row) => pickUserBankName(row),
      },
      {
        id: 'appName',
        label: (
          <>
            App <br /> Name
          </>
        ),
        filter: <AppNameFilter />,
        render: (row) => String(pickAppName(row) || '-'),
      },
      {
        id: 'playIn',
        label: 'Play In',
        filter: <PlayInFilter />,
        render: (row) => pickPlayIn(row),
      },
      {
        id: 'encryptedDpId',
        label: (
          <>
            User Encrypted <br /> Dp Id
          </>
        ),
        filter: null,
        render: (row) => String(row.encryptedUserName || '-'),
      },
      {
        id: 'mobile',
        label: (
          <>
            Mobile <br /> Phone
          </>
        ),
        width: 150,
        filter: canShowMobile ? <MobileFilter /> : null,
        cellSx: { whiteSpace: 'normal', overflow: 'visible' },
        // Always show CallingBtn (Call dialer). Number masking is inside the button.
        render: (row) => (
          <CallingBtn
            item={row as never}
            campaignName="OM south"
            hideBotCall
            isNewRegistration
            onSuccess={onCallSuccess}
          />
        ),
      },
      {
        id: 'kyc',
        label: 'Kyc',
        filter: null,
        render: (row) => (row.kyc === true ? 'Done' : 'Not Done'),
      },
      {
        id: 'accountNumber',
        label: (
          <>
            Account
            <br />
            Number
          </>
        ),
        filter: <AccNoFilter />,
        render: (row) => pickAccountNumber(row),
      },
      {
        id: 'aadharNumber',
        label: (
          <>
            Aadhar
            <br />
            Number
          </>
        ),
        filter: <AadharFilter />,
        render: (row) => pickAadharNumber(row),
      },
      {
        id: 'email',
        label: 'Email',
        filter: <EmailFilter />,
        render: (row) => String(row.email || '-'),
      },
      {
        id: 'city',
        label: 'City',
        width: 80,
        headSx: { maxWidth: 80, width: 80 },
        filter: <CityFilter />,
        cellSx: {
          maxWidth: 80,
          width: 80,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          fontSize: 12,
        },
        render: (row) => String(row.city || '-'),
      },
      {
        id: 'state',
        label: 'State',
        filter: <StateFilter />,
        render: (row) => String(row.state || '-'),
      },
      {
        id: 'previousCallerName',
        label: (
          <>
            Previous Caller
            <br />
            Name
          </>
        ),
        filter: null,
        render: (row) => nestedName(row.previousCaller),
      },
      {
        id: 'previousCallerDpId',
        label: (
          <>
            Previous Caller
            <br />
            Dp_ID
          </>
        ),
        filter: null,
        render: (row) => nestedDpId(row.previousCaller),
      },
      {
        id: 'empCode',
        label: 'Employee Code',
        filter: null,
        render: (row) => String(row.empCode || '-'),
      },
      {
        id: 'currentCaller',
        label: (
          <>
            Current
            <br />
            Caller
          </>
        ),
        filter: <ReferredFilter />,
        render: (row) => nestedName(row.currentCaller),
      },
      {
        id: 'referredCode',
        label: (
          <>
            Referred
            <br />
            Referral Code
          </>
        ),
        filter: <ReferralCodeFilter />,
        render: (row) => String(row.referredCode || '-'),
      },
      {
        id: 'referralCode',
        label: (
          <>
            Referral
            <br />
            Code
          </>
        ),
        filter: null,
        render: (row) => String(row.referralCodeUser || '-'),
      },
      {
        id: 'deviceType',
        label: (
          <>
            Device
            <br />
            Type
          </>
        ),
        filter: null,
        render: (row) => String(row.deviceType || '-'),
      },
      {
        id: 'playerAppVersion',
        label: (
          <>
            Player App <br /> Version
          </>
        ),
        filter: null,
        render: (row) => String(row.currentAppVersion || '-'),
      },
      {
        id: 'appVersion',
        label: (
          <>
            App <br /> Version
          </>
        ),
        filter: null,
        render: (row) => {
          const name = String(row.clientName || pickAppName(row) || '');
          return name ? String(appVersions[name] || '') : '';
        },
      },
      {
        id: 'created',
        label: 'Created',
        filter: null,
        render: (row) => formatDisplayDate(row.createdOn || row.createdAt) || '-',
      },
      {
        id: 'time',
        label: 'Time',
        filter: null,
        render: (row) => formatDisplayTime(row.createdOn || row.createdAt) || '-',
      },
      {
        id: 'bonusBalance',
        label: (
          <>
            Bonus <br /> Balance
          </>
        ),
        align: 'right',
        filter: null,
        render: (row) => {
          const n = Number(row.bonusWalletBalance);
          return Number.isFinite(n) ? n : '-';
        },
      },
      {
        id: 'action',
        label: 'Action',
        width: 100,
        filter: null,
        cellSx: { whiteSpace: 'normal', overflow: 'visible', verticalAlign: 'middle' },
        render: (row) => {
          if (!canBlock) return '';
          const blocked = Boolean(row.blockUser || row.block);
          return (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => setBlockTarget(row)}
              sx={actionBtnSx}
            >
              {blocked ? 'Un Block' : 'Block'}
            </Button>
          );
        },
      },
      {
        id: 'comments',
        label: (
          <>
            Add <br /> Comment
          </>
        ),
        width: 132,
        filter: null,
        cellSx: { whiteSpace: 'normal', overflow: 'visible', verticalAlign: 'middle' },
        render: (row) => {
          const count = registrationComments(row).length;
          return (
            <Stack alignItems="stretch" sx={actionStackSx}>
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<ChatBubbleOutlineIcon />}
                onClick={() => onAddComment(row)}
                sx={actionBtnSx}
              >
                Comment
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<VisibilityIcon />}
                onClick={() => onViewComments(row)}
                sx={{
                  ...actionBtnSx,
                  borderColor: 'divider',
                  color: 'text.primary',
                  bgcolor: 'transparent',
                  '&:hover': {
                    borderColor: 'text.secondary',
                    bgcolor: 'action.hover',
                    boxShadow: 'none',
                  },
                }}
              >
                View All{count > 0 ? ` (${count})` : ''}
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'callLogs',
        label: (
          <>
            Call <br /> Logs
          </>
        ),
        width: 132,
        filter: null,
        cellSx: { whiteSpace: 'normal', overflow: 'visible', verticalAlign: 'middle' },
        render: (row) => {
          const logs = registrationCallLogs(row);
          const count = logs.length;
          const latest = count > 0 ? logs[count - 1] : null;
          return (
            <Stack alignItems="stretch" sx={actionStackSx}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', fontSize: 11, lineHeight: 1.3 }}
              >
                {count > 0
                  ? `Last: ${latest?.who?.userName || '-'}`
                  : 'No calls yet'}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<VisibilityIcon />}
                onClick={() => onViewCallLogs(row)}
                sx={{
                  ...actionBtnSx,
                  borderColor: 'divider',
                  color: 'text.primary',
                  bgcolor: 'transparent',
                  '&:hover': {
                    borderColor: 'text.secondary',
                    bgcolor: 'action.hover',
                    boxShadow: 'none',
                  },
                }}
              >
                View Logs{count > 0 ? ` (${count})` : ''}
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'blockReason',
        label: (
          <>
            Block User <br /> Reason
          </>
        ),
        filter: null,
        render: (row) => String(row.blockUserReason || ''),
      },
      {
        id: 'aadharAddress',
        label: 'Aadhar Address',
        width: 280,
        cellSx: { whiteSpace: 'normal', minWidth: 260, overflow: 'visible' },
        filter: null,
        render: (row) => <AadharAddressCell row={row} />,
      },
    ];

    if (!isCaller) return cols;
    return cols.filter((col) => !CALLER_HIDDEN_COLUMN_IDS.has(col.id));
  }, [
    rowOffset,
    setBlockTarget,
    isCaller,
    canShowMobile,
    canBlock,
    appVersions,
    onAddComment,
    onViewComments,
    onViewCallLogs,
    onCallSuccess,
  ]);
}
