import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import {
  EMPTY_CREATE_USER_FORM,
  buildCreateUserPayload,
  createUserRequiresOtp,
  validateCreateUserForm,
  validateCreateUserOtp,
  type CreateUserForm,
  type CreateUserFormErrors,
  type CreateUserMode,
} from '@astro/shared/createUserForm';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { getStoredUser } from '@/utils/dates';
import { APP_OPTIONS, INDIA_STATES } from './constants';

export type { CreateUserMode };

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

/** Create User / Admin / Master — OTP for normal users; Master & Admin skip OTP. */
export function CreateUserDialog({ open, mode, onClose, onCreated }: Props) {
  const isAdmin = mode === 'admin';
  const canCreateMaster = !isAdmin && hasPermission('create_master_user');

  const [form, setForm] = useState<CreateUserForm>(EMPTY_CREATE_USER_FORM);
  const [errors, setErrors] = useState<CreateUserFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');

  const requiresOtp = useMemo(
    () => createUserRequiresOtp(mode, form.master),
    [mode, form.master],
  );

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_CREATE_USER_FORM);
    setErrors({});
    setShowPassword(false);
    setOtpStep(false);
    setOtp('');
  }, [open, mode]);

  const setField = <K extends keyof CreateUserForm>(key: K, value: CreateUserForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === 'master' && value === true) {
      setOtpStep(false);
      setOtp('');
      setErrors((prev) => ({ ...prev, otp: undefined }));
    }
  };

  const resetAndClose = () => {
    setForm(EMPTY_CREATE_USER_FORM);
    setErrors({});
    setOtpStep(false);
    setOtp('');
    onClose();
  };

  const handleClose = () => {
    if (loading) return;
    resetAndClose();
  };

  const createUser = async () => {
    const admin = getStoredUser<{ _id?: string; name?: string; empCode?: string }>();
    const payload = buildCreateUserPayload(form, mode, {
      _id: admin?._id,
      name: admin?.name,
      empCode: admin?.empCode,
    });
    const res = await secureApi(isAdmin ? 'users.createSubAdmin' : 'users.create', payload);
    if (!res.ok) {
      toast.error(res.message || `Failed to create ${isAdmin ? 'admin' : 'user'}`);
      return false;
    }
    toast.success(
      res.message ||
        (form.master
          ? 'Master user created successfully'
          : isAdmin
            ? 'Admin created successfully'
            : 'User created successfully'),
    );
    resetAndClose();
    onCreated?.();
    return true;
  };

  const sendOtp = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    const res = await secureApi('users.sendWalletOtp', { mobile });
    if (!res.ok || res.success === false) {
      toast.error(res.message || 'Failed to send OTP');
      return false;
    }
    toast.success(res.message || 'OTP sent successfully');
    return true;
  };

  const verifyOtp = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    const res = await secureApi('users.verifyBlockOtp', {
      mobile,
      otp: parseInt(otp, 10),
    });
    if (!res.ok || res.success === false) {
      toast.error(res.message || 'OTP verification failed');
      return false;
    }
    toast.success(res.message || 'OTP verified');
    return true;
  };

  const handleSubmit = async () => {
    if (!otpStep) {
      const next = validateCreateUserForm(form, mode);
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }

    setLoading(true);
    try {
      if (!requiresOtp) {
        await createUser();
        return;
      }

      if (!otpStep) {
        if (await sendOtp()) setOtpStep(true);
        return;
      }

      const otpErr = validateCreateUserOtp(otp);
      if (otpErr) {
        setErrors((prev) => ({ ...prev, otp: otpErr }));
        return;
      }

      if (await verifyOtp()) await createUser();
    } finally {
      setLoading(false);
    }
  };

  const title = otpStep
    ? 'Verify OTP'
    : isAdmin
      ? 'Create Admin User'
      : form.master
        ? 'Create Master User'
        : 'Create New User';

  const primaryLabel = loading
    ? 'Please wait…'
    : otpStep
      ? 'Verify & Create'
      : requiresOtp
        ? 'Send OTP'
        : form.master
          ? 'Create Master'
          : isAdmin
            ? 'Create Admin'
            : 'Create User';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" variant="h6" fontWeight={800}>
          {title}
        </Typography>
        {!otpStep && requiresOtp ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            OTP will be sent to the new user&apos;s mobile before create.
          </Typography>
        ) : null}
        {!otpStep && form.master ? (
          <Typography variant="body2" color="error.main" sx={{ mt: 0.5, fontWeight: 600 }}>
            Master user — OTP is skipped.
          </Typography>
        ) : null}
      </DialogTitle>

      <DialogContent>
        {!otpStep ? (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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
                label="Mobile Number"
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
                  label="App Name"
                  value={form.clientName}
                  error={Boolean(errors.clientName)}
                  helperText={errors.clientName}
                  onChange={(e) => setField('clientName', e.target.value)}
                >
                  <MenuItem value="">Select App</MenuItem>
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
                <MenuItem value="">Select State</MenuItem>
                {INDIA_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                fullWidth
                label="City"
                value={form.city}
                error={Boolean(errors.city)}
                helperText={errors.city}
                onChange={(e) => setField('city', e.target.value)}
              />
              {canCreateMaster ? (
                <Box
                  sx={{
                    width: { xs: '100%', sm: '100%' },
                    minHeight: 56,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: form.master ? 'error.main' : 'divider',
                    bgcolor: form.master ? 'rgba(211,47,47,0.06)' : 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <FormControlLabel
                    sx={{ m: 0, width: '100%' }}
                    control={
                      <Checkbox
                        checked={form.master}
                        onChange={(e) => setField('master', e.target.checked)}
                        sx={{
                          color: '#c62828',
                          '&.Mui-checked': { color: '#c62828' },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Master User
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Skip OTP · create as master
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              ) : null}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              OTP sent to <strong>{form.mobile}</strong>. Enter OTP to create this user.
            </Typography>
            <TextField
              fullWidth
              label="Enter OTP"
              value={otp}
              error={Boolean(errors.otp)}
              helperText={errors.otp}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                setErrors((prev) => ({ ...prev, otp: undefined }));
              }}
              autoFocus
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {otpStep ? (
          <Button
            variant="text"
            disabled={loading}
            onClick={() => {
              setOtpStep(false);
              setOtp('');
              setErrors((prev) => ({ ...prev, otp: undefined }));
            }}
          >
            Back
          </Button>
        ) : null}
        <Button variant="outlined" onClick={handleClose} disabled={loading} sx={{ minWidth: 100 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={loading}
          sx={{ ...orangeBtnSx, minWidth: 140 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {primaryLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
