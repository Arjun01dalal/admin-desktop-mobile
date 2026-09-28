
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { type CommonTableColumn } from '@/components/CommonTable';
import { MenuItem, TextField } from '@mui/material';

import { MOBILE_COL, NAME_COL_WIDTH, NAME_COL_SX, DP_ID_COL_WIDTH, DP_ID_COL_SX, STATE_COL_WIDTH, STATE_COL_SX, CITY_COL_WIDTH, CITY_COL_SX, DATETIME_COL_WIDTH, DATETIME_COL_SX } from '../columnLayout';
import { pickAccountNumber, pickAadharNumber, pickLastActivity, pickUserBankName, type UserRow } from '../utils';
import { CompactDpId, FilterInput, StateMultiFilter } from '../FilterControls';
import { reasonForUserType } from '../toolbarHelpers';
import type { UsersColumnContext } from './context';
import { CallingBtn } from '../CallingBtn';

export function buildInactiveDepositColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
      const cols: CommonTableColumn<UserRow>[] = [
        {
          id: 'index',
          label: '#',
          width: 56,
          filter: null,
          render: (_r, i) => (ctx.page - 1) * ctx.itemsPerPage + i + 1,
        },
        {
          id: 'name',
          label: 'Name',
          width: NAME_COL_WIDTH,
          headSx: NAME_COL_SX,
          cellSx: NAME_COL_SX,
          filter: (
            <FilterInput
              value={ctx.draft.name}
              onChange={ctx.setDraftField('name')}
              onSearch={ctx.search}
              placeholder="Name"
              compact
            />
          ),
          render: (r) => ctx.renderUserName(r),
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
              value={ctx.clientName}
              onChange={(e) => {
                ctx.setClientName(e.target.value);
                ctx.setPage(1);
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
              placeholder="Search by mobile"
              compact
            />
          ) : null,
          render: (r) => (
            <CallingBtn
              item={r}
              botId={ctx.botId}
              reasonList={reasonForUserType(ctx.userType)}
              hideBotCall
            />
          ),
        });
      }

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
            filter: (
              <FilterInput
                value={ctx.draft.accountNumber}
                onChange={ctx.setDraftField('accountNumber')}
                onSearch={ctx.search}
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
                value={ctx.draft.aadhaarNumber}
                onChange={ctx.setDraftField('aadhaarNumber')}
                onSearch={ctx.search}
                placeholder="Search by aadhar no"
              />
            ),
            render: (r) => pickAadharNumber(r),
          },
        );

        if (!ctx.hideContact) {
          cols.push({
            id: 'email',
            label: 'Email',
            filter: (
              <FilterInput
                value={ctx.draft.email}
                onChange={ctx.setDraftField('email')}
                onSearch={ctx.search}
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
          width: STATE_COL_WIDTH,
          headSx: STATE_COL_SX,
          cellSx: STATE_COL_SX,
          filter: (
            <StateMultiFilter
              value={ctx.draft.states}
              onChange={(states) => ctx.setDraft((prev) => ({ ...prev, states }))}
              onSearch={ctx.search}
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
              value={ctx.draft.deviceType}
              onChange={ctx.setDraftField('deviceType')}
              onSearch={ctx.search}
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
          render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '-'),
        },
        {
          id: 'time',
          label: 'Time',
          filter: null,
          render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) || '-' : '-'),
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
          render: (r) => formatAmount(r.bonusWalletBalance ?? r.bonusBalance ?? r.bonus),
        },
      );

      if (!ctx.isCaller) {
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
