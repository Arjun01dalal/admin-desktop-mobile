import { useMemo, useState } from 'react';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  IconButton,
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

const fieldSx = { minWidth: 145, flex: '1 1 145px' };

const orangeBtnSx = {
  bgcolor: '#f1a144',
  color: '#000',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  boxShadow: 'none',
  px: 1.75,
  py: 0.75,
  fontSize: 11.5,
  borderRadius: 1.5,
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e09030', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#f7d2a8', color: '#666' },
};

const secondaryBtnSx = {
  ...orangeBtnSx,
  bgcolor: 'transparent',
  color: 'text.secondary',
  border: '1px solid',
  borderColor: 'divider',
  '&:hover': {
    bgcolor: 'action.hover',
    borderColor: '#f1a144',
    boxShadow: 'none',
  },
};

export type UsersToolbarProps = {
  title?: string;
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
  /** Loaded rows that will be pushed (current page until full fetch). */
  dialerCount?: number;
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
  onRefresh: () => void;
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
  // Keep the table prominent on initial load; controls remain one click away.
  const [open, setOpen] = useState(false);
  const campaignOptions = useMemo(
    () => CAMPAIGN_LIST.map((c) => ({ value: c.id.trim(), label: c.id.trim() })),
    [],
  );

  return (
    <Box
      sx={{
        mb: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        onClick={() => setOpen((value) => !value)}
        sx={{
          minHeight: 44,
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? '1px solid' : 'none',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <TuneIcon sx={{ color: '#f1a144', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={800}>
            {props.title || 'Filters & Actions'}
          </Typography>
          <Chip
            size="small"
            label={`${props.total.toLocaleString()} users`}
            sx={{
              height: 24,
              fontWeight: 700,
              color: '#c77a18',
              bgcolor: 'rgba(241,161,68,0.12)',
              border: '1px solid rgba(241,161,68,0.35)',
            }}
          />
          {!open && props.userType ? (
            <Chip
              size="small"
              variant="outlined"
              label={props.typeOptions.find((option) => option.value === props.userType)?.label}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, height: 24 }}
            />
          ) : null}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Button
            size="small"
            variant="outlined"
            startIcon={
              props.loading ? (
                <CircularProgress size={12} color="inherit" />
              ) : (
                <RefreshIcon sx={{ fontSize: 16 }} />
              )
            }
            disabled={props.loading}
            onClick={(event) => {
              event.stopPropagation();
              props.onRefresh();
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              py: 0.25,
              px: 1,
              minWidth: 0,
              color: '#c77a18',
              borderColor: '#f1a144',
              bgcolor: 'rgba(241,161,68,0.10)',
              '&:hover': {
                borderColor: '#e09030',
                bgcolor: 'rgba(241,161,68,0.2)',
              },
            }}
          >
            Refresh
          </Button>
          <IconButton
            size="small"
            aria-label={open ? 'Collapse filters and actions' : 'Expand filters and actions'}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >
            {open ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack spacing={1.25} sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="flex-end" flexWrap="wrap" useFlexGap>
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
        <Button sx={secondaryBtnSx} onClick={props.onClearDates}>
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

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ py: 0.25 }}
          >
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
            Add to Bot{props.dialerCount != null ? ` (${props.dialerCount})` : ''}
          </Button>
        )}
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{
              pt: 1.25,
              mt: 0.25,
              borderTop: '1px solid',
              borderColor: 'divider',
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
          variant="body2"
          sx={{
            ml: 'auto',
            px: 1.25,
            py: 0.65,
            borderRadius: 1.5,
            fontWeight: 800,
            color: 'text.primary',
            bgcolor: 'action.hover',
          }}
        >
          Total users: {props.total.toLocaleString()}
        </Typography>
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
