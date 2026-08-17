import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, CircularProgress, MenuItem, Stack, TextField } from '@mui/material';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { orangeBtnSx, toolbarFieldSx } from './styles';

type Props = {
  startDate: string;
  endDate: string;
  pageSize: number;
  loading: boolean;
  isNightLockActive: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onApply: () => void;
  onRefresh: () => void;
  onKycList: () => void;
  onEnableKycFlow: () => void;
};

export function KycToolbar({
  startDate,
  endDate,
  pageSize,
  loading,
  isNightLockActive,
  onStartDateChange,
  onEndDateChange,
  onPageSizeChange,
  onApply,
  onRefresh,
  onKycList,
  onEnableKycFlow,
}: Props) {
  return (
    <CollapsibleFilterPanel
      title="KYC"
      summary={`${startDate} → ${endDate}`}
      contentSx={{ pt: 2, overflow: 'visible' }}
    >
      <Box sx={{ overflowX: 'auto', overflowY: 'visible', pb: 0.25 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ pt: 1, minWidth: 'max-content' }}
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            sx={toolbarFieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            sx={toolbarFieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            fullWidth={false}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            sx={{ ...toolbarFieldSx, width: 130 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={onApply} disabled={loading} sx={orangeBtnSx}>
            Apply
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="contained" onClick={onKycList} sx={orangeBtnSx}>
            KYC List
          </Button>
          {isNightLockActive ? (
            <Button variant="contained" onClick={onEnableKycFlow} sx={orangeBtnSx}>
              Enable KYC Flow
            </Button>
          ) : null}
        </Stack>
      </Box>
    </CollapsibleFilterPanel>
  );
}
