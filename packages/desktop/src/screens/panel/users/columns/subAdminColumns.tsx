import { Box, CircularProgress, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import BlockIcon from '@mui/icons-material/Block';

import { DATETIME_COL_WIDTH, DATETIME_COL_SX } from '../columnLayout';
import { SUBADMIN_LOCATIONS, extractRoleName } from '../usersHelpers';
import { pickLastActivity, type UserRow } from '../utils';
import type { UsersColumnContext } from './context';
import { FilterInput } from '../FilterControls';



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

export function buildSubAdminColumns(ctx: UsersColumnContext): CommonTableColumn<UserRow>[] {
      return [
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
          width: 160,
          filter: (
            <FilterInput
              value={ctx.draft.name}
              onChange={ctx.setDraftField('name')}
              onSearch={ctx.search}
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
              <Box sx={{ minWidth: 0, flex: 1 }}>{ctx.renderUserName(r)}</Box>
              <IconButton
                size="small"
                title="Edit name"
                onClick={() => ctx.openSubEdit(r._id, 'name', r.name)}
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
          filter: ctx.canShowMobile ? (
            <FilterInput
              value={ctx.draft.mobile}
              onChange={ctx.setDraftField('mobile')}
              onSearch={ctx.search}
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
                {ctx.canShowMobile ? String(r.mobile || '-') : r.mobile ? '**********' : '-'}
              </Box>
              <IconButton
                size="small"
                title="Edit mobile"
                onClick={() => ctx.openSubEdit(r._id, 'mobile', r.mobile)}
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
              <Typography variant="body2" noWrap>
                {String(r.telegram_username || r.telegramUsername || '-')}
              </Typography>
              <IconButton
                size="small"
                title="Edit telegram"
                onClick={() =>
                  ctx.openSubEdit(
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
                {String(
                  r.Role_Name ||
                    extractRoleName(r.Role_ID) ||
                    '-',
                )}
              </Typography>
              {ctx.canEditSubAdminRole ? (
                <IconButton
                  size="small"
                  title="Edit role"
                  onClick={() => void ctx.openRoleEdit(r)}
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
            const current = ctx.locationDraft[r._id] ?? String(r.officeLocation || r.location || '');
            const busy = ctx.locationBusyId === r._id;
            return (
              <Stack spacing={0.75} alignItems="stretch" sx={{ py: 0.75, width: 148, mx: 'auto' }}>
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
                      ctx.setLocationDraft((prev) => ({
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
                        onClick={() => void ctx.updateSubAdminLocation(r)}
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
                      disabled={ctx.blockCallerBusy}
                      onClick={() => void ctx.startBlockCaller(r)}
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
                    onClick={() => ctx.openRealName(r)}
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
