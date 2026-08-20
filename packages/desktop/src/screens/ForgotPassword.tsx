import { FormEvent, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { AstroLogo } from '@/components/AstroLogo';
import { ThemeModeMenu } from '@/components/ThemeModeMenu';
import { getAstroSiteDeviceId } from '@/utils/astroSiteDeviceId';

type Step = 'email' | 'otp' | 'password';

type Props = {
  onBack: () => void;
};

function shellSx(isDark: boolean) {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Native forgot-password via api.astrothirdeye.com email OTP flow. */
export function ForgotPassword({ onBack }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetAccessToken, setResetAccessToken] = useState('');
  const [loading, setLoading] = useState(false);

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
  };

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const res = await window.gcalc?.siteSendEmailOtp?.({ email: trimmed });
      if (!res?.ok) {
        toast.error(res?.message || 'Failed to send OTP');
        return;
      }
      setStep('otp');
      toast.success(res.message || `OTP sent to ${trimmed}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (otp.length < 4) {
      toast.error('Enter the OTP sent to your email');
      return;
    }
    setLoading(true);
    try {
      const res = await window.gcalc?.siteVerifyEmailOtp?.({
        email: email.trim(),
        otp: otp.trim(),
        deviceId: getAstroSiteDeviceId(),
      });
      if (!res?.ok || !res.accessToken) {
        toast.error(res?.message || 'Invalid OTP');
        return;
      }
      setResetAccessToken(res.accessToken);
      setStep('password');
      toast.success(res.message || 'OTP verified');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!resetAccessToken) {
      toast.error('Reset session expired. Please verify OTP again.');
      setStep('otp');
      return;
    }
    setLoading(true);
    try {
      const res = await window.gcalc?.siteResetPassword?.({
        email: email.trim(),
        newPassword: password,
        accessToken: resetAccessToken,
      });
      if (!res?.ok) {
        toast.error(res?.message || 'Password reset failed');
        return;
      }
      toast.success(res.message || 'Password reset successful');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const subtitle =
    step === 'email'
      ? 'Enter your registered email to receive an OTP'
      : step === 'otp'
        ? `Enter OTP sent to ${email}`
        : 'Choose a new password';

  const onSubmit =
    step === 'email' ? sendOtp : step === 'otp' ? verifyOtp : resetPassword;

  return (
    <Box sx={{ ...shellSx(isDark), position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Button onClick={onBack} sx={{ color: 'text.secondary' }}>
          ← Back to Login
        </Button>
        <ThemeModeMenu />
      </Box>

      <Stack
        spacing={2}
        alignItems="center"
        sx={{
          flex: 1,
          justifyContent: 'center',
          maxWidth: 420,
          width: '100%',
          mx: 'auto',
          py: 2,
        }}
      >
        <Stack spacing={1} alignItems="center">
          <AstroLogo size={80} />
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 3,
              color: isDark ? '#c9a0ff' : '#7b4fd4',
              fontWeight: 700,
            }}
          >
            ASTRO ADMIN
          </Typography>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Forgot Password
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {subtitle}
          </Typography>
        </Stack>

        <Box
          component="form"
          onSubmit={(e) => void onSubmit(e)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
          }}
        >
          {step === 'email' ? (
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              sx={fieldSx}
            />
          ) : null}

          {step === 'otp' ? (
            <>
              <TextField
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                disabled={loading}
                inputProps={{ inputMode: 'numeric', maxLength: 8 }}
                sx={fieldSx}
              />
              <Button
                type="button"
                variant="text"
                disabled={loading}
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setResetAccessToken('');
                }}
                sx={{ color: 'text.secondary' }}
              >
                Change email
              </Button>
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <TextField
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={fieldSx}
              />
              <TextField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                sx={fieldSx}
              />
            </>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {loading
              ? 'Please wait…'
              : step === 'email'
                ? 'Send OTP'
                : step === 'otp'
                  ? 'Verify OTP'
                  : 'Reset Password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
