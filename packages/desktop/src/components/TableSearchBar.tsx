import type { ChangeEvent, KeyboardEvent } from 'react';
import { IconButton, InputBase, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

type Props = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearch: () => void;
  placeholder?: string;
  width?: number | string;
  size?: 'compact' | 'comfortable';
};

/** Shared table column search bar — reuse in any CommonTable filter cell. */
export function TableSearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search',
  width = '100%',
  size = 'compact',
}: Props) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSearch();
  };
  const comfortable = size === 'comfortable';

  return (
    <Paper
      elevation={0}
      sx={{
        p: comfortable ? '0 4px' : '0 2px',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        width,
        maxWidth: '100%',
        minWidth: 0,
        height: comfortable ? 34 : 30,
        boxSizing: 'border-box',
      }}
    >
      <InputBase
        sx={{
          ml: comfortable ? 1 : 0.75,
          flex: 1,
          fontSize: comfortable ? 12.5 : 11,
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
        sx={{ color: 'text.secondary', p: comfortable ? 0.5 : 0.4 }}
      >
        <SearchIcon sx={{ fontSize: comfortable ? 17 : 15 }} />
      </IconButton>
    </Paper>
  );
}
