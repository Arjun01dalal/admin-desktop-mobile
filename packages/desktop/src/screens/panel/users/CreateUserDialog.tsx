import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { APP_OPTIONS, INDIA_STATES } from './constants';

export type CreateUserMode = 'user' | 'admin';

type Form = {
  name: string;
  mobile: string;
  password: string;
  clientName: string;
  roleName: string;
  state: string;
  city: string;
};

const EMPTY: Form = {
  name: '',
  mobile: '',
  password: '',
  clientName: '',
  roleName: '',
  state: '',
  city: '',
};

type Props = {
  open: boolean;
  mode: CreateUserMode;
  onClose: () => void;
  onCreated?: () => void;
};

const orangeBtnSx = {
  bgcolor: '#f1a144',
  color: '#000',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  px: 2.5,
  '&:hover': { bgcolor: '#e09030' },
};

/** Create User / Admin — MUI dialog aligned with laxminarayan CreateUserModal. */
export function CreateUserDialog({ open, mode, onClose, onCreated }: Props) {
  const isAdmin = mode === 'admin';
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
      setShowPassword(false);
    }
  }, [open, mode]);

  const setField = (key: keyof Form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!/^\d{10}$/.test(form.mobile.trim())) {
      next.mobile = 'Enter a valid 10-digit mobile';
    }
    if (form.password.trim().length < 6) {
      next.password = 'Min 6 characters';
    }
    if (!isAdmin && !form.clientName) next.clientName = 'App is required';
    if (isAdmin && !form.roleName.trim()) next.roleName = 'Role is required';
    if (!form.state) next.state = 'State is required';
    if (!form.city.trim()) next.city = 'City is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleClose = () => {
    if (loading) return;
    setForm(EMPTY);
    setErrors({});
    onClose();
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const raw = isAdmin
        ? {
            name: form.name,
            mobile: form.mobile,
            password: form.password,
            roleName: form.roleName,
            state: form.state,
            city: form.city,
          }
        : {
            name: form.name,
            mobile: form.mobile,
            password: form.password,
            clientName: form.clientName,
            state: form.state,
            city: form.city,
          };
      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => String(v).trim() !== ''),
      );
      const res = await secureApi(isAdmin ? 'users.createSubAdmin' : 'users.create', payload);
      if (!res.ok) {
        toast.error(res.message || `Failed to create ${isAdmin ? 'admin' : 'user'}`);
        return;
      }
      toast.success(
        res.message || (isAdmin ? 'Admin created successfully' : 'User created successfully'),
      );
      handleClose();
      onCreated?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isAdmin ? 'Create Admin User' : 'Create New User'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Name"
              value={form.name}
              error={Boolean(errors.name)}
              helperText={errors.name}
              onChange={(e) => setField('name', e.target.value)}
            />
            {isAdmin ? (
              <TextField
                fullWidth
                label="Role"
                value={form.roleName}
                error={Boolean(errors.roleName)}
                helperText={errors.roleName}
                onChange={(e) => setField('roleName', e.target.value)}
              />
            ) : null}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Mobile"
              value={form.mobile}
              error={Boolean(errors.mobile)}
              helperText={errors.mobile}
              inputProps={{ inputMode: 'numeric', maxLength: 10 }}
              onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              error={Boolean(errors.password)}
              helperText={errors.password}
              onChange={(e) => setField('password', e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {!isAdmin ? (
              <TextField
                select
                fullWidth
                label="App Code"
                value={form.clientName}
                error={Boolean(errors.clientName)}
                helperText={errors.clientName}
                onChange={(e) => setField('clientName', e.target.value)}
              >
                <MenuItem value="">Select app</MenuItem>
                {APP_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              select
              fullWidth
              label="State"
              value={form.state}
              error={Boolean(errors.state)}
              helperText={errors.state}
              onChange={(e) => setField('state', e.target.value)}
            >
              <MenuItem value="">Select state</MenuItem>
              {INDIA_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            fullWidth
            label="City"
            value={form.city}
            error={Boolean(errors.city)}
            helperText={errors.city}
            onChange={(e) => setField('city', e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" onClick={handleClose} disabled={loading} sx={{ minWidth: 100 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={loading}
          sx={{ ...orangeBtnSx, minWidth: 120 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? 'Creating…' : isAdmin ? 'Create Admin' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
