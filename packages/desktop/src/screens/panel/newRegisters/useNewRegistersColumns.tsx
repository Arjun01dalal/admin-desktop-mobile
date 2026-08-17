import { useMemo } from 'react';
import { Badge, Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Link as RouterLink } from 'react-router-dom';
import { hasPermission } from '@/auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { type CommonTableColumn } from '@/components/CommonTable';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import { CompactDpId } from '@/screens/panel/users/FilterControls';
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
  pickBalance,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
  pickUserComesFrom,
} from './utils';

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

const iconActionSx = {
  p: 0.35,
  border: '1px solid',
  borderRadius: 1,
} as const;


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
  onBlock: (row: UserRow) => void;
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
  onBlock,
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
        // Sticky cells lock maxWidth — keep room for full ObjectId + copy icon.
        width: 252,
        stickyLeft: true,
        filter: <DpIdFilter />,
        headSx: { px: 0.75, overflow: 'hidden' },
        cellSx: {
          px: 0.75,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          verticalAlign: 'middle',
        },
        render: (row) => <CompactDpId value={String(row._id || '')} />,
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
        width: 120,
        filter: <UserComesFromFilter />,
        cellSx: {
          minWidth: 110,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          fontSize: 12,
          overflow: 'visible',
        },
        // Laxmi: User?.userComesFrom ?? "Company"
        render: (row) => pickUserComesFrom(row),
      },
      {
        id: 'balance',
        label: 'Balance',
        width: 100,
        align: 'right',
        filter: <BalanceFilter />,
        cellSx: {
          minWidth: 90,
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          overflow: 'visible',
        },
        // Laxmi: Math.floor(User?.balance)
        render: (row) => {
          const n = pickBalance(row);
          return n == null ? '-' : Math.floor(n).toLocaleString('en-IN');
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
              onClick={() => void onBlock(row)}
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
        width: 72,
        filter: null,
        cellSx: { whiteSpace: 'nowrap', overflow: 'hidden', verticalAlign: 'middle' },
        render: (row) => {
          const count = registrationComments(row).length;
          return (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={0.35}
            >
              <Tooltip title="Add Comment">
                <IconButton
                  size="small"
                  aria-label="Add Comment"
                  onClick={() => onAddComment(row)}
                  sx={{
                    ...iconActionSx,
                    color: '#1a1200',
                    borderColor: '#f1a144',
                    bgcolor: '#ff9f0a',
                    '&:hover': { bgcolor: '#e09030' },
                  }}
                >
                  <ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={count > 0 ? `View All (${count})` : 'View All'}>
                <IconButton
                  size="small"
                  aria-label="View All Comments"
                  onClick={() => onViewComments(row)}
                  sx={{
                    ...iconActionSx,
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary' },
                  }}
                >
                  <Badge
                    badgeContent={count || undefined}
                    color="warning"
                    max={99}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: 9,
                        height: 14,
                        minWidth: 14,
                        px: 0.4,
                      },
                    }}
                  >
                    <RateReviewOutlinedIcon sx={{ fontSize: 15 }} />
                  </Badge>
                </IconButton>
              </Tooltip>
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
        width: 88,
        filter: null,
        cellSx: { whiteSpace: 'nowrap', overflow: 'hidden', verticalAlign: 'middle' },
        render: (row) => {
          const logs = registrationCallLogs(row);
          const count = logs.length;
          const latest = count > 0 ? logs[count - 1] : null;
          const lastLabel =
            count > 0 ? `Last: ${latest?.who?.userName || '-'}` : 'No calls yet';
          return (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={0.4}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                title={lastLabel}
                sx={{
                  fontSize: 10,
                  lineHeight: 1.1,
                  maxWidth: 42,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {count > 0 ? latest?.who?.userName || '-' : '—'}
              </Typography>
              <Tooltip title={count > 0 ? `View Logs (${count})` : 'View Logs'}>
                <IconButton
                  size="small"
                  aria-label="View Call Logs"
                  onClick={() => onViewCallLogs(row)}
                  sx={{
                    ...iconActionSx,
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary' },
                  }}
                >
                  <Badge
                    badgeContent={count || undefined}
                    color="warning"
                    max={99}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: 9,
                        height: 14,
                        minWidth: 14,
                        px: 0.4,
                      },
                    }}
                  >
                    <VisibilityIcon sx={{ fontSize: 15 }} />
                  </Badge>
                </IconButton>
              </Tooltip>
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
    onBlock,
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
