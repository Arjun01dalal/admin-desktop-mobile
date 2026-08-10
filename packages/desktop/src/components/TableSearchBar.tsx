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
  width = '100%',
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
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        width,
        maxWidth: '100%',
        minWidth: 0,
        height: 30,
        boxSizing: 'border-box',
      }}
    >
      <InputBase
        sx={{
          ml: 0.75,
          flex: 1,
          fontSize: 11,
          color: 'text.primary',
          '& input': { p: 0, color: 'inherit' },
          '& input::placeholder': {
            color: 'text.secondary',
            opacity: 0.85,
          },
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
        sx={{ color: 'text.secondary', p: 0.4 }}
      >
        <SearchIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Paper>
  );
}
