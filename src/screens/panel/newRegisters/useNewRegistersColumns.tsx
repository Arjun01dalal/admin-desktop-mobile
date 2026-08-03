import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@mui/material';
import { hasPermission } from '@/auth/permissions';
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { CopyText, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { maskMobile } from '@/screens/panel/shared';
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
import type { UserRow } from './types';
import {
  formatAadharAddress,
  nestedDpId,
  nestedName,
  pickAadharNumber,
  pickAccountNumber,
  pickAppName,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
} from './utils';

/** Columns hidden from caller / caller_new roles. */
const CALLER_HIDDEN_COLUMN_IDS = new Set([
  'mobile',
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

export type UseNewRegistersColumnsParams = {
  page: number;
  itemsPerPage: number;
  setBlockTarget: Dispatch<SetStateAction<UserRow | null>>;
  isCaller?: boolean;
};

export function useNewRegistersColumns({
  page,
  itemsPerPage,
  setBlockTarget,
  isCaller = false,
}: UseNewRegistersColumnsParams): CommonTableColumn<UserRow>[] {
  const rowOffset = (page - 1) * itemsPerPage;
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  return useMemo<CommonTableColumn<UserRow>[]>(() => {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        align: 'center',
        filter: null,
        render: (_row, index) => rowOffset + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: <NameFilter />,
        render: (row) => String(row.name || '-'),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        filter: <DpIdFilter />,
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
        filter: <UserComesFromFilter />,
        render: (row) => String(row.userComesFrom || 'Company'),
      },
      {
        id: 'balance',
        label: 'Balance',
        align: 'right',
        filter: <BalanceFilter />,
        render: (row) => formatAmount(Math.floor(Number(row.balance) || 0)),
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
        filter: <EmptyRecordFilter />,
        render: (row) => pickLastActivity(row),
      },
      {
        id: 'userBankName',
        label: (
          <>
            User Bank
            <br />
            Name
          </>
        ),
        filter: null,
        render: (row) => pickUserBankName(row),
      },
      {
        id: 'appName',
        label: (
          <>
            App
            <br />
            Code
          </>
        ),
        filter: <AppNameFilter />,
        render: (row) => appCodeForName(pickAppName(row)),
      },
      {
        id: 'playIn',
        label: 'In',
        filter: <PlayInFilter />,
        render: (row) => pickPlayIn(row),
      },
      {
        id: 'encryptedDpId',
        label: (
          <>
            User Encrypted
            <br />
            Dp Id
          </>
        ),
        filter: null,
        render: (row) => String(row.encryptedUserName || '-'),
      },
      {
        id: 'mobile',
        label: (
          <>
            Mobile
            <br />
            Phone
          </>
        ),
        filter: canShowMobile ? <MobileFilter /> : null,
        render: (row) => {
          const mob = String(row.mobile || '');
          if (!canShowMobile) return maskMobile(mob, false);
          return mob ? <CopyText value={mob} /> : '—';
        },
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
        filter: <CityFilter />,
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
            User App
            <br />
            Version
          </>
        ),
        filter: null,
        render: (row) => String(row.currentAppVersion || '-'),
      },
      {
        id: 'appVersion',
        label: (
          <>
            App
            <br />
            Version
          </>
        ),
        filter: null,
        render: () => '-',
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
            Free Points
            <br />
            Bonus
          </>
        ),
        align: 'right',
        filter: null,
        render: (row) => formatAmount(row.bonusWalletBalance),
      },
      {
        id: 'action',
        label: 'Action',
        filter: null,
        render: (row) => {
          const blocked = Boolean(row.blockUser || row.block);
          return (
            <Button size="small" onClick={() => setBlockTarget(row)}>
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
        render: (row) => String(row.blockUserReason || '-'),
      },
      {
        id: 'aadharAddress',
        label: 'Aadhar Address',
        width: 280,
        cellSx: { whiteSpace: 'normal', minWidth: 260 },
        filter: null,
        render: (row) => formatAadharAddress(row),
      },
    ];

    if (!isCaller) return cols;
    return cols.filter((col) => !CALLER_HIDDEN_COLUMN_IDS.has(col.id));
  }, [rowOffset, setBlockTarget, isCaller, canShowMobile]);
}
