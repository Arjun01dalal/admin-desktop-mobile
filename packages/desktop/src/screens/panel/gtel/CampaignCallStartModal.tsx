/**
 * Campaign Call Start — bottom-right dock (Active Call parity).
 * Preview next lead → Call → shell Active Call dock (hangup → disposition/note/callback).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import CallIcon from '@mui/icons-material/Call';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  extractC2cNextCampaignCall,
  formatGtelBalanceDisplay,
  isNegativeGtelBalance,
  maskGtelPhone,
  type C2cNextCampaignCall,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { formatDisplayDate } from '@/utils/dates';
import { UserReportModal } from '@/screens/panel/userReport/UserReportModal';
import { useGtelAuth } from './useGtelAuth';
import { useGtelCallSession } from './GtelCallSession';
import { GtelBusyDock } from './GtelBusyDock';
import { GTEL_Z } from './gtelOverlayZIndex';

type Props = {
  open: boolean;
  onClose: () => void;
  canShowMobile: boolean;
  onCalled?: () => void;
};

function pickSnapBalance(
  next: C2cNextCampaignCall | null,
  keys: string[],
): string | number | undefined {
  const raw = next?.raw;
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const snap =
    (row.snapshot as Record<string, unknown> | undefined) ||
    (row.userSnapshot as Record<string, unknown> | undefined) ||
    (row.user as Record<string, unknown> | undefined) ||
    row;
  for (const key of keys) {
    const v = snap[key] ?? row[key];
    if (v != null && String(v).trim() !== '') return v as string | number;
  }
  return undefined;
}

export function CampaignCallStartModal({
  open,
  onClose,
  canShowMobile,
  onCalled,
}: Props) {
  const { canShowC2c } = useGtelAuth();
  const { startC2c, callingPhone } = useGtelCallSession();
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<C2cNextCampaignCall | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

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
      setReportOpen(false);
      return;
    }
    void loadNext();
  }, [open, loadNext]);

  const busyByActiveCall = Boolean(callingPhone);

  const startDial = async () => {
    if (!next?.phoneNumber || !next.campaignDataId) {
      toast.error('No campaign lead to dial');
      return;
    }
    if (!canShowC2c) {
      toast.error('C2C not available for your account');
      return;
    }
    setCalling(true);
    try {
      const balance = pickSnapBalance(next, [
        'balance',
        'walletBalance',
        'wallet_balance',
      ]);
      const bonusBalance = pickSnapBalance(next, [
        'bonusBalance',
        'bonusWalletBalance',
        'bonus_balance',
      ]);
      const ok = startC2c(
        {
          phoneNumber: next.phoneNumber,
          campaignDataId: next.campaignDataId,
          userId: next.userId || '',
          userName: next.name || '',
          appName: next.appName || '',
          lastActivity: next.lastActivity || '',
          balance,
          bonusBalance,
          source: 'Campaign',
        },
        undefined,
        () => {
          onCalled?.();
          void loadNext();
        },
      );
      if (!ok) toast.error('Call could not be initiated');
      else onClose();
    } finally {
      setCalling(false);
    }
  };

  const openAuth = () => {
    const url = String(next?.authUrl || '').trim();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const phoneDisplay = next
    ? maskGtelPhone(next.phoneNumber, canShowMobile)
    : '—';
  const cxName = String(next?.name || '').trim() || '—';
  const dpId = String(next?.userId || '').trim();
  const balanceRaw = pickSnapBalance(next, ['balance', 'walletBalance', 'wallet_balance']);
  const bonusRaw = pickSnapBalance(next, [
    'bonusBalance',
    'bonusWalletBalance',
    'bonus_balance',
  ]);

  const metaRow = (
    label: string,
    value: ReactNode,
    opts?: { danger?: boolean; onClick?: () => void },
  ) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontSize={9} color="text.secondary" fontWeight={700} letterSpacing={0.3}>
        {label}
      </Typography>
      <Typography
        fontSize={11}
        fontWeight={700}
        noWrap
        onClick={opts?.onClick}
        sx={{
          color: opts?.danger
            ? 'error.main'
            : opts?.onClick
              ? 'primary.main'
              : 'text.primary',
          cursor: opts?.onClick ? 'pointer' : 'default',
          textDecoration: opts?.onClick ? 'underline' : 'none',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
    </Box>
  );

  if (!open) return null;

  if (busyByActiveCall) {
    return (
      <GtelBusyDock
        title="Call Start paused"
        phoneMasked={callingPhone}
        onClose={onClose}
      />
    );
  }

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: GTEL_Z.dock,
          width: 300,
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 1.25,
            py: 1,
            bgcolor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: '#f59e0b',
              boxShadow: '0 0 0 3px #f59e0b33',
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} fontSize={12} noWrap>
              Call Start
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.2 }}
              noWrap
            >
              {loading ? 'Loading next lead…' : next ? phoneDisplay : error || 'No lead'}
            </Typography>
          </Box>

          {loading ? <CircularProgress size={16} sx={{ mx: 0.5 }} /> : null}

          {next?.authUrl ? (
            <Tooltip title="Auth URL">
              <IconButton size="small" onClick={openAuth}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}

          <Tooltip title={calling ? 'Calling…' : 'Call'}>
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={!next?.phoneNumber || loading || calling || !canShowC2c}
                onClick={() => void startDial()}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#000',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                {calling ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CallIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <IconButton size="small" onClick={onClose} disabled={calling}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {loading && !next ? (
          <Stack alignItems="center" py={2.5}>
            <CircularProgress size={22} />
          </Stack>
        ) : null}

        {!loading && next ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.75,
              px: 1.25,
              pt: 1,
              pb: 1.25,
            }}
          >
            {metaRow(
              'DP ID',
              dpId || '—',
              dpId ? { onClick: () => setReportOpen(true) } : undefined,
            )}
            {metaRow('CX Name', cxName)}
            {metaRow('Balance', formatGtelBalanceDisplay(balanceRaw), {
              danger: isNegativeGtelBalance(balanceRaw),
            })}
            {metaRow('Bonus Balance', formatGtelBalanceDisplay(bonusRaw), {
              danger: isNegativeGtelBalance(bonusRaw),
            })}
            {next.appName ? (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography fontSize={9} color="text.secondary" fontWeight={700}>
                  App · Last activity
                </Typography>
                <Typography fontSize={11} fontWeight={600} noWrap>
                  {next.appName}
                  {next.lastActivity
                    ? ` · ${formatDisplayDate(next.lastActivity) || next.lastActivity}`
                    : ''}
                </Typography>
              </Box>
            ) : null}
          </Box>
        ) : null}

        {!loading && !next ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', px: 1.25, py: 1.5 }}
          >
            {error || 'No calls in queue'}
          </Typography>
        ) : null}
      </Paper>

      <UserReportModal
        open={reportOpen && Boolean(dpId)}
        userId={dpId}
        userName={cxName !== '—' ? cxName : dpId}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
