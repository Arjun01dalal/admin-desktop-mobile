import { type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { formatDisplayDate } from '@/utils/dates';

import { MOBILE_COL, NAME_COL_WIDTH, NAME_COL_SX, DP_ID_COL_WIDTH, DP_ID_COL_SX } from '../columnLayout';
import { CompactDpId, FilterInput } from '../FilterControls';
import { reasonForUserType } from '../toolbarHelpers';
import type { UsersColumnContext } from './context';
import { CallingBtn } from '../CallingBtn';
import { type UserRow } from '../utils';

export function buildNonPerformingActiveColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
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
          render: (r) => <CompactDpId value={String(r._id || '')} />,
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
          filter: null,
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
          filter:
            !ctx.isCaller && ctx.canShowMobile ? (
              <FilterInput
                value={ctx.draft.empCode}
                onChange={ctx.setDraftField('empCode')}
                onSearch={ctx.search}
                placeholder={ctx.loginEmpCode ? `Emp Code (${ctx.loginEmpCode}/001)` : 'Search by Emp Code'}
              />
            ) : null,
          render: (r) => ctx.renderEmpCodeCell(r),
        },
        {
          id: 'lastActive',
          label: 'Last Active',
          filter: null,
          render: (r) => {
            const raw = r.lastEngagementDate ?? r.lastActive ?? r.activeUser ?? r.lastActivity;
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
              r.prevEngagementDate ?? r.previousActive ?? r.prevActive ?? r.previousEngagementDate;
            if (raw == null || raw === '') return '-';
            return formatDisplayDate(raw) || String(raw);
          },
        },
      );
      return cols;
}
