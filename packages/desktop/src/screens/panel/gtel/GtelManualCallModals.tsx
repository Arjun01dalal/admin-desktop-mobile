import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { appCodeForName } from '@/constants/clientNames';
import CloseIcon from '@mui/icons-material/Close';
import { display } from '@/screens/panel/shared';
import CallIcon from '@mui/icons-material/Call';
import { secureApi } from '@/api/secureClient';
import { useGtelAuth } from './useGtelAuth';
import {
  createGtelCallId,
  maskGtelPhone,
  sanitizeGtelPhone,
} from '@astro/shared';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

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
  return raw.filter(
    (row): row is ManualDialUser => Boolean(row && typeof row === 'object'),
  );
}

export function GtelManualCallModals({ open, onClose, onCalled }: Props) {
  const { admin, canShowMobile, loginExtensionId } = useGtelAuth();
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [calling, setCalling] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [users, setUsers] = useState<ManualDialUser[]>([]);

  const reset = useCallback(() => {
    setPhone('');
    setSearching(false);
    setCalling(false);
    setUsersOpen(false);
    setUsers([]);
  }, []);

  const handleClosePhone = () => {
    if (searching) return;
    reset();
    onClose();
  };

  const handleCloseUsers = () => {
    if (calling) return;
    setUsersOpen(false);
    setUsers([]);
    onClose();
    reset();
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

  const startC2c = async (user?: ManualDialUser | null) => {
    const digits = sanitizeGtelPhone(user?.mobile || phone);
    if (digits.length !== 10) {
      toast.error('Valid 10 digit number required');
      return;
    }
    if (!loginExtensionId) {
      toast.error('Extension not found for your account');
      return;
    }
    setCalling(true);
    try {
      const callId = createGtelCallId();
      const userId = String(user?._id || user?.dp_id || '').trim();
      const res = await secureApi(
        'gtel.clickToCall',
        user
          ? {
              callId,
              phoneNumber: digits,
              extension: loginExtensionId,
              userId,
              subAdminId: String(admin?._id || ''),
              source: 'Manual',
            }
          : {
              callId,
              phoneNumber: digits,
              isProspect: true,
              source: 'Manual',
              extension: loginExtensionId,
            },
      );
      if (!res.ok || res.success === false) {
        toast.error(res.message || 'Call could not be initiated');
        return;
      }
      toast.success('Call initiated');
      reset();
      onClose();
      onCalled?.();
    } finally {
      setCalling(false);
    }
  };

  return (
    <>
      <Dialog open={open && !usersOpen} onClose={handleClosePhone} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
          Manual Call
          <IconButton
            aria-label="Close"
            size="small"
            disabled={searching}
            onClick={handleClosePhone}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Enter a 10-digit number to find matching users, then start C2C.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Caller Number"
            placeholder="Enter 10 digit number"
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
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={
                searching ? <CircularProgress size={14} color="inherit" /> : <CallIcon />
              }
              disabled={phone.length !== 10 || searching}
              onClick={() => void searchUsers()}
              sx={orangeBtnSx}
            >
              {searching ? 'Searching…' : 'Call'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={usersOpen} onClose={handleCloseUsers} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
          Users for {maskGtelPhone(phone, canShowMobile)}
          <IconButton
            aria-label="Close"
            size="small"
            disabled={calling}
            onClick={handleCloseUsers}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {users.length === 0 ? (
            <Stack spacing={2} alignItems="flex-start">
              <Typography color="text.secondary">No users found for this number.</Typography>
              <Button
                variant="contained"
                startIcon={
                  calling ? <CircularProgress size={14} color="inherit" /> : <CallIcon />
                }
                disabled={calling || phone.length !== 10}
                onClick={() => void startC2c(null)}
                sx={orangeBtnSx}
              >
                C2C Call Anyway
              </Button>
            </Stack>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    px: 1.25,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    textAlign: 'left',
                    fontSize: 13,
                  },
                  '& th': { fontWeight: 800, whiteSpace: 'nowrap' },
                }}
              >
                <thead>
                  <tr>
                    <th>Name</th>
                    {canShowMobile ? <th>Mobile</th> : null}
                    <th>App</th>
                    <th>DP ID</th>
                    <th>State</th>
                    <th>City</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => {
                    const name =
                      String(user.name || user.userName || user.username || '').trim() ||
                      '—';
                    const mobile = String(user.mobile || phone || '');
                    const dpId = String(user._id || user.dp_id || '').trim();
                    return (
                      <tr key={dpId || `${mobile}-${index}`}>
                        <td>{name}</td>
                        {canShowMobile ? (
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {mobile || '—'}
                          </td>
                        ) : null}
                        <td>{appCodeForName(user.clientName) || display(user.clientName)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {dpId || '—'}
                        </td>
                        <td>{display(user.state)}</td>
                        <td>{display(user.city)}</td>
                        <td>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={
                              calling ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <CallIcon fontSize="small" />
                              )
                            }
                            disabled={calling}
                            onClick={() => void startC2c(user)}
                            sx={{ ...orangeBtnSx, height: 32, px: 1.25 }}
                          >
                            C2C Call
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
