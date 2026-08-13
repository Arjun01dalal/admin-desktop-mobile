import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  AppBar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import { NAV_ITEMS } from './navItems';
import { getBackPath } from './backPaths';
import { AstroLogo } from '@/components/AstroLogo';
import { BackButton } from '@/components/BackButton';
import { RevealCodesOtpModal } from '@/components/RevealCodesOtpModal';
import { ProfileMenu } from '@/components/ProfileMenu';
import { secureApi } from '@/api/secureClient';
import { useRevealCodes } from '@/context/useRevealCodes';
import { useTheme } from '@mui/material/styles';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import {
  buildSosEnablePayload,
  canAccessNavItem,
  canShowSos,
  getResponsibilities,
  getRoleId,
  getSessionUser,
  isPathAllowed,
  isSosExemptRole,
} from '@/auth/permissions';
import { syncResponsibilitiesForRole } from '@/auth/syncResponsibilities';
import { useSosFlagGuard } from '@/hooks/useSosFlagGuard';

const DRAWER_WIDTH = 240;

type Props = {
  onLogout: () => void;
};

export function AppShell({ onLogout }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const shellBg = isDark ? '#0f0f12' : '#f0f0f2';
  const barBg = isDark ? '#1a1a1f' : '#ffffff';
  const drawerBg = isDark ? '#15151a' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const navigate = useNavigate();
  const location = useLocation();
  const [sosOpen, setSosOpen] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [userVersion, setUserVersion] = useState(0);
  const [navSearch, setNavSearch] = useState('');
  const [revealOtpOpen, setRevealOtpOpen] = useState(false);
  const reveal = useRevealCodes();
  const [revealTick, setRevealTick] = useState(0);

  useEffect(() => {
    if (!reveal.active) return;
    const id = window.setInterval(() => setRevealTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [reveal.active]);
  void revealTick;

  const user = getSessionUser();
  const responsibilities = getResponsibilities(user);
  const roleKey = `${getRoleId(user)}|${responsibilities.join(',')}|${userVersion}`;
  const sosExempt = isSosExemptRole(user);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item, user)),
    [roleKey, user],
  );

  const filteredNavItems = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [navItems, navSearch]);

  const allowedPaths = useMemo(() => {
    const paths = navItems.map((item) => item.path);
    // Nested drill-down (not in sidebar) — allow when parent is visible.
    if (paths.includes('/fund-request-bonus-wallet')) {
      paths.push('/fund-request-bonus-wallet-table');
    }
    if (paths.includes('/deposit') || paths.includes('/state-wise-deposit')) {
      paths.push('/state-wise-deposit');
    }
    if (paths.includes('/withdrawal-fund')) {
      paths.push('/withdraw-user-data');
    }
    if (paths.includes('/coins-report')) {
      paths.push('/coin-reports/report');
    }
    if (paths.includes('/playerRtp')) {
      paths.push('/playerRtp/details');
    }
    if (paths.includes('/funds')) {
      paths.push('/funds/mid', '/funds/payin', '/funds/mid/payingAccount', '/funds/mid-groups');
    }
    if (paths.includes('/users-kyc')) {
      paths.push('/kycList');
    }
    // Dashboard card deep-links (laxminarayan: falconRateManagement, etc.)
    if (
      paths.includes('/dashboard') ||
      paths.includes('/vip-dashboard') ||
      paths.includes('/combined-dashboard') ||
      paths.includes('/risk-dashboard')
    ) {
      paths.push(
        '/falconRateManagement',
        '/exchangeRateManagement',
        '/activeUserData',
        '/betConstructGamesList',
        '/falcon-rate-management',
        '/exchange-rate-management',
        '/balance-f',
        '/total-bonus-users-p',
        '/registered-users',
        '/master-flow',
        '/masterDashboard',
        '/game-activity',
        '/todays-active',
        '/new-registers',
        '/liveMatchTotal',
        '/masterLiveMatchTotal',
        '/bothLiveMatchTotal',
        '/bothMasterAddPage',
      );
    }
    if (paths.includes('/caller-responsibility')) {
      paths.push(
        '/caller-responsibility/deposit-list',
        '/caller-responsibility/bot-users',
        '/caller-responsibility/details',
      );
    }
    if (paths.includes('/game-activity')) {
      paths.push('/game-activity/details');
    }
    if (paths.includes('/player-activity')) {
      paths.push('/player-activity/details');
    }
    if (paths.includes('/leaderboard')) {
      paths.push('/customer-count');
    }
    return paths;
  }, [navItems]);
  const showSos = canShowSos(user);

  const { sosEnabled, setSosEnabled, refresh } = useSosFlagGuard({
    enabled: true,
    isExempt: () => isSosExemptRole(),
    onKick: () => {
      toast.error('SOS activated. Returning to Astro site.');
      onLogout();
    },
  });

  const showSosControls = showSos || (sosEnabled && sosExempt);
  const backTo = getBackPath(location.pathname);

  // Keep Responsibilities in sync with Role_ID after panel opens / storage updates.
  useEffect(() => {
    const roleId = getRoleId();
    if (!roleId) return;
    void syncResponsibilitiesForRole(roleId).then((list) => {
      if (list.length > 0) setUserVersion((v) => v + 1);
    });
  }, []);

  // So office-based SOS can suppress popup on this office's panels.
  useEffect(() => {
    window.gcalc?.setSosLocalContext?.({
      officeLocation: String(user?.officeLocation || user?.location || ''),
      userId: String(user?._id || ''),
    });
  }, [user?._id, user?.officeLocation, user?.location, userVersion]);

  useEffect(() => {
    const bump = () => setUserVersion((v) => v + 1);
    window.addEventListener('gcalc:user-updated', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('gcalc:user-updated', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  useEffect(() => {
    if (!isPathAllowed(location.pathname, allowedPaths)) {
      navigate('/welcome', { replace: true });
    }
  }, [location.pathname, allowedPaths, navigate]);

  const confirmSos = async () => {
    if (sosLoading) return;

    const built = buildSosEnablePayload(user);
    if (!built.ok) {
      toast.error(built.message);
      return;
    }

    setSosLoading(true);
    try {
      const res = await secureApi('auth.sosFlag', built.payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to send SOS alert');
        return;
      }
      toast.error('SOS alert sent. Support will contact you shortly.');
      setSosOpen(false);
      setSosEnabled(true);
      // Originator panel: no local siren/ack popup. Push still goes to other devices.
      window.gcalc?.setSosLocalContext?.({
        officeLocation: String(user?.officeLocation || user?.location || ''),
        userId: String(user?._id || ''),
      });
      window.gcalc?.sosActivated?.({
        silent: true,
        type: String(built.payload.type || ''),
        location: String(built.payload.location || ''),
        blockedByName: String(user?.name || user?.mobile || ''),
      });
      if (!sosExempt) {
        onLogout();
      } else {
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send SOS alert');
    } finally {
      setSosLoading(false);
    }
  };

  const unblockUsers = async () => {
    if (sosLoading) return;
    setSosLoading(true);
    try {
      const res = await secureApi('auth.sosFlag', { enabled: false, type: 'all' });
      if (!res.ok) {
        toast.error(res.message || 'Failed to unblock users');
        return;
      }
      setSosEnabled(false);
      toast.success('Users unblocked. SOS lock cleared.');
      window.gcalc?.sosCleared?.();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unblock users');
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: shellBg }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: barBg,
          color: 'text.primary',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1 }}>
            <AstroLogo size={36} showGlow={false} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Astro CS Panel
            </Typography>
          </Box>

          {showSosControls && (
            // SOS also lives in Profile menu; keep a compact header chip when active.
            sosEnabled ? (
              <Button
                size="small"
                variant="contained"
                color="success"
                disabled={sosLoading}
                onClick={() => void unblockUsers()}
                sx={{ fontWeight: 700 }}
              >
                {sosLoading ? 'Unblocking…' : 'SOS active — Unblock'}
              </Button>
            ) : null
          )}

          <Button
            size="small"
            variant={reveal.active ? 'contained' : 'outlined'}
            color="warning"
            startIcon={reveal.active ? <VisibilityIcon /> : <VisibilityOffIcon />}
            title={
              reveal.active
                ? 'Click to hide original names (restore secret codes)'
                : 'Reveal original names (OTP, 1 hour)'
            }
            onClick={() => {
              // Before 60 min expires: click again reverses to secret/Jyotish names.
              if (reveal.active) {
                reveal.clear();
                return;
              }
              setRevealOtpOpen(true);
            }}
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {reveal.active
              ? `Hide original (${Math.max(1, Math.ceil((reveal.expiresAt - Date.now()) / 60000))}m)`
              : 'Reveal codes'}
          </Button>

          <Button
            size="small"
            color="inherit"
            variant="outlined"
            title="Open another panel window (same security)"
            onClick={() => {
              void window.gcalc?.openNewWindow?.();
            }}
          >
            New window
          </Button>

          <ProfileMenu
            user={user}
            showSosControls={showSosControls}
            sosEnabled={sosEnabled}
            sosLoading={sosLoading}
            onSosClick={() => {
              if (sosEnabled) {
                void unblockUsers();
              } else {
                setSosOpen(true);
              }
            }}
            onLogout={() => {
              onLogout();
              navigate('/');
            }}
          />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: drawerBg,
            borderRight: `1px solid ${borderColor}`,
            pt: 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <Box
          sx={{
            px: 1.25,
            py: 1,
            flexShrink: 0,
            bgcolor: drawerBg,
            borderBottom: `1px solid ${borderColor}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="Search menu..."
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{
                      fontSize: 18,
                      color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                    }}
                  />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: isDark ? '#1a1a1f' : '#f5f5f7',
                fontSize: 13,
                borderRadius: 1.5,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: borderColor,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,159,10,0.45)',
              },
              '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#ff9f0a',
              },
            }}
          />
        </Box>

        <List
          dense
          sx={{
            flex: 1,
            overflowY: 'auto',
            py: 0.75,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              borderRadius: 8,
            },
          }}
        >
          {filteredNavItems.length === 0 && (
            <Typography
              sx={{
                px: 2,
                py: 1.5,
                fontSize: 13,
                color: 'text.secondary',
              }}
            >
              No menu found
            </Typography>
          )}
          {filteredNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              component={NavLink}
              to={item.path}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                '&.active': {
                  bgcolor: 'rgba(255, 159, 10, 0.18)',
                  color: '#ff9f0a',
                },
              }}
            >
              <ListItemText
                primary={toDisplayText(item.label)}
                primaryTypographyProps={{
                  sx: { fontSize: 13, whiteSpace: 'normal', wordBreak: 'break-word' },
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 11,
          overflow: 'auto',
          bgcolor: shellBg,
          minWidth: 0,
        }}
      >
        {backTo && (
          <Box sx={{ mb: 1.5 }}>
            <BackButton to={backTo} />
          </Box>
        )}
        <Outlet />
      </Box>

      <Dialog
        open={sosOpen}
        onClose={() => {
          if (!sosLoading) {
            setSosOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="error" />
          SOS
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Emergency support. Use this only when you need immediate help from the
              admin team.
            </Typography>
            <Typography variant="body2">
              Logged in as{' '}
              <strong>{user?.name || user?.mobile || 'Admin'}</strong>
              {user?.empCode ? ` · Emp ${user.empCode}` : ''}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setSosOpen(false)}
            color="inherit"
            disabled={sosLoading}
          >
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={sosLoading}
            onClick={() => void confirmSos()}
          >
            {sosLoading ? 'Sending…' : 'Confirm SOS'}
          </Button>
        </DialogActions>
      </Dialog>

      <RevealCodesOtpModal
        open={revealOtpOpen}
        onClose={() => setRevealOtpOpen(false)}
      />
    </Box>
  );
}
