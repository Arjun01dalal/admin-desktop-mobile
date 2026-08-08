import {
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
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
