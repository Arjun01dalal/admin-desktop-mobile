import {
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CAMPAIGN_LIST } from './campaignList';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type NewRegistersToolbarProps = {
  startDate: string;
  endDate: string;
  itemsPerPage: number;
  campaignName: string;
  total: number;
  loading: boolean;
  dialerLoading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onCampaignNameChange: (value: string) => void;
  onApply: () => void;
  onAddToDialer: () => void;
};

export function NewRegistersToolbar({
  startDate,
  endDate,
  itemsPerPage,
  campaignName,
  total,
  loading,
  dialerLoading,
  onStartDateChange,
  onEndDateChange,
  onItemsPerPageChange,
  onCampaignNameChange,
  onApply,
  onAddToDialer,
}: NewRegistersToolbarProps) {
  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          type="date"
          label="From Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <TextField
          type="date"
          label="To Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <TextField
          select
          label="Items Per Page"
          size="small"
          value={String(itemsPerPage)}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Campaign List"
          size="small"
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          sx={{ flex: 1.2, minWidth: 0 }}
        >
          <MenuItem value="">
            <em>Select campaign</em>
          </MenuItem>
          {CAMPAIGN_LIST.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.id}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={onApply} disabled={loading} sx={{ flexShrink: 0 }}>
          Apply
        </Button>
        <Button
          variant="contained"
          onClick={onAddToDialer}
          disabled={loading || dialerLoading}
          sx={{ flexShrink: 0 }}
        >
          Add to Dialer
        </Button>
        {(loading || dialerLoading) && <CircularProgress size={22} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" mt={1.5}>
        Total User : {total}
      </Typography>
    </Paper>
  );
}
