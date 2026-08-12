import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CAMPAIGN_LIST } from './campaignList';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import type { ActiveStatusFilter, NewRegistrationFilter } from './types';

const NEW_REG_PAGE_SIZES = [
  ...ITEMS_PER_PAGE_OPTIONS,
  '1000',
  '1500',
  '2000',
] as const;

/** Theme sets TextField fullWidth by default — override so toolbar stays one row. */
const fieldSx = {
  flex: '0 0 auto',
  width: 140,
  '& .MuiInputBase-root': { fontSize: 13 },
};

type NewRegistersToolbarProps = {
  startDate: string;
  endDate: string;
  itemsPerPage: number;
  campaignName: string;
  activeStatus: ActiveStatusFilter;
  newRegistration: NewRegistrationFilter;
  otherState: boolean;
  nonPerforming: boolean;
  total: number;
  loading: boolean;
  dialerLoading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onCampaignNameChange: (value: string) => void;
  onActiveStatusChange: (value: ActiveStatusFilter) => void;
  onNewRegistrationChange: (value: NewRegistrationFilter) => void;
  onOtherStateChange: (value: boolean) => void;
  onNonPerformingChange: (value: boolean) => void;
  onApply: () => void;
  onAddToDialer: () => void;
};

export function NewRegistersToolbar({
  startDate,
  endDate,
  itemsPerPage,
  campaignName,
  activeStatus,
  newRegistration,
  otherState,
  nonPerforming,
  total,
  loading,
  dialerLoading,
  onStartDateChange,
  onEndDateChange,
  onItemsPerPageChange,
  onCampaignNameChange,
  onActiveStatusChange,
  onNewRegistrationChange,
  onOtherStateChange,
  onNonPerformingChange,
  onApply,
  onAddToDialer,
}: NewRegistersToolbarProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        mb: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        flexWrap="nowrap"
        useFlexGap
        sx={{ overflowX: 'auto', pb: 0.25 }}
      >
        <TextField
          fullWidth={false}
          type="date"
          label="From"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          sx={fieldSx}
        />
        <TextField
          fullWidth={false}
          type="date"
          label="To"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          sx={fieldSx}
        />
        <TextField
          fullWidth={false}
          select
          label="Per page"
          size="small"
          value={String(itemsPerPage)}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          sx={{ ...fieldSx, width: 110 }}
        >
          {NEW_REG_PAGE_SIZES.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth={false}
          select
          label="Campaign"
          size="small"
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          sx={{ ...fieldSx, width: 150 }}
        >
          <MenuItem value="">
            <em>Select</em>
          </MenuItem>
          {CAMPAIGN_LIST.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.id}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth={false}
          select
          label="Active"
          size="small"
          value={activeStatus}
          onChange={(e) =>
            onActiveStatusChange(e.target.value as ActiveStatusFilter)
          }
          sx={{ ...fieldSx, width: 120 }}
        >
          {(['All', 'Active', 'InActive'] as const).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth={false}
          select
          label="New Reg"
          size="small"
          value={newRegistration}
          onChange={(e) =>
            onNewRegistrationChange(e.target.value as NewRegistrationFilter)
          }
          sx={{ ...fieldSx, width: 110 }}
        >
          {(['True', 'False'] as const).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={otherState}
              onChange={(e) => onOtherStateChange(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Other State</Typography>}
          sx={{ mr: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={nonPerforming}
              onChange={(e) => onNonPerformingChange(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Non-Performing</Typography>}
          sx={{ mr: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={onApply}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 600, px: 2, flex: '0 0 auto' }}
        >
          Apply
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="warning"
          onClick={onAddToDialer}
          disabled={loading || dialerLoading || !campaignName}
          sx={{ textTransform: 'none', fontWeight: 600, px: 2, flex: '0 0 auto' }}
        >
          Add to Dialer
        </Button>
        {(loading || dialerLoading) && <CircularProgress size={20} />}
        <Typography
          variant="body2"
          sx={{
            ml: 'auto',
            px: 1.25,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.selected',
            color: 'text.primary',
            fontWeight: 600,
            flex: '0 0 auto',
            whiteSpace: 'nowrap',
          }}
        >
          Total: {total}
        </Typography>
      </Stack>
    </Paper>
  );
}
