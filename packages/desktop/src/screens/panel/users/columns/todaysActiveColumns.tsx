import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';

import { INDEX_COL, NAME_COL, DP_ID_COL, APP_COL, EMP_COL, PLAY_COL, MOBILE_COL, ACCOUNT_COL, AADHAR_COL, EMAIL_COL, CITY_COL, STATE_COL, AMOUNT_COL, DATETIME_COL } from '../columnLayout';
import { pickAccountNumber, pickAadharNumber, pickPlayIn, type UserRow } from '../utils';
import { CompactDpId, FilterInput, StateMultiFilter } from '../FilterControls';
import { reasonForUserType } from '../toolbarHelpers';
import type { UsersColumnContext } from './context';
import { PLAY_IN_OPTIONS } from '../constants';
import { CallingBtn } from '../CallingBtn';



export function buildTodaysActiveColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
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
            </Stack>
          ),
        },
        {
          id: 'dpId',
          label: 'Dp Id',
          width: DP_ID_COL.width,
          headSx: DP_ID_COL.sx,
          cellSx: DP_ID_COL.sx,
          filter: null,
          render: (r) => {
            const id = String(r._id || '');
            return id ? <CompactDpId value={id} /> : '-';
          },
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
              placeholder="Mobile"
              compact
            />
          ) : null,
          render: (r) => (
            <CallingBtn item={r} botId={ctx.botId} reasonList={reasonForUserType(ctx.userType)} hideBotCall />
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
              Name
            </>
          ),
          width: APP_COL.width,
          headSx: APP_COL.sx,
          cellSx: APP_COL.sx,
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
                '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
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
          render: (r) => String(r.clientName || '-'),
        },
        {
          id: 'playIn',
          label: 'Play In',
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
                '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
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
          id: 'balance',
          label: 'Balance',
          width: AMOUNT_COL.width,
          headSx: AMOUNT_COL.sx,
          cellSx: AMOUNT_COL.sx,
          align: 'right',
          filter: null,
          render: (r) => Math.floor(Number(r.balance) || 0),
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
          render: (r) => {
            // Laxmi Todays_Active: activeUser only
            if (!r.activeUser) return '-';
            const date = formatDisplayDate(r.activeUser);
            const time = formatDisplayTime(r.activeUser);
            return time ? `${date} | ${time}` : date || '-';
          },
        },
        {
          id: 'date',
          label: 'Date',
          width: DATETIME_COL.width,
          headSx: DATETIME_COL.sx,
          cellSx: DATETIME_COL.sx,
          filter: null,
          render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '-'),
        },
        {
          id: 'time',
          label: 'Time',
          width: DATETIME_COL.width,
          headSx: DATETIME_COL.sx,
          cellSx: DATETIME_COL.sx,
          filter: null,
          render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) || '-' : '-'),
        },
      );

      return cols;
}
