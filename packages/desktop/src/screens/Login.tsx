import { FormEvent, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { useLocationController } from '@/controllers/LocationProvider';
import { AstroLogo } from '@/components/AstroLogo';
import { persistRoleFromLogin } from '@/auth/permissions';
import { syncResponsibilitiesForRole } from '@/auth/syncResponsibilities';
import type { AddressInfo, AuthUser } from '@/types/gcalc';
import { getAuthToken, setAuthToken } from '@/utils/authToken';
import { resetTokenValidationThrottle } from '@/utils/sessionCheck';
import { resetSessionExpiredGuard } from '@/utils/session';

const MOBILE_RE = /^[6-9]\d{9}$/;

type Props = {
  onSuccess: (user: AuthUser, token: string) => void;
  onBack: () => void;
};

export function Login({ onSuccess, onBack }: Props) {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [mobileError, setMobileError] = useState<string>();
  const [otpError, setOtpError] = useState<string>();
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    coords,
    address: geoAddress,
    isReady,
    requestLocation,
  } = useLocationController();

  useEffect(() => {
    const stored = localStorage.getItem('mobile');
    if (stored) {
      setMobile(stored);
      setRememberMe(true);
    }
  }, []);

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
      onSuccess(syncedUser, result.token);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at 50% 0%, #2b2b30 0%, #1c1c1e 55%)',
        px: 3,
        py: 4,
      }}
    >
      <Button
        onClick={onBack}
        sx={{ alignSelf: 'flex-start', color: 'text.secondary', mb: 1 }}
      >
        ← Astro Admin
      </Button>

      <Stack spacing={1} alignItems="center" sx={{ mb: 4 }}>
        <AstroLogo size={96} />
        <Typography
          variant="overline"
          sx={{ letterSpacing: 3, color: '#c9a0ff', fontWeight: 700, lineHeight: 1 }}
        >
          ASTRO ADMIN
        </Typography>
        <Typography variant="h5" fontWeight={700}>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Enter your mobile number to receive a one-time password
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
          />
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
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
