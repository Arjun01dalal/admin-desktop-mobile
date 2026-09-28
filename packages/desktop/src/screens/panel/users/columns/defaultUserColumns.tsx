import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { Button, IconButton, MenuItem, Stack, TextField } from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import BlockIcon from '@mui/icons-material/Block';

import { INDEX_COL, NAME_COL, DP_ID_COL, BANK_COL, APP_COL, EMP_COL, PLAY_COL, MOBILE_COL, KYC_COL, ACCOUNT_COL, AADHAR_COL, EMAIL_COL, CITY_COL, STATE_COL, CALLER_COL, AMOUNT_COL, DATETIME_COL, REASON_COL } from '../columnLayout';
import { nestedCallerName, pickAccountNumber, pickAadharNumber, pickLastActivity, pickPlayIn, pickUserBankName, type UserRow } from '../utils';
import { CompactDpId, FilterInput, StateMultiFilter } from '../FilterControls';
import { BLOCK_STATUS_OPTIONS, PLAY_IN_OPTIONS } from '../constants';
import { reasonForUserType } from '../toolbarHelpers';
import type { UsersColumnContext } from './context';
import { CallingBtn } from '../CallingBtn';

export function buildDefaultUserColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: INDEX_COL.width,
        headSx: INDEX_COL.sx,
        cellSx: INDEX_COL.sx,
        filter: null,
        render: (_r, i) => (ctx.page - 1) * ctx.itemsPerPage + i + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: NAME_COL.width,
        headSx: NAME_COL.sx,
        cellSx: NAME_COL.sx,
        filter: (
          <FilterInput
            value={ctx.draft.name}
            onChange={ctx.setDraftField('name')}
            onSearch={ctx.search}
            placeholder="Name"
            compact
          />
        ),
        render: (r) => (
          <Stack spacing={0.5} alignItems="center" sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            {ctx.renderUserName(r)}
            {(ctx.userType === 'User' ||
              ctx.userType === 'Non_Performing_User' ||
              ctx.userType === 'Todays_Active' ||
              ctx.userType === 'Active_User') && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button
                  size="small"
                  variant="contained"
                  disabled={ctx.actionBusyId === r._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.openDump(r);
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
                {!ctx.isCaller && (
                  <IconButton
                    size="small"
                    disabled={ctx.actionBusyId === r._id || ctx.otpSending}
                    onClick={() => void ctx.startBlockWithOtp(r)}
                    title={r.blockUser || r.block ? 'Unblock' : 'Block'}
                    aria-label={r.blockUser || r.block ? 'Unblock user' : 'Block user'}
                    sx={{
                      p: 0.35,
                      color: r.blockUser || r.block ? 'success.main' : 'error.main',
                      border: '1px solid',
                      borderColor: r.blockUser || r.block ? 'success.main' : 'error.main',
                      borderRadius: 1,
                      bgcolor:
                        r.blockUser || r.block ? 'rgba(46,125,50,0.12)' : 'rgba(211,47,47,0.12)',
                      '&:hover': {
                        bgcolor:
                          r.blockUser || r.block ? 'rgba(46,125,50,0.22)' : 'rgba(211,47,47,0.22)',
                      },
                    }}
                  >
                    {r.blockUser || r.block ? (
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
        filter:
          ctx.userType === 'Todays_Active' ? null : (
            <FilterInput
              value={ctx.draft.dpId}
              onChange={ctx.setDraftField('dpId')}
              onSearch={ctx.search}
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
    if (!ctx.isCaller) {
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
        filter:
          !ctx.isCaller && ctx.canShowMobile ? (
            <FilterInput
              value={ctx.draft.empCode}
              onChange={ctx.setDraftField('empCode')}
              onSearch={ctx.search}
              placeholder="Emp"
              compact
            />
          ) : null,
        render: (r) => ctx.renderEmpCodeCell(r),
      },
      {
        id: 'playIn',
        label: 'In',
        width: PLAY_COL.width,
        headSx: PLAY_COL.sx,
        cellSx: PLAY_COL.sx,
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={ctx.playedIn}
            onChange={(e) => {
              ctx.setPlayedIn(e.target.value);
              ctx.setPage(1);
            }}
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: '#fff',
                color: '#111',
                fontSize: 12,
              },
              '& .MuiSelect-select': {
                color: '#111 !important',
                WebkitTextFillColor: '#111 !important',
              },
            }}
          >
            {PLAY_IN_OPTIONS.map((opt) => (
              <MenuItem key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (r) => pickPlayIn(r),
      },
    );

    // Mobile + Call / Bot Call (laxminarayan CallingBtn). Number only with show_mobile.
    if (ctx.showMobileColumn) {
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
        filter: ctx.canShowMobile ? (
          <FilterInput
            value={ctx.draft.mobile}
            onChange={ctx.setDraftField('mobile')}
            onSearch={ctx.search}
            placeholder="Mobile"
            compact
          />
        ) : null,
        render: (r) => (
          <CallingBtn item={r} botId={ctx.botId} reasonList={reasonForUserType(ctx.userType)} hideBotCall />
        ),
      });
    }

    if (!ctx.isCaller) {
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
    if (!ctx.isCaller) {
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
              value={ctx.draft.accountNumber}
              onChange={ctx.setDraftField('accountNumber')}
              onSearch={ctx.search}
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
              value={ctx.draft.aadhaarNumber}
              onChange={ctx.setDraftField('aadhaarNumber')}
              onSearch={ctx.search}
              placeholder="Aadhar"
              compact
            />
          ),
          render: (r) => pickAadharNumber(r),
        },
      );

      if (!ctx.hideContact) {
        cols.push({
          id: 'email',
          label: 'Email',
          width: EMAIL_COL.width,
          headSx: EMAIL_COL.sx,
          cellSx: EMAIL_COL.sx,
          filter: (
            <FilterInput
              value={ctx.draft.email}
              onChange={ctx.setDraftField('email')}
              onSearch={ctx.search}
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
            value={ctx.draft.city}
            onChange={ctx.setDraftField('city')}
            onSearch={ctx.search}
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
            value={ctx.draft.states}
            onChange={(states) => ctx.setDraft((prev) => ({ ...prev, states }))}
            onSearch={ctx.search}
          />
        ),
        render: (r) => String(r.state || '-'),
      },
    );

    // Caller panel: hide Previous Caller
    if (!ctx.isCaller) {
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
        id: 'device',
        label: (
          <>
            Device
            <br />
            Type
          </>
        ),
        width: PLAY_COL.width,
        headSx: PLAY_COL.sx,
        cellSx: PLAY_COL.sx,
        filter: (
          <FilterInput
            value={ctx.draft.deviceType}
            onChange={ctx.setDraftField('deviceType')}
            onSearch={ctx.search}
            placeholder="Device"
            compact
          />
        ),
        render: (r) => String(r.deviceType || '-'),
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
        width: EMP_COL.width,
        headSx: EMP_COL.sx,
        cellSx: EMP_COL.sx,
        filter: null,
        render: (r) => String(r.currentAppVersion || '-'),
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
        width: EMP_COL.width,
        headSx: EMP_COL.sx,
        cellSx: EMP_COL.sx,
        filter: null,
        render: (r) => {
          const key = String(r.clientName || '');
          return key && ctx.appVersions[key] ? ctx.appVersions[key] : '-';
        },
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
    if (!ctx.isCaller) {
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
                formatDisplayTime(r.createdOn) ? ` | ${formatDisplayTime(r.createdOn)}` : ''
              }`
            : '-',
      },
    );

    // Caller panel: hide Block Reason
    if (!ctx.isCaller && (ctx.userType === 'User' || ctx.userType === 'Todays_Active')) {
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
            value={ctx.draft.blockStatus}
            onChange={(e) => {
              ctx.setDraftField('blockStatus')(e.target.value);
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
}
