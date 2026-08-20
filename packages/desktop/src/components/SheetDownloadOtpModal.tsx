/**
 * OTP gate before any sheet download.
 * Send: SubAdmin/send-verification-otp (users.sendBlockOtp)
 * Verify: User/verifyOtp-walletToWallet (users.verifyBlockOtp)
 * After verify: reports.sheetDownloadAuditCreate then onVerified().
 */
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { ApiResult } from '@astro/shared';
import { getSessionUser } from '@/auth/permissions';
import { apiFailed } from '@/screens/panel/kyc/types';
import type { SaveWorkbookResult } from '@/utils/downloadSheet';
import {
  logSheetDownload,
  type SheetDownloadFilter,
} from '@/utils/sheetDownloadAudit';

type Props = {
  open: boolean;
  filter: SheetDownloadFilter;
  onClose: () => void;
  onVerified: () => void | Promise<void | SaveWorkbookResult>;
};

let autoSendPromise: Promise<ApiResult> | null = null;
let autoSendMobile = '';
let autoSendOkAt = 0;
const AUTO_SEND_OK_TTL_MS = 8_000;

function resolveRegisteredMobile(): string {
  const fromUser = String(getSessionUser()?.mobile || '').trim();
  if (fromUser) return fromUser;
  return String(localStorage.getItem('mobile') || '').trim();
}

export function SheetDownloadOtpModal({ open, filter, onClose, onVerified }: Props) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [mobile, setMobile] = useState('');
  const [readyToSave, setReadyToSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!open) {
      setOtp('');
      setSent(false);
      setSending(false);
      setVerifying(false);
      setReadyToSave(false);
      setSaving(false);
      setMobile('');
      return;
    }

    const target = resolveRegisteredMobile();
    setMobile(target);
    if (!target) {
      toast.error('Registered mobile not found on this session');
      onClose();
      return;
    }

    let alive = true;

    const applySendResult = (res: ApiResult) => {
      if (!alive) return;
      if (apiFailed(res)) {
        autoSendOkAt = 0;
        toast.error(res.message || 'Failed to send OTP');
        onClose();
        return;
      }
      autoSendMobile = target;
      autoSendOkAt = Date.now();
      setSent(true);
    };

    (async () => {
      if (autoSendPromise && autoSendMobile === target) {
        setSending(true);
        try {
          const res = await autoSendPromise;
          applySendResult(res);
        } finally {
          if (alive) setSending(false);
        }
        return;
      }

      if (
        autoSendMobile === target &&
        Date.now() - autoSendOkAt < AUTO_SEND_OK_TTL_MS
      ) {
        setSent(true);
        setSending(false);
        return;
      }

      setSending(true);
      autoSendMobile = target;
      autoSendPromise = secureApi('users.sendBlockOtp', { mobile: target });
      try {
        const res = await autoSendPromise;
        applySendResult(res);
      } finally {
        autoSendPromise = null;
        if (alive) setSending(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resend = async () => {
    const target = mobile || resolveRegisteredMobile();
    if (!target) return;
    setSending(true);
    try {
      const res = await secureApi('users.sendBlockOtp', { mobile: target });
      if (apiFailed(res)) {
        toast.error(res.message || 'Failed to resend OTP');
        return;
      }
      autoSendMobile = target;
      autoSendOkAt = Date.now();
      setSent(true);
      toast.success('OTP sent');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    const target = mobile || resolveRegisteredMobile();
    if (!target) {
      toast.error('Registered mobile not found on this session');
      return;
    }
    const code = otp.trim();
    if (code.length !== 4) {
      toast.error('OTP must be 4 digits');
      return;
    }
    setVerifying(true);
    try {
      const res = await secureApi('users.verifyBlockOtp', {
        mobile: target,
        otp: Number(code),
      });
      if (apiFailed(res)) {
        toast.error(res.message || 'Invalid OTP');
        return;
      }
      logSheetDownload(filter);
      toast.success('OTP Verified');
      setReadyToSave(true);
    } finally {
      setVerifying(false);
    }
  };

  const downloadSheet = async () => {
    setSaving(true);
    try {
      const result = await Promise.resolve(onVerifiedRef.current?.());
      if (result === 'canceled' || result === 'error') return;
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setSaving(false);
    }
  };

  const masked = mobile.length >= 4 ? `xxxxxx${mobile.slice(-4)}` : mobile;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Verify OTP to Download</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <Typography variant="body2" color="text.secondary">
            {readyToSave
              ? 'OTP verified. Click Download Sheet to save the Excel file.'
              : `OTP sent to your registered mobile${masked ? ` (${masked})` : ''}.`}
          </Typography>
          {sending && !sent ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Sending OTP…</Typography>
            </Stack>
          ) : readyToSave ? null : (
            <TextField
              autoFocus
              size="small"
              value={otp}
              placeholder="Enter 4-digit OTP"
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              inputProps={{
                inputMode: 'numeric',
                maxLength: 4,
                'aria-label': 'OTP',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void verify();
              }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={verifying || saving}>
          Cancel
        </Button>
        {readyToSave ? (
          <Button
            variant="contained"
            color="warning"
            onClick={() => void downloadSheet()}
            disabled={saving}
            sx={{ fontWeight: 700 }}
          >
            {saving ? 'Saving…' : 'Download Sheet'}
          </Button>
        ) : (
          <>
            <Button onClick={() => void resend()} disabled={sending || verifying}>
              Resend
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => void verify()}
              disabled={verifying || (sending && !sent) || otp.trim().length !== 4}
              sx={{ fontWeight: 700 }}
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
