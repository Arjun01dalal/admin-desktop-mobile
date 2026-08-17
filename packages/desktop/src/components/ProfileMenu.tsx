import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  TextField,
  Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import CheckIcon from '@mui/icons-material/Check';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { toast } from 'react-toastify';
import {
  useColorMode,
  type ColorModePreference,
} from '@/context/ColorModeContext';
import type { AuthUser } from '@/types/gcalc';
import { getRoleOptions, selectActiveRole } from '@/auth/roleSelection';

function resolveAppVersion() {
  const fromBridge = String(window.gcalc?.version || '').trim();
  if (fromBridge) return fromBridge;
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
}

const THEME_OPTIONS: {
  value: ColorModePreference;
  label: string;
  icon: typeof DarkModeIcon;
}[] = [
  { value: 'system', label: 'System', icon: SettingsBrightnessIcon },
  { value: 'light', label: 'Light', icon: LightModeIcon },
  { value: 'dark', label: 'Dark', icon: DarkModeIcon },
];

type Props = {
  user?: AuthUser | null;
  showSosControls: boolean;
  sosEnabled: boolean;
  sosLoading: boolean;
  onSosClick: () => void;
  onUserChanged: (user: AuthUser) => void;
  onLogout: () => void;
};

function displayOrDash(value: unknown) {
  const s = String(value ?? '').trim();
  return s || '—';
}

function initials(name: string, mobile: string) {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  if (mobile) return mobile.slice(-2);
  return 'A';
}

export function ProfileMenu({
  user,
  showSosControls,
  sosEnabled,
  sosLoading,
  onSosClick,
  onUserChanged,
  onLogout,
}: Props) {
  const { preference, setPreference } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [appVersion, setAppVersion] = useState(resolveAppVersion);
  const roleOptions = getRoleOptions(user);

  useEffect(() => {
    let alive = true;
    void window.gcalc
      ?.getAppVersion?.()
      .then((version) => {
        const next = String(version || '').trim();
        if (alive && next) setAppVersion(next);
      })
      .catch(() => {
        // Keep build-time / preload fallback.
      });
    return () => {
      alive = false;
    };
  }, []);

  const name = String(user?.name || '').trim();
  const mobile = String(user?.mobile || '').trim();
  const email = useMemo(() => {
    const raw = user as AuthUser & {
      Email?: string;
      userEmail?: string;
    };
    const fromUser = String(raw?.email || raw?.Email || raw?.userEmail || '').trim();
    if (fromUser) return fromUser;
    try {
      return String(localStorage.getItem('astro_site_email') || '').trim();
    } catch {
      return '';
    }
  }, [user]);

  const open = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const close = () => setAnchor(null);

  const applyRole = async () => {
    const role = roleOptions.find((item) => item.id === selectedRoleId);
    if (!user || !role) return;
    setRoleLoading(true);
    try {
      const nextUser = await selectActiveRole(user, role);
      onUserChanged(nextUser);
      setRoleOpen(false);
      toast.success('Role is updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Profile" enterDelay={400}>
        <IconButton
          size="small"
          color="inherit"
          onClick={open}
          aria-label="Profile menu"
          sx={{ p: 0.35 }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: '#ff9f0a',
              color: '#111',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {initials(name, mobile) || <PersonOutlineIcon fontSize="small" />}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            borderRadius: 2,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, maxWidth: 320 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {displayOrDash(name || 'Admin')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Mobile: {displayOrDash(mobile)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Email: {displayOrDash(email)}
          </Typography>
          {user?.empCode ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              Emp: {String(user.empCode)}
            </Typography>
          ) : null}
        </Box>

        <Divider />

        <Box sx={{ px: 2, pt: 1.25, pb: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: 0.4 }}
          >
            THEME
          </Typography>
        </Box>
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = preference === opt.value;
          return (
            <MenuItem
              key={opt.value}
              selected={selected}
              onClick={() => {
                setPreference(opt.value);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{opt.label}</ListItemText>
              {selected ? <CheckIcon fontSize="small" sx={{ ml: 1 }} /> : null}
            </MenuItem>
          );
        })}

        {roleOptions.length > 0 ? (
          <>
            <Divider />
            <MenuItem
              onClick={() => {
                close();
                setSelectedRoleId(String(user?.Role_ID || ''));
                setRoleOpen(true);
              }}
            >
              <ListItemIcon>
                <SwapHorizIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Change role</ListItemText>
            </MenuItem>
          </>
        ) : null}

        {showSosControls ? (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.25 }}>
              <Button
                fullWidth
                size="small"
                variant="contained"
                color={sosEnabled ? 'success' : 'error'}
                startIcon={sosEnabled ? <LockOpenIcon /> : <WarningAmberIcon />}
                disabled={sosLoading}
                onClick={() => {
                  close();
                  onSosClick();
                }}
                sx={{ fontWeight: 700 }}
              >
                {sosLoading
                  ? sosEnabled
                    ? 'Unblocking…'
                    : 'Sending…'
                  : sosEnabled
                    ? 'Unblock users'
                    : 'SOS'}
              </Button>
            </Box>
          </>
        ) : null}

        <Divider />
        <MenuItem
          onClick={() => {
            close();
            onLogout();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>

        {appVersion ? (
          <>
            <Divider />
            <Box
              sx={{
                px: 2,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <InfoOutlinedIcon
                sx={{ fontSize: 16, color: 'text.disabled' }}
              />
              <Typography variant="caption" color="text.secondary">
                Desktop v{appVersion}
              </Typography>
            </Box>
          </>
        ) : null}
      </Menu>

      <Dialog open={roleOpen} onClose={() => !roleLoading && setRoleOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="dense"
            label="Select Role"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            disabled={roleLoading}
          >
            {roleOptions.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button disabled={roleLoading} onClick={() => setRoleOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={roleLoading || !selectedRoleId}
            startIcon={roleLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => void applyRole()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
