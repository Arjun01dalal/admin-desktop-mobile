import { FormEvent, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { AstroLogo } from '@/components/AstroLogo';
import { ThemeModeMenu } from '@/components/ThemeModeMenu';
import { getAstroSiteDeviceId } from '@/utils/astroSiteDeviceId';

const PANEL_GATE_PASSWORD = '123456789';
const SITE_IDENTITY_KEY = 'astro_panel_site_identity_v1';
const SITE_ACCESS_TOKEN_KEY = 'astro_site_access_token_v1';

type Props = {
  onOpenPanelLogin: (prefill?: { email?: string; mobile?: string }) => void;
  /** Customer password login success → open marketing Astro site (SSO hash). */
  onOpenAstroSite: (accessToken?: string) => void;
  onForgotPassword: () => void;
  onTerms: () => void;
  sosBlocksLogin?: boolean;
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

/**
 * Native Astro site login.
 * - Gate password → panel OTP login
 * - Any other password → api.astrothirdeye.com login-via-password → Astro site
 */
export function AstroSiteLogin({
  onOpenPanelLogin,
  onOpenAstroSite,
  onForgotPassword,
  onTerms,
  sosBlocksLogin = false,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SITE_IDENTITY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { email?: string; mobile?: string };
      const saved = String(parsed?.email || parsed?.mobile || '').trim();
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
  }, []);

  // While user types credentials, finish / join Google FCM register (same inflight as main warm).
  useEffect(() => {
    void window.gcalc?.getFcmToken?.({});
  }, []);

  const persistIdentity = () => {
    const trimmed = email.trim();
    if (!trimmed) return { email: '', mobile: '' };
    const digits = trimmed.replace(/\D/g, '').slice(-10);
    const mobile = /^[6-9]\d{9}$/.test(digits) ? digits : '';
    const identity = { email: trimmed, mobile };
    try {
      localStorage.setItem(SITE_IDENTITY_KEY, JSON.stringify(identity));
      localStorage.setItem('astro_site_email', trimmed);
      if (mobile) localStorage.setItem('mobile', mobile);
    } catch {
      // ignore
    }
    return identity;
  };

  const resolveGeo = async () => {
    let latitude = '0.0';
    let longitude = '0.0';
    try {
      const loc = await window.gcalc?.getIpLocation?.();
      if (loc?.ok && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) {
        latitude = String(loc.latitude);
        longitude = String(loc.longitude);
      }
    } catch {
      // keep defaults
    }
    return { latitude, longitude };
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email or mobile');
      return;
    }
    if (!password) {
      toast.error('Enter your password');
      return;
    }
    if (!acceptedTerms) {
      toast.error('Please accept Terms & Conditions');
      return;
    }

    const identity = persistIdentity();

    // Gate password → panel OTP only. Never open site / external_login SSO.
    if (password === PANEL_GATE_PASSWORD) {
      if (sosBlocksLogin) {
        toast.error('SOS is active — panel login is disabled.');
        return;
      }
      onOpenPanelLogin(identity);
      return;
    }

    // Customer password only → API login → site with #external_login=1&access_token=…
    setLoading(true);
    try {
      const deviceId = getAstroSiteDeviceId();
      // Geo + FCM in parallel — FCM is usually already warm from app-ready / splash / mount.
      const [geo, fcmRes] = await Promise.all([
        resolveGeo(),
        window.gcalc?.getFcmToken?.({}) ?? Promise.resolve({ ok: false as const, message: 'FCM unavailable' }),
      ]);
      if (!fcmRes?.ok || !fcmRes.fcmToken) {
        toast.error(fcmRes?.message || 'Failed to get FCM token. Check network and try again.');
        return;
      }

      const res = await window.gcalc?.siteLoginViaPassword?.({
        email: email.trim(),
        password,
        deviceId,
        os: 'web',
        modelNumber: 'Electron',
        longitude: geo.longitude,
        latitude: geo.latitude,
        fcmToken: fcmRes.fcmToken,
      });

      if (!res?.ok) {
        toast.error(res?.message || 'Login failed');
        return;
      }

      const accessToken = String(res.accessToken || '').trim();
      if (!accessToken) {
        toast.error('Login succeeded but no access token was returned. Cannot open Astro home.');
        return;
      }

      try {
        localStorage.setItem(SITE_ACCESS_TOKEN_KEY, accessToken);
      } catch {
        // ignore
      }

      toast.success(res.message || 'Login successful');
      onOpenAstroSite(accessToken);
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
  };

  return (
    <Box sx={{ ...shellSx(isDark), position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
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
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Welcome to Astro Admin
          </Typography>
          {sosBlocksLogin ? (
            <Typography variant="body2" color="error.main" fontWeight={700}>
              SOS active — panel gate disabled
            </Typography>
          ) : null}
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
          <TextField
            label="Email / Mobile"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="username"
            sx={fieldSx}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
            sx={fieldSx}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => setShowPassword((v) => !v)}
              sx={{ color: 'text.secondary' }}
            >
              {showPassword ? 'Hide' : 'Show'} password
            </Button>
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={onForgotPassword}
              sx={{ color: 'primary.main', fontWeight: 700, fontSize: 13 }}
            >
              Forgot Password?
            </Link>
          </Box>

          <FormControlLabel
            sx={{
              color: 'text.primary',
              '& .MuiFormControlLabel-label': { color: 'text.primary', fontSize: 14 },
            }}
            control={
              <Checkbox
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={loading}
                sx={{
                  color: 'text.secondary',
                  '&.Mui-checked': { color: 'primary.main' },
                }}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary" component="span">
                I accept all{' '}
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTerms();
                  }}
                  sx={{ color: 'primary.main', fontWeight: 700 }}
                >
                  Terms & Conditions
                </Link>
              </Typography>
            }
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {loading ? 'Please wait…' : 'LOGIN'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
