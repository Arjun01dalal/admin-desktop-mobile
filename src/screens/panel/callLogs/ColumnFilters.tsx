import { MenuItem, TextField } from '@mui/material';
import { TableSearchBar } from '@/components/TableSearchBar';
import {
  BOT_ID_OPTIONS,
  CALL_STATUS_OPTIONS,
  COMMENT_FILTER_OPTIONS,
} from './constants';
import { useCallLogsFilters } from './FiltersContext';

export function DpIdFilter() {
  const { dpId, onDpIdChange, onApplyFilters } = useCallLogsFilters();
  return (
    <TableSearchBar
      value={dpId}
      onChange={(e) => onDpIdChange(e.target.value)}
      onSearch={onApplyFilters}
      placeholder="DP ID"
    />
  );
}

export function MobNoFilter() {
  const { mobNo, onMobNoChange, onApplyFilters } = useCallLogsFilters();
  return (
    <TableSearchBar
      value={mobNo}
      onChange={(e) => onMobNoChange(e.target.value)}
      onSearch={onApplyFilters}
      placeholder="Mobile"
    />
  );
}

export function StateFilter() {
  const { state, onStateChange, onApplyFilters } = useCallLogsFilters();
  return (
    <TableSearchBar
      value={state}
      onChange={(e) => onStateChange(e.target.value)}
      onSearch={onApplyFilters}
      placeholder="State"
    />
  );
}

export function SidFilter() {
  const { sid, onSidChange, onApplyFilters } = useCallLogsFilters();
  return (
    <TableSearchBar
      value={sid}
      onChange={(e) => onSidChange(e.target.value)}
      onSearch={onApplyFilters}
      placeholder="Call ID"
    />
  );
}

export function StatusFilter() {
  const { selectedStatus, onSelectedStatusChange, onPageReset } = useCallLogsFilters();
  return (
    <TextField
      select
      size="small"
      value={selectedStatus}
      onChange={(e) => {
        onSelectedStatusChange(e.target.value);
        onPageReset();
      }}
      sx={{ minWidth: 120 }}
    >
      {CALL_STATUS_OPTIONS.map((opt) => (
        <MenuItem key={opt} value={opt}>
          {opt}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function BotIdFilter() {
  const { selectedBotId, onSelectedBotIdChange, onPageReset } = useCallLogsFilters();
  return (
    <TextField
      select
      size="small"
      value={selectedBotId}
      onChange={(e) => {
        onSelectedBotIdChange(e.target.value);
        onPageReset();
      }}
      sx={{ minWidth: 90 }}
    >
      <MenuItem value="All">All</MenuItem>
      {BOT_ID_OPTIONS.map((id) => (
        <MenuItem key={id} value={id}>
          {id}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function CommentFilter() {
  const { commentFilter, onCommentFilterChange, onPageReset } = useCallLogsFilters();
  return (
    <TextField
      select
      size="small"
      value={commentFilter}
      onChange={(e) => {
        onCommentFilterChange(e.target.value);
        onPageReset();
      }}
      sx={{ minWidth: 140 }}
    >
      {COMMENT_FILTER_OPTIONS.map((opt) => (
        <MenuItem key={opt} value={opt}>
          {opt}
        </MenuItem>
      ))}
    </TextField>
  );
}
