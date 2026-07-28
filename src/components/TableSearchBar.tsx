import type { ChangeEvent, KeyboardEvent } from 'react';
import { IconButton, InputBase, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

type Props = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearch: () => void;
  placeholder?: string;
  width?: number | string;
};

/** Shared table column search bar — reuse in any CommonTable filter cell. */
export function TableSearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search',
  width = 130,
}: Props) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSearch();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: '0 2px',
        display: 'flex',
        alignItems: 'center',
        bgcolor: '#f4f6f8',
        border: '1px solid #c5ccd6',
        borderRadius: 1,
        width,
        minWidth: width,
        height: 34,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      <InputBase
        sx={{
          ml: 0.75,
          flex: 1,
          fontSize: 12,
          color: '#1a1a1f',
          '& input': { p: 0, color: 'inherit' },
          '& input::placeholder': { color: '#7a8494', opacity: 1 },
        }}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <IconButton
        size="small"
        onClick={onSearch}
        aria-label="search"
        sx={{ color: '#4a5568', p: 0.5 }}
      >
        <SearchIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Paper>
  );
}
