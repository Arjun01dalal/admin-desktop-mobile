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
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { toast } from 'react-toastify';
import { NAV_ITEMS } from './navItems';
import { getBackPath } from './backPaths';
import { AstroLogo } from '@/components/AstroLogo';
import { BackButton } from '@/components/BackButton';
import { secureApi } from '@/api/secureClient';
import {
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
  const navigate = useNavigate();
  const location = useLocation();
  const [sosOpen, setSosOpen] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [userVersion, setUserVersion] = useState(0);

  const user = getSessionUser();
  const responsibilities = getResponsibilities(user);
  const roleKey = `${getRoleId(user)}|${responsibilities.join(',')}|${userVersion}`;
  const sosExempt = isSosExemptRole(user);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item, user)),
    [roleKey, user],
  );

  const allowedPaths = useMemo(() => navItems.map((item) => item.path), [navItems]);
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
    setSosLoading(true);
    try {
      const res = await secureApi('auth.sosFlag', { enabled: true });
      if (!res.ok) {
        toast.error(res.message || 'Failed to send SOS alert');
        return;
      }
      toast.error('SOS alert sent. Support will contact you shortly.');
      setSosOpen(false);
      setSosEnabled(true);
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
      const res = await secureApi('auth.sosFlag', { enabled: false });
      if (!res.ok) {
        toast.error(res.message || 'Failed to unblock users');
        return;
      }
      setSosEnabled(false);
      toast.success('Users unblocked. SOS lock cleared.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unblock users');
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0f0f12' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: '#1a1a1f',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
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
            <Button
              size="small"
              variant="contained"
              color={sosEnabled ? 'success' : 'error'}
              startIcon={sosEnabled ? <LockOpenIcon /> : <WarningAmberIcon />}
              disabled={sosLoading}
              onClick={() => {
                if (sosEnabled) {
                  void unblockUsers();
                } else {
                  setSosOpen(true);
                }
              }}
              sx={{ fontWeight: 700, minWidth: sosEnabled ? 140 : 72 }}
            >
              {sosLoading
                ? sosEnabled
                  ? 'Unblocking…'
                  : 'Sending…'
                : sosEnabled
                  ? 'Unblock users'
                  : 'SOS'}
            </Button>
          )}

          <Typography variant="body2" color="text.secondary">
            {user?.name || user?.mobile || 'Admin'}
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              onLogout();
              navigate('/');
            }}
          >
            Sign out
          </Button>
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
            bgcolor: '#15151a',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            pt: 8,
          },
        }}
      >
        <List dense>
          {navItems.map((item) => (
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
              <ListItemText primary={item.label} />
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
          bgcolor: '#0f0f12',
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
          if (!sosLoading) setSosOpen(false);
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
    </Box>
  );
}
