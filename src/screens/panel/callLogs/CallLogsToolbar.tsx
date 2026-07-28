import { type Ref } from 'react';
import {
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CAMPAIGN_LIST } from '../newRegisters/campaignList';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type CallLogsToolbarProps = {
  startDate: string;
  endDate: string;
  campaignId: string;
  itemsPerPage: number;
  total: number;
  loading: boolean;
  actionLoading: boolean;
  fileRef: Ref<HTMLInputElement>;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCampaignChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onApply: () => void;
  onBotCall: () => void;
  onDialerCall: () => void;
  onUpload: (file?: File | null) => void;
  onPauseOpen: () => void;
};

export function CallLogsToolbar({
  startDate,
  endDate,
  campaignId,
  itemsPerPage,
  total,
  loading,
  actionLoading,
  fileRef,
  onStartDateChange,
  onEndDateChange,
  onCampaignChange,
  onItemsPerPageChange,
  onApply,
  onBotCall,
  onDialerCall,
  onUpload,
  onPauseOpen,
}: CallLogsToolbarProps) {
  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
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
        <Button variant="contained" onClick={onApply} disabled={loading} sx={{ flexShrink: 0 }}>
          Apply
        </Button>
        <Button
          variant="contained"
          onClick={onBotCall}
          disabled={loading || actionLoading}
          sx={{ flexShrink: 0 }}
        >
          Bot Call
        </Button>
        <Button
          variant="contained"
          onClick={onDialerCall}
          disabled={loading || actionLoading}
          sx={{ flexShrink: 0 }}
        >
          Dialer Call
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          select
          label="Campaign List"
          size="small"
          value={campaignId}
          onChange={(e) => onCampaignChange(e.target.value)}
          sx={{ flex: 1, minWidth: 0 }}
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
        <Button
          variant="outlined"
          component="label"
          disabled={actionLoading}
          sx={{ flexShrink: 0 }}
        >
          Upload Data to Bot
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onPauseOpen}
          sx={{ flexShrink: 0 }}
        >
          Pause Bot Call
        </Button>
        {(loading || actionLoading) && <CircularProgress size={22} />}
      </Stack>

      <Typography variant="body2" color="text.secondary" mt={1.5}>
        Total user count : {total}
      </Typography>
    </Paper>
  );
}
