import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@mui/material';
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { CopyText, type CommonTableColumn } from '@/components/CommonTable';
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
import { formatAadharAddress, nestedDpId, nestedName } from './utils';

export type UseNewRegistersColumnsParams = {
  page: number;
  itemsPerPage: number;
  setBlockTarget: Dispatch<SetStateAction<UserRow | null>>;
};

export function useNewRegistersColumns({
  page,
  itemsPerPage,
  setBlockTarget,
}: UseNewRegistersColumnsParams): CommonTableColumn<UserRow>[] {
  const rowOffset = (page - 1) * itemsPerPage;

  return useMemo<CommonTableColumn<UserRow>[]>(
    () => [
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
        render: (row) => Math.floor(Number(row.balance) || 0),
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
        render: (row) =>
          row.activeUser
            ? `${formatDisplayDate(row.activeUser)} | ${formatDisplayTime(row.activeUser)}`
            : '',
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
        render: (row) => String(row.userBankName || '-'),
      },
      {
        id: 'appName',
        label: (
          <>
            App
            <br />
            Name
          </>
        ),
        filter: <AppNameFilter />,
        render: (row) => String(row.clientName || '-'),
      },
      {
        id: 'playIn',
        label: 'Play In',
        filter: <PlayInFilter />,
        render: (row) => String(row.played || '-'),
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
        filter: <MobileFilter />,
        render: (row) => {
          const mob = String(row.mobile || '');
          return mob ? <CopyText value={mob} /> : '—';
        },
      },
      {
        id: 'kyc',
        label: 'Kyc',
        filter: <AccNoFilter />,
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
        filter: null,
        render: (row) => String(row.accountNumber || '-'),
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
        render: (row) => String(row.aadhaarNumber || '-'),
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
            Player App
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
            Bonus
            <br />
            Balance
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
    ],
    [rowOffset, setBlockTarget],
  );
}
