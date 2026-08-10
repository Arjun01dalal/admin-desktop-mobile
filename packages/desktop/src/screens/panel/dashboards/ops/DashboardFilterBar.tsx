import {
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { appCodeForName } from '@/constants/clientNames';
import type { ProviderFilter } from './types';
import { PROVIDER_FILTER_META, toDisplayText } from './constants';
import { useRevealCodes } from '@/context/useRevealCodes';

type Props = {
  startDate: string;
  endDate: string;
  appClientName: string;
  filterBy: ProviderFilter;
  appOptions: readonly string[];
  showProviderFilter?: boolean;
  loading?: boolean;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onAppChange: (v: string) => void;
  onFilterByChange: (v: ProviderFilter) => void;
  onApply: () => void;
  onAllData?: () => void;
  onRefresh?: () => void;
};

/** Shared filter bar — dates / Apply / App / Filter By / Refresh. */
export function DashboardFilterBar({
  startDate,
  endDate,
  appClientName,
  filterBy,
  appOptions,
  showProviderFilter = true,
  loading,
  onStartDateChange,
  onEndDateChange,
  onAppChange,
  onFilterByChange,
  onApply,
  onAllData,
  onRefresh,
}: Props) {
  useRevealCodes();
  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        bgcolor: 'background.paper',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
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
        {onAllData && (
          <Button
            variant="contained"
            color="warning"
            onClick={onAllData}
            disabled={loading}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          >
            All Data
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="outlined"
            color="warning"
            onClick={onRefresh}
            disabled={loading}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          >
            Refresh
          </Button>
        )}
        <TextField
          select
          label="Select App"
          size="small"
          value={appClientName}
          onChange={(e) => onAppChange(e.target.value)}
          sx={{ width: 180, flexShrink: 0 }}
        >
          <MenuItem value="">
            <em>All Apps</em>
          </MenuItem>
          {appOptions.map((name) => (
            <MenuItem key={name} value={name}>
              {appCodeForName(name)}
            </MenuItem>
          ))}
        </TextField>
        {showProviderFilter && (
          <TextField
            select
            label="Filter By"
            size="small"
            value={filterBy}
            onChange={(e) => onFilterByChange(e.target.value as ProviderFilter)}
            sx={{ width: 200, flexShrink: 0 }}
          >
            {PROVIDER_FILTER_META.map(({ name }) => (
              <MenuItem key={name} value={name}>
                {toDisplayText(name)}
              </MenuItem>
            ))}
          </TextField>
        )}
        {loading && <CircularProgress size={22} />}
      </Stack>
    </Paper>
  );
}
