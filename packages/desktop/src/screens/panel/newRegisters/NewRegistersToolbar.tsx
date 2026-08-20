import { useState } from 'react';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CAMPAIGN_LIST, type CampaignItem } from './campaignList';
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
  title?: string;
  startDate: string;
  endDate: string;
  itemsPerPage: number;
  campaignName: string;
  /** Callers get only login-assigned campaign IDs. */
  campaigns?: CampaignItem[];
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
  onRefresh: () => void;
  onAddToDialer: () => void;
};

export function NewRegistersToolbar({
  title = 'Filters & Actions',
  startDate,
  endDate,
  itemsPerPage,
  campaignName,
  campaigns = CAMPAIGN_LIST,
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
  onRefresh,
  onAddToDialer,
}: NewRegistersToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        onClick={() => setOpen((value) => !value)}
        sx={{
          minHeight: 44,
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? '1px solid' : 'none',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          <TuneIcon sx={{ color: '#ff9f0a', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={800}>
            {title}
          </Typography>
          {!open ? (
            <>
              <Chip
                size="small"
                label={`${startDate} → ${endDate}`}
                variant="outlined"
                sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 24 }}
              />
              <Chip
                size="small"
                label={`${total.toLocaleString()} users`}
                sx={{
                  height: 24,
                  fontWeight: 700,
                  color: '#c77a18',
                  bgcolor: 'rgba(255,159,10,0.12)',
                }}
              />
            </>
          ) : null}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Button
            size="small"
            variant="outlined"
            startIcon={
              loading ? (
                <CircularProgress size={12} color="inherit" />
              ) : (
                <RefreshIcon sx={{ fontSize: 16 }} />
              )
            }
            disabled={loading}
            onClick={(event) => {
              event.stopPropagation();
              onRefresh();
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              py: 0.25,
              px: 1,
              minWidth: 0,
              color: '#c77a18',
              borderColor: '#f1a144',
              bgcolor: 'rgba(241,161,68,0.10)',
              '&:hover': {
                borderColor: '#e09030',
                bgcolor: 'rgba(241,161,68,0.2)',
              },
            }}
          >
            Refresh
          </Button>
          <IconButton
            size="small"
            aria-label={open ? 'Collapse filters' : 'Expand filters'}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >
            {open ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ p: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ minWidth: 0 }}
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
              {campaigns.map((c) => (
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
        </Box>
      </Collapse>
    </Box>
  );
}
