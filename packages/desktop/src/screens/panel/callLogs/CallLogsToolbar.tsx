import { useState, type Ref } from 'react';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CAMPAIGN_LIST, campaignsForLoginUser, type CampaignItem } from '../newRegisters/campaignList';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type CallLogsToolbarProps = {
  title?: string;
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
  /** Campaign chips/options. Callers get only login-assigned IDs. */
  campaigns?: CampaignItem[];
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCampaignChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onApply: () => void;
  onRefresh: () => void;
  onDialerCall: () => void;
  onUpload: (file?: File | null) => void;
  onPauseOpen: () => void;
};

export function CallLogsToolbar({
  title = 'Filters & Actions',
  startDate,
  endDate,
  campaignId,
  itemsPerPage,
  total,
  loading,
  actionLoading,
  fileRef,
  isCaller = false,
  campaigns = CAMPAIGN_LIST,
  onStartDateChange,
  onEndDateChange,
  onCampaignChange,
  onItemsPerPageChange,
  onApply,
  onRefresh,
  onDialerCall,
  onUpload,
  onPauseOpen,
}: CallLogsToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        mb: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
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
          <Chip
            size="small"
            label={`Total: ${total.toLocaleString()}`}
            sx={{
              height: 24,
              fontWeight: 700,
              color: '#c77a18',
              bgcolor: 'rgba(255,159,10,0.12)',
              border: '1px solid rgba(255,159,10,0.35)',
            }}
          />
          {!open ? (
            <Chip
              size="small"
              label={`${startDate} → ${endDate}`}
              variant="outlined"
              sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 24 }}
            />
          ) : null}
          {(loading || actionLoading) && <CircularProgress size={18} />}
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
            aria-label={open ? 'Collapse filters and actions' : 'Expand filters and actions'}
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
            spacing={1}
            alignItems="center"
            sx={{
              minWidth: 0,
              maxWidth: '100%',
              overflowX: 'auto',
              pt: 1,
              pb: 0.25,
              '& .MuiButton-root': {
                whiteSpace: 'nowrap',
                minWidth: 'max-content',
              },
            }}
          >
            <TextField
              type="date"
              label="From Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              sx={{ width: 130, flexShrink: 0 }}
            />
            <TextField
              type="date"
              label="To Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              sx={{ width: 130, flexShrink: 0 }}
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
              onClick={onDialerCall}
              disabled={loading || actionLoading}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            >
              Dialer Call
            </Button>
            <TextField
              select
              label="Campaign List"
              size="small"
              value={campaignId}
              onChange={(e) => onCampaignChange(e.target.value)}
              sx={{ width: 155, flexShrink: 0 }}
            >
              <MenuItem value="">
                <em>Select campaign</em>
              </MenuItem>
              {campaigns.map((c) => (
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
              sx={{ width: 112, flexShrink: 0 }}
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
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
