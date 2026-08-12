import { useState, type MouseEvent } from 'react';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import CheckIcon from '@mui/icons-material/Check';
import {
  useColorMode,
  type ColorModePreference,
} from '@/context/ColorModeContext';

const OPTIONS: {
  value: ColorModePreference;
  label: string;
  icon: typeof DarkModeIcon;
}[] = [
  { value: 'system', label: 'System', icon: SettingsBrightnessIcon },
  { value: 'light', label: 'Light', icon: LightModeIcon },
  { value: 'dark', label: 'Dark', icon: DarkModeIcon },
];

export function ThemeModeMenu() {
  const { preference, resolved, setPreference } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const TriggerIcon =
    preference === 'system'
      ? SettingsBrightnessIcon
      : preference === 'light'
        ? LightModeIcon
        : DarkModeIcon;

  const open = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip
        title={`Theme: ${preference} (${resolved})`}
        enterDelay={400}
      >
        <IconButton
          size="small"
          color="inherit"
          onClick={open}
          aria-label="Theme mode"
          sx={{ border: '1px solid', borderColor: 'divider' }}
        >
          <TriggerIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = preference === opt.value;
          return (
            <MenuItem
              key={opt.value}
              selected={selected}
              onClick={() => {
                setPreference(opt.value);
                close();
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
      </Menu>
    </>
  );
}
