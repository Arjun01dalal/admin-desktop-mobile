import {
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type CoinRemovalToolbarProps = {
  startDate: string;
  endDate: string;
  itemsPerPage: number;
  loading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onClearDates: () => void;
  onApply: () => void;
};

export function CoinRemovalToolbar({
  startDate,
  endDate,
  itemsPerPage,
  loading,
  onStartDateChange,
  onEndDateChange,
  onItemsPerPageChange,
  onClearDates,
  onApply,
}: CoinRemovalToolbarProps) {
  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', width: '100%' }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
        <TextField
          type="date"
          label="From Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          sx={{ width: 170, flexShrink: 0 }}
        />
        <TextField
          type="date"
          label="To Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          sx={{ width: 170, flexShrink: 0 }}
        />
        <TextField
          select
          label="Items Per Page"
          size="small"
          value={String(itemsPerPage)}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          sx={{ width: 150, flexShrink: 0 }}
        >
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          onClick={onClearDates}
          disabled={loading}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Clear Dates
        </Button>
        <Button
          variant="contained"
          onClick={onApply}
          disabled={loading}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Apply
        </Button>
        {loading && <CircularProgress size={22} />}
      </Stack>
    </Paper>
  );
}
