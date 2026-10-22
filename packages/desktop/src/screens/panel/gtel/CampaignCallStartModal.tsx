import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { formatDisplayDate } from '@/utils/dates';
import CloseIcon from '@mui/icons-material/Close';
import CallIcon from '@mui/icons-material/Call';
import { secureApi } from '@/api/secureClient';
import {
  createGtelCallId,
  extractC2cNextCampaignCall,
  maskGtelPhone,
  type C2cNextCampaignCall,
} from '@astro/shared';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';


type Props = {
  open: boolean;
  onClose: () => void;
  canShowMobile: boolean;
  onCalled?: () => void;
};

export function CampaignCallStartModal({
  open,
  onClose,
  canShowMobile,
  onCalled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<C2cNextCampaignCall | null>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNext(null);
    try {
      const res = await secureApi('campaign.nextCall', {});
      if (!res.ok) {
        setError(res.message || 'No next call available');
        return;
      }
      const parsed = extractC2cNextCampaignCall(res.data);
      if (!parsed) {
        setError('No pending campaign call found');
        return;
      }
      setNext(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load next call');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setNext(null);
      setError(null);
      setCalling(false);
      return;
    }
    void loadNext();
  }, [open, loadNext]);

  const startDial = async () => {
    if (!next?.phoneNumber || !next.campaignDataId) {
      toast.error('No campaign lead to dial');
      return;
    }
    setCalling(true);
    try {
      const callId = createGtelCallId();
      const res = await secureApi('gtel.clickToCall', {
        callId,
        phoneNumber: next.phoneNumber,
        campaignDataId: next.campaignDataId,
        source: 'Campaign',
        userId: next.userId || '',
      });
      if (!res.ok || res.success === false) {
        toast.error(res.message || 'Call could not be initiated');
        return;
      }
      toast.success('Campaign call initiated');
      onCalled?.();
      void loadNext();
    } finally {
      setCalling(false);
    }
  };

  const openAuth = () => {
    const url = String(next?.authUrl || '').trim();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
        Campaign Call Start
        <IconButton
          aria-label="Close"
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Next assigned lead from active C2C campaigns
        </Typography>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {!loading && next ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography fontWeight={800} fontSize={16} sx={{ mb: 0.5 }}>
              {next.name || '—'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {maskGtelPhone(next.phoneNumber, canShowMobile)}
              {next.appName ? ` · ${next.appName}` : ''}
            </Typography>
            {next.userId ? (
              <Typography variant="caption" color="text.secondary" display="block">
                User: {next.userId}
              </Typography>
            ) : null}
            {next.lastActivity ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Last activity: {formatDisplayDate(next.lastActivity) || next.lastActivity}
              </Typography>
            ) : null}
            {next.campaignDataId ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Campaign data: {next.campaignDataId}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {!loading && !next ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            {error || 'No calls in queue'}
          </Typography>
        ) : null}

        {error && next ? (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Close
        </Button>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => void loadNext()}
          disabled={loading || calling}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Refresh
        </Button>
        {next?.authUrl ? (
          <Button
            startIcon={<OpenInNewIcon />}
            onClick={openAuth}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Auth URL
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={
            calling ? <CircularProgress size={14} color="inherit" /> : <CallIcon />
          }
          disabled={!next?.phoneNumber || loading || calling}
          onClick={() => void startDial()}
          sx={orangeBtnSx}
        >
          {calling ? 'Calling…' : 'Call'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
