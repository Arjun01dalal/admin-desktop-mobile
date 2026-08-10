import { useMemo } from 'react';
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { BOT_ID_OPTIONS } from '@/screens/panel/callLogs/constants';
import { CAMPAIGN_LIST } from '@/screens/panel/newRegisters/campaignList';
import { PLAY_IN_OPTIONS, type UserType } from './constants';
import { USERS_PAGE_SIZE_OPTIONS } from './toolbarHelpers';

const fieldSx = { minWidth: 130, flex: '1 1 130px' };

const orangeBtnSx = {
  bgcolor: '#f1a144',
  color: '#000',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  boxShadow: 'none',
  px: 1.5,
  py: 0.75,
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e09030', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#f7d2a8', color: '#666' },
};

export type UsersToolbarProps = {
  startDate: string;
  endDate: string;
  userType: UserType;
  typeOptions: { value: UserType; label: string }[];
  itemsPerPage: number;
  uniqueUser: boolean;
  clientName: string;
  playedIn: string;
  botId: string;
  campaignId: string;
  globalCount: number;
  total: number;
  loading?: boolean;
  dialerLoading?: boolean;
  showDates?: boolean;
  canRegister?: boolean;
  canAddToBot?: boolean;
  canAddUserData?: boolean;
  canAddToDialer?: boolean;
  canCreateUser?: boolean;
  canCreateAdmin?: boolean;
  /** Caller panel: hide Unique Users, Global User, Create User / Admin. */
  isCaller?: boolean;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
  onClearDates: () => void;
  onApply: () => void;
  onUserType: (v: UserType) => void;
  onItemsPerPage: (v: number) => void;
  onUniqueUser: (v: boolean) => void;
  onClientName: (v: string) => void;
  onPlayedIn: (v: string) => void;
  onBotId: (v: string) => void;
  onCampaignId: (v: string) => void;
  onRegister: () => void;
  onGlobalUser: () => void;
  onAddToBot: () => void;
  onAddUserData: () => void;
  onAddToDialer: () => void;
  onCreateUser: () => void;
  onCreateAdmin: () => void;
};

/** Laxminarayan Users toolbar layout (dates → type → bot/dialer → create). */
export function UsersToolbar(props: UsersToolbarProps) {
  const campaignOptions = useMemo(
    () => CAMPAIGN_LIST.map((c) => ({ value: c.id.trim(), label: c.id.trim() })),
    [],
  );

  return (
    <Stack spacing={1.5} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
        {props.showDates !== false && (
          <>
            <TextField
              type="date"
              label="From Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={props.startDate}
              onChange={(e) => props.onStartDate(e.target.value)}
              sx={fieldSx}
            />
            <TextField
              type="date"
              label="To Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={props.endDate}
              onChange={(e) => props.onEndDate(e.target.value)}
              sx={fieldSx}
            />
            <Button sx={orangeBtnSx} onClick={props.onApply} disabled={props.loading}>
              Apply
            </Button>
          </>
        )}
        <Button sx={orangeBtnSx} onClick={props.onClearDates}>
          Clear Dates
        </Button>
        <TextField
          select
          label="Select User Type"
          size="small"
          value={props.userType}
          onChange={(e) => props.onUserType(e.target.value as UserType)}
          sx={fieldSx}
        >
          {props.typeOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Items Per Page"
          size="small"
          value={String(props.itemsPerPage)}
          onChange={(e) => props.onItemsPerPage(Number(e.target.value))}
          sx={fieldSx}
        >
          {USERS_PAGE_SIZE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="App Code"
          size="small"
          value={props.clientName}
          onChange={(e) => props.onClientName(e.target.value)}
          sx={fieldSx}
        >
          <MenuItem value="">All</MenuItem>
          {CLIENT_NAMES.map((name) => (
            <MenuItem key={name} value={name}>
              {appCodeForName(name)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="In"
          size="small"
          value={props.playedIn}
          onChange={(e) => props.onPlayedIn(e.target.value)}
          sx={fieldSx}
        >
          {PLAY_IN_OPTIONS.map((opt) => (
            <MenuItem key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        {props.loading && <CircularProgress size={22} />}
      </Stack>

      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
        {!props.isCaller && (
          <FormControlLabel
            control={
              <Checkbox
                checked={props.uniqueUser}
                onChange={(e) => props.onUniqueUser(e.target.checked)}
                size="small"
              />
            }
            label="Unique Users"
          />
        )}
        {props.canRegister && (
          <Button sx={orangeBtnSx} onClick={props.onRegister}>
            Register
          </Button>
        )}
        {!props.isCaller && (
          <Button sx={orangeBtnSx} onClick={props.onGlobalUser}>
            Global User : {props.globalCount}
          </Button>
        )}
        {!props.isCaller && (
          <TextField
            select
            label="Select Bot ID"
            size="small"
            value={props.botId}
            onChange={(e) => props.onBotId(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">Select Bot ID</MenuItem>
            {BOT_ID_OPTIONS.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </TextField>
        )}
        {!props.isCaller && (
          <TextField
            select
            label="Campaign List"
            size="small"
            value={props.campaignId}
            onChange={(e) => props.onCampaignId(e.target.value)}
            sx={{ ...fieldSx, minWidth: 160 }}
          >
            <MenuItem value="">Campaign List</MenuItem>
            {campaignOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        {props.canAddToBot && !props.isCaller && (
          <Button
            sx={orangeBtnSx}
            disabled={props.dialerLoading}
            onClick={props.onAddToBot}
          >
            Add to Bot
          </Button>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{
          pt: 0.5,
          mt: 0.5,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {props.canAddUserData && (
          <Button sx={orangeBtnSx} onClick={props.onAddUserData}>
            Add User Data
          </Button>
        )}
        {props.canAddToDialer && !props.isCaller && (
          <Button
            sx={orangeBtnSx}
            disabled={props.dialerLoading}
            onClick={props.onAddToDialer}
          >
            Add to Dialer
          </Button>
        )}
        {/* Always show create row like laxminarayan when permitted */}
        {props.canCreateUser && (
          <Button sx={orangeBtnSx} onClick={props.onCreateUser}>
            Create New User
          </Button>
        )}
        {props.canCreateAdmin && (
          <Button sx={orangeBtnSx} onClick={props.onCreateAdmin}>
            Create Admin User
          </Button>
        )}
        <Typography
          variant="body1"
          sx={{ ml: 'auto', fontWeight: 700, color: 'text.primary' }}
        >
          Total user count : {props.total}
        </Typography>
      </Stack>
    </Stack>
  );
}
