import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

/** White calendar glyph for dark date fields (native indicator stays clickable). */
const WHITE_CALENDAR_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E\")";

/** Dark calendar glyph for light date fields. */
const DARK_CALENDAR_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E\")";

export type AppPaletteMode = 'light' | 'dark';

const shared: ThemeOptions = {
  typography: {
    fontFamily: '"SF Pro Display", "Segoe UI", system-ui, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "input[type='date']::-webkit-calendar-picker-indicator, input[type='time']::-webkit-calendar-picker-indicator, input[type='datetime-local']::-webkit-calendar-picker-indicator":
          {
            cursor: 'pointer',
            opacity: '0 !important',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
          },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
        fullWidth: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 20,
          paddingBlock: 10,
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #ffd60a, #ff9f0a)',
          color: '#000',
          boxShadow: '0 8px 24px rgba(255, 159, 10, 0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #ffe066, #ffb340)',
          },
        },
      },
    },
  },
};

function dateFieldOverrides(calendarIcon: string) {
  return {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&:has(input[type="date"]), &:has(input[type="time"]), &:has(input[type="datetime-local"])':
            {
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                right: 12,
                top: '50%',
                width: 18,
                height: 18,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                zIndex: 1,
                backgroundImage: calendarIcon,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: '18px 18px',
              },
            },
          '& input[type="date"], & input[type="time"], & input[type="datetime-local"]':
            {
              position: 'relative',
              colorScheme: 'light',
            },
          '& input[type="date"]::-webkit-calendar-picker-indicator, & input[type="time"]::-webkit-calendar-picker-indicator, & input[type="datetime-local"]::-webkit-calendar-picker-indicator':
            {
              cursor: 'pointer',
              opacity: 0,
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              padding: 0,
              zIndex: 2,
            },
        },
      },
    },
  } satisfies ThemeOptions['components'];
}

export function createAppTheme(mode: AppPaletteMode): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: {
        main: '#ff9f0a',
        contrastText: '#000',
      },
      background: isDark
        ? { default: '#1c1c1e', paper: '#2b2b30' }
        : { default: '#f5f5f7', paper: '#ffffff' },
      text: isDark
        ? { primary: '#fff', secondary: '#a5a5a5' }
        : { primary: '#111111', secondary: '#5c5c62' },
      divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    },
    components: {
      ...shared.components,
      ...dateFieldOverrides(isDark ? WHITE_CALENDAR_ICON : DARK_CALENDAR_ICON),
    },
  });
}

/** Default dark theme (backward-compatible export). */
export const theme = createAppTheme('dark');
