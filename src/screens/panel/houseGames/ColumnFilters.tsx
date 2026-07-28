import type { ChangeEvent } from 'react';
import {
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { TableSearchBar } from '@/components/TableSearchBar';
import { SELECT_FILTER_FIELDS, type FiltersState } from './constants';
import { useHouseGamesFilters } from './FiltersContext';

const selectSx = {
  width: 90,
  bgcolor: '#f4f6f8',
  borderRadius: 1,
  '& .MuiOutlinedInput-root': { height: 34 },
  '& .MuiSelect-select': { fontSize: 12, py: 0.75, color: '#1a1a1f' },
};

function TextFilter({
  field,
  placeholder,
  width = 110,
}: {
  field: keyof FiltersState;
  placeholder: string;
  width?: number;
}) {
  const { filters, onFilterChange, onSearch } = useHouseGamesFilters();
  return (
    <TableSearchBar
      value={String(filters[field] ?? '')}
      placeholder={placeholder}
      width={width}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onFilterChange(field, e.target.value)
      }
      onSearch={onSearch}
    />
  );
}

export function NameFilter() {
  return <TextFilter field="name" placeholder="Search by Name" width={130} />;
}
export function UserIdFilter() {
  return <TextFilter field="userId" placeholder="User ID" />;
}
export function TxnIdFilter() {
  return <TextFilter field="txnId" placeholder="Txn ID" />;
}
export function RefTxnIdFilter() {
  return <TextFilter field="refTxnId" placeholder="Ref Txn" width={100} />;
}
export function RoundIdFilter() {
  return <TextFilter field="roundId" placeholder="Round ID" />;
}
export function SessionIdFilter() {
  return <TextFilter field="sessionId" placeholder="Session ID" />;
}
export function GameIdFilter() {
  return <TextFilter field="gameId" placeholder="Game ID" width={100} />;
}
export function OperatorIdFilter() {
  return <TextFilter field="operatorId" placeholder="Operator ID" width={100} />;
}
export function CurrencyFilter() {
  return <TextFilter field="currency" placeholder="Currency" width={90} />;
}
export function RoundCapacityFilter() {
  return <TextFilter field="roundCapacity" placeholder="Round Cap" width={95} />;
}

export function AmountFilter() {
  const { filters, onFilterChange, onSearch } = useHouseGamesFilters();
  return (
    <Stack spacing={0.5} alignItems="center">
      <TableSearchBar
        value={filters.minAmount}
        placeholder="Min"
        width={90}
        onChange={(e) => onFilterChange('minAmount', e.target.value)}
        onSearch={onSearch}
      />
      <TableSearchBar
        value={filters.maxAmount}
        placeholder="Max"
        width={90}
        onChange={(e) => onFilterChange('maxAmount', e.target.value)}
        onSearch={onSearch}
      />
    </Stack>
  );
}

export function TypeFilter() {
  const { filters, onFilterChange, onSearch } = useHouseGamesFilters();
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
      <TextField
        select
        size="small"
        fullWidth={false}
        value={filters.type}
        onChange={(e) => onFilterChange('type', e.target.value)}
        sx={selectSx}
      >
        {SELECT_FILTER_FIELDS[0].options.map((o) => (
          <MenuItem key={o.value || 'all'} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <IconButton size="small" onClick={onSearch} sx={{ color: '#4a5568' }}>
        <SearchIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}

export function StatusFilter() {
  const { filters, onFilterChange, onSearch } = useHouseGamesFilters();
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
      <TextField
        select
        size="small"
        fullWidth={false}
        value={filters.status}
        onChange={(e) => onFilterChange('status', e.target.value)}
        sx={{ ...selectSx, width: 80 }}
      >
        {SELECT_FILTER_FIELDS[1].options.map((o) => (
          <MenuItem key={o.value || 'all'} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <IconButton size="small" onClick={onSearch} sx={{ color: '#4a5568' }}>
        <SearchIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}

export function IsBotFilter() {
  const { filters, onCheckboxChange, onSearch } = useHouseGamesFilters();
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
      <FormControlLabel
        sx={{ m: 0, '& .MuiTypography-root': { fontSize: 11, color: '#e8e8ea' } }}
        control={
          <Checkbox
            size="small"
            checked={filters.isBot === true}
            onChange={(e) => onCheckboxChange('isBot', e.target.checked)}
          />
        }
        label="Is Bot"
      />
      <IconButton size="small" onClick={onSearch} sx={{ color: '#4a5568' }}>
        <SearchIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}

export function HumanFilter() {
  const { filters, onCheckboxChange, onSearch } = useHouseGamesFilters();
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
      <FormControlLabel
        sx={{ m: 0, '& .MuiTypography-root': { fontSize: 11, color: '#e8e8ea' } }}
        control={
          <Checkbox
            size="small"
            checked={filters.human === true}
            onChange={(e) => onCheckboxChange('human', e.target.checked)}
          />
        }
        label="Human"
      />
      <IconButton size="small" onClick={onSearch} sx={{ color: '#4a5568' }}>
        <SearchIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}
