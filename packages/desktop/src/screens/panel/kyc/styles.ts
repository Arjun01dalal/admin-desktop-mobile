export const filterFieldSx = {
  minWidth: 110,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

export const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  height: 36,
  px: 2.5,
  borderRadius: 1,
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  '&:hover': { bgcolor: '#e08c00' },
};

export const toolbarFieldSx = {
  width: 160,
  flex: '0 0 auto',
  '& .MuiInputBase-root': { bgcolor: '#121218' },
};
