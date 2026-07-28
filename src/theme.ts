import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff9f0a',
      contrastText: '#000',
    },
    background: {
      default: '#1c1c1e',
      paper: '#2b2b30',
    },
    text: {
      primary: '#fff',
      secondary: '#a5a5a5',
    },
  },
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
});
