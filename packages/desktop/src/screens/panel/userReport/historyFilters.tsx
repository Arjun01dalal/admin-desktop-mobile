import {
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

export const HISTORY_PAGINATION_SX = {
  '& .MuiPaginationItem-root': {
    color: '#333',
    '&.Mui-selected': {
      bgcolor: '#9c27b0',
      color: '#fff',
      fontWeight: 700,
      '&:hover': { bgcolor: '#7b1fa2' },
    },
    '&.Mui-disabled': { color: '#bbb' },
    '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' },
  },
};

export const FILTER_FIELD_SX = {
  minWidth: 120,
  '& .MuiInputBase-root': {
    bgcolor: '#fff',
    color: '#111',
    fontSize: 12,
    pr: 0.5,
  },
};

/**
 * Toolbar inputs need an explicit width: the theme sets MuiTextField
 * `fullWidth`, which otherwise stretches each field onto its own row.
 */
export const TOOLBAR_FIELD_SX = {
  width: { xs: '100%', sm: 170 },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: '#111',
    minHeight: 36,
    fontSize: 13,
    '& fieldset': { borderColor: '#c4cad3' },
    '&:hover fieldset': { borderColor: '#98a2b3' },
    '&.Mui-focused fieldset': { borderColor: '#1976d2' },
  },
  '& .MuiInputBase-input': {
    color: '#111 !important',
    WebkitTextFillColor: '#111 !important',
  },
  '& .MuiInputLabel-root': { color: '#667085' },
  '& .MuiSelect-icon': { color: '#5c6470' },
};

/** White card wrapper so filter rows read as one compact strip. */
export const TOOLBAR_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 0.75,
  p: 1,
  mb: 1,
  bgcolor: '#fff',
  border: '1px solid #dde2e8',
  borderRadius: 1.5,
  boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
};

export const DEFAULT_PAGE_SIZES = ['20', '50', '100', '250'];

/** Light select on the dark panel — value stays readable on white. */
const PAGE_SIZE_FIELD_SX = {
  minWidth: 92,
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: '#111',
    fontSize: 13,
    minHeight: 36,
    '& fieldset': { borderColor: '#c4cad3' },
    '&:hover fieldset': { borderColor: '#9aa4b2' },
    '&.Mui-focused fieldset': { borderColor: '#1976d2' },
  },
  '& .MuiInputBase-input': {
    py: 0.75,
    color: '#111 !important',
    WebkitTextFillColor: '#111 !important',
  },
  '& .MuiSelect-icon': { color: '#5c6470' },
};

/** Inline "Items Per Page" label + select, so toolbars stay on one row. */
export function ItemsPerPageField({
  value,
  onChange,
  options = DEFAULT_PAGE_SIZES,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{ flexShrink: 0 }}
    >
      <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'nowrap' }}>
        {toDisplayText('Items Per Page')}
      </Typography>
      <TextField
        select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={PAGE_SIZE_FIELD_SX}
      >
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

export const MATKA_STATUS_OPTIONS = [
  { id: '', label: 'Select' },
  { id: 'P', label: 'Pending' },
  { id: 'W', label: 'Win' },
  { id: 'L', label: 'Loss' },
];

export const QTECH_STATUS_OPTIONS = [
  { id: '', label: 'Select' },
  { id: 'L', label: 'Loss' },
  { id: 'W', label: 'Win' },
  { id: 'R', label: 'Roll Back' },
];

export function formatDt(raw: unknown) {
  const d = formatDisplayDate(raw);
  const t = formatDisplayTime(raw);
  return d ? `${d} ${t}`.trim() : '-';
}

export function SearchFilter({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onSearch} edge="end">
              <SearchIcon sx={{ fontSize: 18, color: '#555' }} />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={FILTER_FIELD_SX}
    />
  );
}

export function DateSearchFilter({
  value,
  onChange,
  onSearch,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <TextField
      type="date"
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onSearch} edge="end">
              <SearchIcon sx={{ fontSize: 18, color: '#555' }} />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{ ...FILTER_FIELD_SX, minWidth: 150 }}
    />
  );
}

export function StatusSelectFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ ...FILTER_FIELD_SX, minWidth: 100 }}
    >
      {options.map((o) => (
        <MenuItem key={o.id || 'all'} value={o.id}>
          {toDisplayText(o.label)}
        </MenuItem>
      ))}
    </TextField>
  );
}
