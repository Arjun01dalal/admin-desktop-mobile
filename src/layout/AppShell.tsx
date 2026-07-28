import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { NAV_ITEMS } from './navItems';
import { getStoredUser } from '@/utils/dates';
import { AstroLogo } from '@/components/AstroLogo';

const DRAWER_WIDTH = 240;

type Props = {
  onLogout: () => void;
};

export function AppShell({ onLogout }: Props) {
  const navigate = useNavigate();
  const user = getStoredUser<{ name?: string; mobile?: string; empCode?: string }>();

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
              Astro Admin Panel
            </Typography>
          </Box>
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
          {NAV_ITEMS.map((item) => (
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
        <Outlet />
      </Box>
    </Box>
  );
}
