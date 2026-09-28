import { type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount, formatDisplayDate } from '@/utils/dates';
import { appCodeForName } from '@/constants/clientNames';

import { MOBILE_COL, NAME_COL_WIDTH, NAME_COL_SX, DP_ID_COL_WIDTH, DP_ID_COL_SX, STATE_COL_WIDTH, STATE_COL_SX, CITY_COL_WIDTH, CITY_COL_SX } from '../columnLayout';
import { CompactDpId, DateRangeFilter, FilterInput, StateMultiFilter } from '../FilterControls';
import { reasonForUserType } from '../toolbarHelpers';
import type { UsersColumnContext } from './context';
import { CallingBtn } from '../CallingBtn';
import { type UserRow } from '../utils';

export function buildLaxmiUsersColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
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
          filter: null,
          render: (r) => ctx.renderUserName(r),
        },
        {
          id: 'dpId',
          label: 'Dp Id',
          width: DP_ID_COL_WIDTH,
          headSx: DP_ID_COL_SX,
          cellSx: DP_ID_COL_SX,
          filter: null,
          render: (r) => <CompactDpId value={String(r.dp_id ?? r._id ?? '')} />,
        },
        {
          id: 'userId',
          label: 'User Id',
          filter: (
            <FilterInput
              value={ctx.draft.userId}
              onChange={ctx.setDraftField('userId')}
              onSearch={ctx.search}
              placeholder="Search by User ID"
            />
          ),
          render: (r) => String(r.userId || '-'),
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
              placeholder="Search by Mobile"
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
              start={ctx.draft.activeUserStart}
              end={ctx.draft.activeUserEnd}
              onStart={ctx.setDraftField('activeUserStart')}
              onEnd={ctx.setDraftField('activeUserEnd')}
              onSearch={ctx.search}
            />
          ),
          render: (r) => (r.activeUser ? formatDisplayDate(r.activeUser) || '-' : '-'),
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
            r.first_wallet_date ? formatDisplayDate(r.first_wallet_date) || '-' : '-',
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
              start={ctx.draft.lastWalletStart}
              end={ctx.draft.lastWalletEnd}
              onStart={ctx.setDraftField('lastWalletStart')}
              onEnd={ctx.setDraftField('lastWalletEnd')}
              onSearch={ctx.search}
            />
          ),
          render: (r) => (r.last_wallet_date ? formatDisplayDate(r.last_wallet_date) || '-' : '-'),
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
          render: (r) => formatAmount(r.total_withdraw ?? r.totalWithdrawal),
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
              value={ctx.draft.states}
              onChange={(states) => ctx.setDraft((prev) => ({ ...prev, states }))}
              onSearch={ctx.search}
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
              value={ctx.draft.city}
              onChange={ctx.setDraftField('city')}
              onSearch={ctx.search}
              placeholder="City"
              compact
            />
          ),
          render: (r) => String(r.city || '-'),
        },
      );

      return cols;
}
