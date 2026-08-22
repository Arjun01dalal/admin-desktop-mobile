import { FormEvent, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { useLocationController } from '@/controllers/LocationProvider';
import { AstroLogo } from '@/components/AstroLogo';
import { ThemeModeMenu } from '@/components/ThemeModeMenu';
import { persistRoleFromLogin } from '@/auth/permissions';
import {
  getRoleOptions,
  selectActiveRole,
  type RoleOption,
} from '@/auth/roleSelection';
import { syncResponsibilitiesForRole } from '@/auth/syncResponsibilities';
import { registerSubAdminFcmToken } from '@/auth/registerFcmToken';
import type { AddressInfo, AuthUser } from '@/types/gcalc';
import { getAuthToken, setAuthToken } from '@/utils/authToken';
import { resetTokenValidationThrottle } from '@/utils/sessionCheck';
import { resetSessionExpiredGuard } from '@/utils/session';

const MOBILE_RE = /^[6-9]\d{9}$/;

type Props = {
  onSuccess: (user: AuthUser, token: string) => void;
  onBack: () => void;
  /** Prefill from Astro site form (email box often holds mobile). */
  initialMobile?: string;
  initialEmail?: string;
};

function loginShellSx(isDark: boolean) {
  return {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, #2b2b30 0%, #1c1c1e 55%)'
      : 'radial-gradient(circle at 50% 0%, #ffffff 0%, #f0f1f5 45%, #e8e9ee 100%)',
    color: isDark ? '#fff' : '#111',
    px: 3,
    py: 4,
  };
}

export function Login({ onSuccess, onBack, initialMobile, initialEmail }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [mobileError, setMobileError] = useState<string>();
  const [otpError, setOtpError] = useState<string>();
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const {
    coords,
    address: geoAddress,
    isReady,
    requestLocation,
  } = useLocationController();

  useEffect(() => {
    const fromSite = String(initialMobile || '').replace(/\D/g, '').slice(-10);
    const stored = localStorage.getItem('mobile') || '';
    const emailStored = localStorage.getItem('astro_site_email') || '';
    const emailProp = String(initialEmail || '').trim();
    if (emailProp) {
      try {
        localStorage.setItem('astro_site_email', emailProp);
      } catch {
        // ignore
      }
    }

    const emailDigits = String(emailProp || emailStored)
      .replace(/\D/g, '')
      .slice(-10);
    const candidate =
      (MOBILE_RE.test(fromSite) && fromSite) ||
      (MOBILE_RE.test(emailDigits) && emailDigits) ||
      (MOBILE_RE.test(stored) && stored) ||
      '';

    if (candidate) {
      setMobile(candidate);
      setRememberMe(Boolean(stored) || Boolean(fromSite) || Boolean(emailProp));
    } else if (stored) {
      setMobile(stored);
      setRememberMe(true);
    }
  }, [initialMobile, initialEmail]);

  const handleMobile = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
    if (!digits) {
      setMobileError(undefined);
      return;
    }
    if (!MOBILE_RE.test(digits)) {
      setMobileError('Enter a valid 10-digit mobile number');
    } else {
      setMobileError(undefined);
    }
  };

  const isMobileValid = MOBILE_RE.test(mobile);

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isMobileValid) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    setLoading(true);
    try {
      const result = await window.gcalc?.sendOtp({
        mobile,
        token: getAuthToken(),
      });

      if (!result?.ok) {
        toast.error(result?.message || 'Failed to send OTP');
        return;
      }

      toast.success(`OTP sent to ${mobile}`);
      setShowOtp(true);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e?: FormEvent) => {
    e?.preventDefault();

    if (otp.length !== 4) {
      setOtpError('OTP must be 4 digits');
      return;
    }

    let activeCoords = coords;
    if (!activeCoords) {
      try {
        activeCoords = await requestLocation();
      } catch {
        toast.error('Location is required to proceed');
        return;
      }
    }

    let resolvedAddress: AddressInfo = geoAddress || {};
    if (!resolvedAddress.state || !resolvedAddress.city) {
      const addrResult = await window.gcalc?.getAddress({
        lat: activeCoords.latitude,
        lng: activeCoords.longitude,
        token: getAuthToken(),
      });
      if (addrResult?.ok && addrResult.address) {
        resolvedAddress = addrResult.address;
      }
    }

    setLoading(true);
    try {
      const result = await window.gcalc?.verifyOtp({
        mobile,
        otp,
        state: (resolvedAddress.state as string) || 'Madhya Pradesh',
        city: (resolvedAddress.city as string) || 'Jabalpur',
        lat: activeCoords.latitude,
        long: activeCoords.longitude,
        address: resolvedAddress,
        token: getAuthToken(),
      });

      if (!result?.ok || !result.user || !result.token) {
        toast.error(result?.message || 'Invalid OTP');
        return;
      }

      if (result.user.block) {
        toast.error('Cannot login — user is blocked');
        return;
      }

      if (rememberMe) localStorage.setItem('mobile', mobile);
      else localStorage.removeItem('mobile');

      localStorage.removeItem('global_logout');
      resetTokenValidationThrottle();
      resetSessionExpiredGuard();
      localStorage.setItem('role_id', String(result.user.Role_ID || ''));
      localStorage.setItem('user', JSON.stringify(result.user));
      await setAuthToken(result.token);

      // Laxmi requires users with a `roles` map to choose the active role
      // before entering the panel.
      const roleOptions = getRoleOptions(result.user);
      if (roleOptions.length > 0) {
        setPendingUser(result.user);
        setSelectedRoleId('');
        return;
      }

      persistRoleFromLogin(result.user);

      // Role_ID → Responsibilities (drives side nav). Prefer fresh API list.
      try {
        await syncResponsibilitiesForRole(String(result.user.Role_ID || ''));
      } catch {
        // Keep login Responsibilities from verify-otp if sync fails.
      }

      // Use storage after sync so side nav sees updated Responsibilities.
      const syncedUser =
        (() => {
          try {
            const raw = localStorage.getItem('user');
            return raw ? (JSON.parse(raw) as AuthUser) : null;
          } catch {
            return null;
          }
        })() || result.user;

      toast.success('Login successful');
      void registerSubAdminFcmToken(syncedUser);
      onSuccess(syncedUser, result.token);
    } finally {
      setLoading(false);
    }
  };

  const chooseRole = async () => {
    if (!pendingUser || !selectedRoleId) {
      toast.error('Please select a role');
      return;
    }
    const role = getRoleOptions(pendingUser).find((item) => item.id === selectedRoleId);
    if (!role) {
      toast.error('Selected role is not available');
      return;
    }

    setLoading(true);
    try {
      const nextUser = await selectActiveRole(pendingUser, role);
      toast.success('Role is updated');
      void registerSubAdminFcmToken(nextUser);
      onSuccess(nextUser, getAuthToken() || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    '& .MuiInputBase-root': {
      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
      color: 'text.primary',
    },
    '& .MuiInputBase-input': {
      color: 'text.primary',
      WebkitTextFillColor: 'currentColor',
    },
    '& .MuiInputLabel-root': { color: 'text.secondary' },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
    },
    '& .MuiFormHelperText-root': { color: 'text.secondary' },
  };

  if (pendingUser) {
    const options = getRoleOptions(pendingUser);
    return (
      <Box
        sx={{
          ...loginShellSx(isDark),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <ThemeModeMenu />
        </Box>
        <Stack spacing={3} sx={{ width: '100%', maxWidth: 420 }}>
          <Stack spacing={1} alignItems="center">
            <AstroLogo size={96} />
            <Typography variant="h5" fontWeight={700} color="text.primary">
              Change Role
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Select the role you want to use for this session
            </Typography>
          </Stack>
          <TextField
            select
            fullWidth
            label="Select Role"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            disabled={loading}
            sx={fieldSx}
          >
            {options.map((role: RoleOption) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            fullWidth
            disabled={loading || !selectedRoleId}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            onClick={() => void chooseRole()}
          >
            {loading ? 'Updating…' : 'Submit'}
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={loginShellSx(isDark)}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          mb: 1,
        }}
      >
        <Button onClick={onBack} sx={{ color: 'text.secondary' }}>
          ← Astro Admin
        </Button>
        <ThemeModeMenu />
      </Box>

      <Stack spacing={1} alignItems="center" sx={{ mb: 4 }}>
        <AstroLogo size={96} />
        <Typography
          variant="overline"
          sx={{
            letterSpacing: 3,
            color: isDark ? '#c9a0ff' : '#7b4fd4',
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ASTRO ADMIN
        </Typography>
        <Typography variant="h5" fontWeight={700} color="text.primary">
          {showOtp ? 'Verify OTP' : 'Sign in'}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {showOtp
            ? `Enter the 4-digit OTP sent to ${mobile}`
            : 'Enter your mobile number to receive a one-time password'}
        </Typography>
        {isReady && coords && (
          <Typography variant="caption" color="success.main">
            Location ready
          </Typography>
        )}
      </Stack>

      <Box
        component="form"
        onSubmit={showOtp ? verifyOtp : sendOtp}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <TextField
          label="Mobile"
          value={mobile}
          onChange={(e) => handleMobile(e.target.value)}
          error={Boolean(mobileError)}
          helperText={mobileError}
          disabled={showOtp || loading}
          inputProps={{ inputMode: 'numeric', maxLength: 10 }}
          sx={fieldSx}
        />

        {showOtp && (
          <TextField
            label="OTP"
            value={otp}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setOtp(v);
              setOtpError(undefined);
            }}
            error={Boolean(otpError)}
            helperText={otpError || 'Enter 4-digit OTP'}
            disabled={loading}
            inputProps={{ inputMode: 'numeric', maxLength: 4 }}
            autoFocus
            sx={fieldSx}
          />
        )}

        <FormControlLabel
          sx={{
            color: 'text.primary',
            '& .MuiFormControlLabel-label': { color: 'text.primary' },
          }}
          control={
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              sx={{
                color: 'text.secondary',
                '&.Mui-checked': { color: 'primary.main' },
              }}
            />
          }
          label="Remember me"
        />

        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {showOtp && (
            <Button
              variant="text"
              disabled={loading}
              onClick={() => {
                setShowOtp(false);
                setOtp('');
                setOtpError(undefined);
              }}
              sx={{ color: 'text.secondary' }}
            >
              Change number
            </Button>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || (showOtp ? otp.length !== 4 : !isMobileValid)}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {loading ? 'Please wait…' : showOtp ? 'Verify OTP' : 'Send OTP'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
