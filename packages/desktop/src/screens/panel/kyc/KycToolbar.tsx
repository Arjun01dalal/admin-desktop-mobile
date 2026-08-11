import { Box, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
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
  onKycList,
  onEnableKycFlow,
}: Props) {
  return (
    <Paper sx={{ p: 2, pt: 3, mb: 2, bgcolor: 'background.paper', overflow: 'visible' }}>
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
    </Paper>
  );
}
