/** Flat buttons for User Report — overrides theme glow on containedPrimary. */

const NO_GLOW = {
  boxShadow: 'none !important',
  backgroundImage: 'none !important',
  filter: 'none',
  '&:hover': {
    boxShadow: 'none !important',
    backgroundImage: 'none !important',
    filter: 'none',
  },
  '&:focus': { boxShadow: 'none !important' },
  '&:active': { boxShadow: 'none !important' },
  '&.Mui-focusVisible': { boxShadow: 'none !important' },
};

/** History tab buttons. */
export const laxmiTabBtnSx = (active: boolean) => ({
  ...NO_GLOW,
  textTransform: 'none' as const,
  bgcolor: active ? '#1976d2' : '#fff',
  color: active ? '#fff' : '#1976d2',
  borderRadius: '5px',
  px: 1,
  py: 0.45,
  m: 0,
  fontSize: 11,
  fontWeight: 600,
  minWidth: 'auto',
  minHeight: 28,
  lineHeight: 1.15,
  border: '1px solid #1976d2',
  '&:hover': {
    ...NO_GLOW['&:hover'],
    bgcolor: active ? '#1565c0' : '#e3f2fd',
  },
});

/** Filter action buttons (Submit / Apply / Clear Dates). */
export const laxmiActionBtnSx = (_text: 'white' | 'black' = 'white') => ({
  ...NO_GLOW,
  textTransform: 'uppercase' as const,
  bgcolor: '#1976d2',
  color: '#fff',
  fontWeight: 600,
  fontSize: 11,
  px: 1.5,
  py: 0.55,
  borderRadius: '5px',
  minHeight: 32,
  border: '1px solid #1565c0',
  '&:hover': {
    ...NO_GLOW['&:hover'],
    bgcolor: '#1565c0',
  },
  '&.Mui-disabled': {
    bgcolor: '#90caf9',
    color: '#fff',
    borderColor: '#90caf9',
    boxShadow: 'none !important',
  },
});
