/**
 * Manual Call — bottom-right dock (Call Start / Active Call parity).
 * Phone → user search → dial via shell Active Call session.
 */
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import CallIcon from '@mui/icons-material/Call';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { maskGtelPhone, sanitizeGtelPhone } from '@astro/shared';
import { appCodeForName } from '@/constants/clientNames';
import { secureApi } from '@/api/secureClient';
import { display } from '@/screens/panel/shared';
import { fieldSx } from '@/screens/panel/transactions/shared';
import { UserReportModal } from '@/screens/panel/userReport/UserReportModal';
import { useGtelAuth } from './useGtelAuth';
import { useGtelCallSession } from './GtelCallSession';
import { GtelBusyDock } from './GtelBusyDock';
import { GTEL_Z } from './gtelOverlayZIndex';

export type ManualDialUser = {
  _id?: string;
  dp_id?: string;
  name?: string;
  userName?: string;
  username?: string;
  mobile?: string;
  clientName?: string;
  state?: string;
  city?: string;
  balance?: string | number;
  walletBalance?: string | number;
  bonusWalletBalance?: string | number;
  bonusBalance?: string | number;
  lastActivity?: string;
  last_activity?: string;
  activeUser?: string;
  active_user?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCalled?: () => void;
};

function extractUsers(data: unknown): ManualDialUser[] {
  if (Array.isArray(data)) return data as ManualDialUser[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  const raw =
    (Array.isArray(nested.items) && nested.items) ||
    (Array.isArray(nested.users) && nested.users) ||
    (Array.isArray(obj.items) && obj.items) ||
    (Array.isArray(obj.users) && obj.users) ||
    [];
  return raw.filter((row): row is ManualDialUser => Boolean(row && typeof row === 'object'));
}

export function GtelManualCallModals({ open, onClose, onCalled }: Props) {
  const { canShowMobile, canShowC2c } = useGtelAuth();
  const { startC2c, callingPhone } = useGtelCallSession();
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [calling, setCalling] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [users, setUsers] = useState<ManualDialUser[]>([]);
  const [reportUser, setReportUser] = useState<{ id: string; name: string } | null>(null);

  const reset = useCallback(() => {
    setPhone('');
    setSearching(false);
    setCalling(false);
    setUsersOpen(false);
    setUsers([]);
    setReportUser(null);
  }, []);

  const handleClose = () => {
    if (searching || calling) return;
    reset();
    onClose();
  };

  const searchUsers = async () => {
    const digits = sanitizeGtelPhone(phone);
    if (digits.length !== 10) {
      toast.error('Enter a valid 10 digit number');
      return;
    }
    setSearching(true);
    try {
      const res = await secureApi('users.getAll', {
        itemsPerPage: 50,
        pageNo: 1,
        filter: { mobile: digits },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to fetch users');
        return;
      }
      setUsers(extractUsers(res.data));
      setUsersOpen(true);
    } finally {
      setSearching(false);
    }
  };

  const dial = async (user?: ManualDialUser | null) => {
    const rawPhone = user?.mobile || phone;
    const digits = sanitizeGtelPhone(rawPhone);
    if (digits.length !== 10) {
      toast.error('Valid 10 digit number required');
      return;
    }
    if (!canShowC2c) {
      toast.error('C2C not available for your account');
      return;
    }
    setCalling(true);
    try {
      const userId = String(user?._id || user?.dp_id || '').trim();
      const ok = startC2c(
        {
          phoneNumber: rawPhone,
          userId: userId || undefined,
          userName: String(user?.name || user?.userName || user?.username || ''),
          appName: String(user?.clientName || ''),
          lastActivity: String(
            user?.lastActivity || user?.last_activity || user?.activeUser || user?.active_user || '',
          ),
          balance: user?.balance ?? user?.walletBalance,
          bonusBalance: user?.bonusWalletBalance ?? user?.bonusBalance,
          source: 'Manual',
          isProspect: !user,
        },
        undefined,
        onCalled,
      );
      if (!ok) {
        toast.error('Call could not be initiated');
        return;
      }
      reset();
      onClose();
    } finally {
      setCalling(false);
    }
  };

  if (!open) return null;

  if (callingPhone) {
    return (
      <GtelBusyDock
        title="Manual Call paused"
        phoneMasked={callingPhone}
        onClose={handleClose}
      />
    );
  }

  return (
    <>
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: GTEL_Z.dock,
        width: usersOpen ? 420 : 300,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'min(480px, calc(100vh - 32px))',
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        transition: 'width 160ms ease',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.25,
          py: 1,
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: '50%',
            bgcolor: '#ff9f0a',
            boxShadow: '0 0 0 3px #ff9f0a33',
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={800} fontSize={12} noWrap>
            Manual Call
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.2 }}
            noWrap
          >
            {usersOpen
              ? `Users for ${maskGtelPhone(phone, canShowMobile)}`
              : 'Enter 10-digit number'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={searching || calling}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {!usersOpen ? (
        <Stack spacing={1.25} sx={{ p: 1.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Caller Number"
            placeholder="10 digit number"
            value={phone}
            disabled={searching}
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchUsers();
              }
            }}
            sx={fieldSx}
          />
          <Button
            variant="contained"
            fullWidth
            startIcon={
              searching ? <CircularProgress size={14} color="inherit" /> : <SearchIcon />
            }
            disabled={phone.length !== 10 || searching}
            onClick={() => void searchUsers()}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#ff9f0a',
              color: '#111',
              '&:hover': { bgcolor: '#e08c00' },
            }}
          >
            {searching ? 'Searching…' : 'Find & Call'}
          </Button>
        </Stack>
      ) : (
        <Box sx={{ overflow: 'auto', flex: 1, p: 1.25 }}>
          {users.length === 0 ? (
            <Stack spacing={1.25} alignItems="stretch">
              <Typography variant="caption" color="text.secondary">
                No users found for this number.
              </Typography>
              <Button
                variant="contained"
                startIcon={
                  calling ? <CircularProgress size={14} color="inherit" /> : <CallIcon />
                }
                disabled={calling || phone.length !== 10 || !canShowC2c}
                onClick={() => void dial(null)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: '#ff9f0a',
                  color: '#111',
                  '&:hover': { bgcolor: '#e08c00' },
                }}
              >
                C2C Call Anyway
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setUsersOpen(false);
                  setUsers([]);
                }}
                sx={{ textTransform: 'none' }}
              >
                Back
              </Button>
            </Stack>
          ) : (
            <Stack spacing={0.75}>
              {users.map((user, index) => {
                const name =
                  String(user.name || user.userName || user.username || '').trim() || '—';
                const mobile = String(user.mobile || phone || '');
                const dpId = String(user._id || user.dp_id || '').trim();
                return (
                  <Stack
                    key={dpId || `${mobile}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      px: 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontSize={12} fontWeight={800} noWrap>
                        {name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {canShowMobile ? mobile || '—' : '**********'}
                        {` · ${appCodeForName(user.clientName) || display(user.clientName)}`}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={dpId ? 'primary.main' : 'text.secondary'}
                        noWrap
                        display="block"
                        onClick={
                          dpId
                            ? () => setReportUser({ id: dpId, name: name === '—' ? dpId : name })
                            : undefined
                        }
                        sx={{
                          cursor: dpId ? 'pointer' : 'default',
                          textDecoration: dpId ? 'underline' : 'none',
                          fontWeight: dpId ? 700 : 400,
                        }}
                      >
                        {dpId || '—'}
                        {user.state ? ` · ${display(user.state)}` : ''}
                      </Typography>
                    </Box>
                    <Tooltip title="C2C Call">
                      <span>
                        <IconButton
                          size="small"
                          disabled={calling || !canShowC2c}
                          onClick={() => void dial(user)}
                          sx={{
                            bgcolor: '#ff9f0a',
                            color: '#111',
                            '&:hover': { bgcolor: '#e08c00' },
                            '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                          }}
                        >
                          {calling ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <CallIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                );
              })}
              <Button
                size="small"
                onClick={() => {
                  setUsersOpen(false);
                  setUsers([]);
                }}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                Back
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </Paper>

    <UserReportModal
      open={Boolean(reportUser?.id)}
      userId={reportUser?.id || ''}
      userName={reportUser?.name}
      onClose={() => setReportUser(null)}
    />
    </>
  );
}
