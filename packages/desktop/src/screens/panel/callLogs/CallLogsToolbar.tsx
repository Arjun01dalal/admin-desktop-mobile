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
  /** Hide upload / pause (callers). */
  isCaller?: boolean;
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
  isCaller = false,
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
    <Paper
      sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: 'background.paper',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        mb={1.25}
        flexWrap="wrap"
        useFlexGap
        sx={{ minWidth: 0, maxWidth: '100%' }}
      >
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
        <Button
          variant="contained"
          color="warning"
          onClick={onApply}
          disabled={loading}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Apply
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onBotCall}
          disabled={loading || actionLoading}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Bot Call
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onDialerCall}
          disabled={loading || actionLoading}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Dialer Call
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ minWidth: 0, maxWidth: '100%' }}
      >
        <TextField
          select
          label="Campaign List"
          size="small"
          value={campaignId}
          onChange={(e) => onCampaignChange(e.target.value)}
          sx={{ width: 220, flexShrink: 0 }}
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
          sx={{ width: 150, flexShrink: 0 }}
        >
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        {!isCaller && (
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
        )}
        {!isCaller && (
          <Button
            variant="contained"
            color="error"
            onClick={onPauseOpen}
            sx={{ flexShrink: 0 }}
          >
            Pause Bot Call
          </Button>
        )}
        {(loading || actionLoading) && <CircularProgress size={22} />}
      </Stack>

      <Typography variant="body2" fontWeight={700} mt={1.5}>
        Total user count : {total}
      </Typography>
    </Paper>
  );
}
