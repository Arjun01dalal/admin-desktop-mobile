import { Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { DEPOSIT_STATES } from '@/screens/panel/newRegisters/constants';
import { copyToClipboard } from '@/utils/clipboard';

/** Fixed-width multi-select for State filter — never grows the column. */
export function StateMultiFilter({
  value,
  onChange,
  onSearch,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onSearch: () => void;
}) {
  return (
    <Stack
      spacing={0.35}
      alignItems="stretch"
      sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}
    >
      <TextField
        select
        size="small"
        fullWidth
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(typeof next === 'string' ? next.split(',') : next);
        }}
        SelectProps={{
          multiple: true,
          displayEmpty: true,
          renderValue: (selected) => {
            const list = selected as string[];
            if (!list.length) return 'State';
            if (list.length === 1) return list[0];
            return `${list.length} selected`;
          },
          MenuProps: {
            PaperProps: { sx: { maxHeight: 320 } },
          },
        }}
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          '& .MuiInputBase-root': {
            bgcolor: '#fff',
            color: '#111',
            fontSize: 10.5,
            minHeight: 26,
            height: 26,
            borderRadius: '999px',
            maxWidth: '100%',
            overflow: 'hidden',
          },
          '& .MuiInputBase-input': {
            py: 0.25,
            px: 1,
          },
          '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            py: 0.25,
            pr: '22px !important',
          },
        }}
      >
        {DEPOSIT_STATES.map((state) => (
          <MenuItem key={state} value={state} dense sx={{ fontSize: 12 }}>
            {state}
          </MenuItem>
        ))}
      </TextField>
      <Button
        size="small"
        variant="outlined"
        onClick={onSearch}
        sx={{
          minHeight: 24,
          py: 0.15,
          px: 1,
          fontSize: 10.5,
          fontWeight: 700,
          lineHeight: 1.2,
          textTransform: 'none',
          borderRadius: '999px',
        }}
      >
        Search
      </Button>
    </Stack>
  );
}

/** DP ID cell that ellipsizes instead of overlapping the next column. */
export function CompactDpId({ value }: { value: string }) {
  if (!value) return <>-</>;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Typography
        component="span"
        title={value}
        sx={{
          fontSize: 12,
          minWidth: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          void copyToClipboard(value);
        }}
        aria-label="Copy"
        sx={{ flexShrink: 0, p: 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}

export function FilterInput({
  value,
  onChange,
  onSearch,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
  /** Narrow filter field for compact columns (Name / DP ID). */
  compact?: boolean;
}) {
  return (
    <TextField
      size="small"
      fullWidth={!compact}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={{
        width: compact ? '100%' : undefined,
        maxWidth: compact ? '100%' : undefined,
        '& .MuiInputBase-root': {
          bgcolor: '#fff',
          color: '#111',
          fontSize: compact ? 10.5 : 11,
          minHeight: 26,
          height: 26,
          borderRadius: '999px',
        },
        '& .MuiInputBase-input': {
          py: 0.25,
          px: 1,
        },
      }}
    />
  );
}

export function DateRangeFilter({
  start,
  end,
  onStart,
  onEnd,
  onSearch,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onSearch: () => void;
}) {
  const fieldSx = {
    minWidth: 110,
    '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 11 },
  };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        type="date"
        size="small"
        value={start}
        onChange={(e) => onStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <TextField
        type="date"
        size="small"
        value={end}
        onChange={(e) => onEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
      />
      <IconButton
        size="small"
        onClick={onSearch}
        aria-label="search"
        sx={{
          bgcolor: '#7c4dff',
          color: '#fff',
          borderRadius: 1,
          '&:hover': { bgcolor: '#651fff' },
        }}
      >
        <SearchIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
