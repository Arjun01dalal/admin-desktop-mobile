import {
  Button,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type ActivityFilterBarProps = {
  title: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  /** When false, hide Qtech / WCO source buttons (e.g. locked deep-link). */
  showSourceToggle?: boolean;
  isQtech: boolean;
  onSourceChange: (isQtech: boolean) => void;
};

const dateFieldSx = { width: 170, flexShrink: 0 };

const actionBtnSx = {
  flexShrink: 0,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
};

const sourceToggleSx = {
  flexShrink: 0,
  borderRadius: '999px',
  border: '1px solid rgba(255, 159, 10, 0.55)',
  overflow: 'hidden',
  '& .MuiToggleButton-root': {
    px: 2,
    py: 1,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#ffb84d',
    border: 'none',
    '&.Mui-selected': {
      background: 'linear-gradient(135deg, #ffd60a, #ff9f0a)',
      color: '#111',
      '&:hover': {
        background: 'linear-gradient(135deg, #ffe066, #ffb340)',
      },
    },
    '&:hover': {
      bgcolor: 'rgba(255, 159, 10, 0.12)',
    },
  },
};

export function ActivityFilterBar({
  title,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onRefresh,
  loading = false,
  showSourceToggle = true,
  isQtech,
  onSourceChange,
}: ActivityFilterBarProps) {
  useRevealCodes();
  return (
    <CollapsibleFilterPanel
      title={toDisplayText(title)}
      summary={`${startDate} → ${endDate} · ${isQtech ? 'Qtech' : 'WCO'}`}
      contentSx={{ overflowX: 'auto' }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap">
        <TextField
          type="date"
          label="From Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          sx={dateFieldSx}
        />
        <TextField
          type="date"
          label="To Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          sx={dateFieldSx}
        />
        <Button
          variant="contained"
          onClick={onApply}
          disabled={loading}
          sx={actionBtnSx}
        >
          Apply
        </Button>
        {onRefresh && (
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
            sx={actionBtnSx}
          >
            Refresh
          </Button>
        )}
        {showSourceToggle && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={isQtech ? 'qtech' : 'wco'}
            onChange={(_e, value) => {
              if (value == null) return;
              onSourceChange(value === 'qtech');
            }}
            disabled={loading}
            sx={sourceToggleSx}
          >
            <ToggleButton value="qtech">{toDisplayText('Qtech')}</ToggleButton>
            <ToggleButton value="wco">{toDisplayText('WCO')}</ToggleButton>
          </ToggleButtonGroup>
        )}
        {loading && <CircularProgress size={22} />}
      </Stack>
    </CollapsibleFilterPanel>
  );
}
