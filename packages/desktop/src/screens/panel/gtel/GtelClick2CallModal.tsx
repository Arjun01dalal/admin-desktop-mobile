/**
 * Active Call dock UI — logic lives in useGtelActiveCall.
 */
import { useState, type ReactNode } from 'react';

import { UserReportModal } from '@/screens/panel/userReport/UserReportModal';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CloseIcon from '@mui/icons-material/Close';
import CallIcon from '@mui/icons-material/Call';
import {
  formatGtelBalanceDisplay,
  formatGtelCallElapsed,
  formatPreviousNoteCallAt,
  isGreenDisposition,
  isNegativeGtelBalance,
  type GtelC2cTarget,
} from '@astro/shared';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { useGtelActiveCall } from './useGtelActiveCall';
import { GTEL_Z } from './gtelOverlayZIndex';


type Props = {
  target: GtelC2cTarget;
  onClose: () => void;
  onEnded?: () => void;
};

function MetaRow({
  label,
  value,
  danger,
  onClick,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontSize={9} color="text.secondary" fontWeight={700} letterSpacing={0.3}>
        {label}
      </Typography>
      <Typography
        fontSize={11}
        fontWeight={700}
        noWrap
        onClick={onClick}
        sx={{
          color: danger ? 'error.main' : onClick ? 'primary.main' : 'text.primary',
          cursor: onClick ? 'pointer' : 'default',
          textDecoration: onClick ? 'underline' : 'none',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function GtelClick2CallModal({ target, onClose, onEnded }: Props) {
  const call = useGtelActiveCall({ target, onClose, onEnded });
  const [reportOpen, setReportOpen] = useState(false);
  const showHangupForm = call.phase === 'hangupForm';
  const live = Boolean(call.callId) && call.phase !== 'ended';

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: GTEL_Z.dock,
          width: showHangupForm ? 360 : 300,
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          transition: 'width 160ms ease',
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
            borderBottom: showHangupForm ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: call.phase === 'ended' ? '#94a3b8' : call.statusTone,
              boxShadow:
                call.phase === 'ended' ? undefined : `0 0 0 3px ${call.statusTone}33`,
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} fontSize={12} noWrap>
              {call.phase === 'ended' ? 'Call ended' : 'Active Call'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.2 }}
              noWrap
            >
              {call.phase === 'dialing'
                ? 'Connecting…'
                : `${call.phoneDisplay} · ${formatGtelCallElapsed(call.elapsed)}`}
            </Typography>
          </Box>

          {call.phase === 'dialing' ? <CircularProgress size={18} /> : null}

          {live && call.phase === 'redial' && !call.disableRedial ? (
            <Tooltip title="Redial">
              <span>
                <IconButton
                  size="small"
                  color="secondary"
                  disabled={call.redialing}
                  onClick={() => void call.redial()}
                  sx={{ bgcolor: 'rgba(124,58,237,0.15)' }}
                >
                  {call.redialing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <CallIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}

          {live && call.phase !== 'redial' ? (
            <Tooltip title="Hang up">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={call.hangingUp}
                  onClick={call.openHangupForm}
                  sx={{
                    bgcolor: showHangupForm ? 'error.main' : 'rgba(239,68,68,0.15)',
                    color: showHangupForm ? '#fff' : 'error.main',
                    '&:hover': {
                      bgcolor: showHangupForm ? 'error.dark' : 'rgba(239,68,68,0.28)',
                    },
                  }}
                >
                  <CallEndIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}

          {call.phase === 'ended' || (!call.callId && call.phase !== 'dialing') ? (
            <IconButton size="small" onClick={call.close} sx={{ ml: 0.25 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>

        {live ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.75,
              px: 1.25,
              pt: 1,
              pb: showHangupForm ? 0.5 : 1,
            }}
          >
            <MetaRow
              label="DP ID"
              value={call.dpId || '—'}
              onClick={call.dpId ? () => setReportOpen(true) : undefined}
            />
            <MetaRow label="CX Name" value={call.cxName} />
            <MetaRow
              label="Balance"
              value={formatGtelBalanceDisplay(call.balanceRaw)}
              danger={isNegativeGtelBalance(call.balanceRaw)}
            />
            <MetaRow
              label="Bonus Balance"
              value={formatGtelBalanceDisplay(call.bonusRaw)}
              danger={isNegativeGtelBalance(call.bonusRaw)}
            />
          </Box>
        ) : null}

        {showHangupForm && live ? (
          <Stack spacing={1.25} sx={{ p: 1.5, pt: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontSize={11} color="text.secondary" fontWeight={700}>
                {call.statusLabel}
                {call.extension && call.extension !== '—' ? ` · Ext ${call.extension}` : ''}
              </Typography>
              <Button
                size="small"
                onClick={call.closeHangupForm}
                disabled={call.hangingUp}
                sx={{ minWidth: 0, textTransform: 'none', fontSize: 11 }}
              >
                Cancel
              </Button>
            </Stack>

            {call.previousNote?.text || call.previousNote?.callAt ? (
              <Box
                sx={{
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                }}
              >
                <Typography fontSize={10} color="text.secondary" fontWeight={700}>
                  Previous note
                </Typography>
                {call.previousNote.text ? (
                  <Typography fontSize={11} sx={{ wordBreak: 'break-word' }}>
                    {call.previousNote.text}
                  </Typography>
                ) : null}
                {call.previousNote.callAt ? (
                  <Typography fontSize={10} color="text.secondary">
                    {formatPreviousNoteCallAt(call.previousNote.callAt)}
                  </Typography>
                ) : null}
              </Box>
            ) : null}

            <TextField
              select
              size="small"
              fullWidth
              label="Disposition *"
              value={call.disposition}
              disabled={call.dispLoading || call.hangingUp}
              onChange={(e) => call.setDisposition(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={
                call.dispLoading
                  ? 'Loading…'
                  : call.dispositions.length
                    ? undefined
                    : 'No dispositions loaded'
              }
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => {
                  const value = String(selected || '');
                  if (!value) {
                    return (
                      <Box component="span" sx={{ color: 'text.secondary', opacity: 0.85 }}>
                        {call.dispLoading
                          ? 'Loading…'
                          : call.dispositions.length
                            ? 'Select disposition'
                            : 'No dispositions'}
                      </Box>
                    );
                  }
                  return (
                    <Box
                      component="span"
                      sx={{
                        fontWeight: isGreenDisposition(value) ? 700 : 600,
                        color: isGreenDisposition(value)
                          ? (t) => (t.palette.mode === 'dark' ? '#6ee7b7' : '#047857')
                          : 'text.primary',
                      }}
                    >
                      {value}
                    </Box>
                  );
                },
                MenuProps: {
                  disablePortal: false,
                  style: { zIndex: GTEL_Z.dockMenu },
                  PaperProps: { style: { zIndex: GTEL_Z.dockMenu, maxHeight: 280 } },
                  sx: { zIndex: GTEL_Z.dockMenu },
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: isGreenDisposition(call.disposition)
                    ? (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(52,211,153,0.16)'
                          : 'rgba(16,185,129,0.12)'
                    : undefined,
                },
                '& .MuiSelect-select': {
                  display: 'flex',
                  alignItems: 'center',
                  pr: '32px !important',
                },
                '& .MuiSelect-nativeInput': { display: 'none' },
              }}
            >
              <MenuItem value="" disabled>
                <em>
                  {call.dispLoading
                    ? 'Loading…'
                    : call.dispositions.length
                      ? 'Select disposition'
                      : 'No dispositions'}
                </em>
              </MenuItem>
              {call.dispositions.map((item) => (
                <MenuItem
                  key={item}
                  value={item}
                  sx={
                    isGreenDisposition(item)
                      ? {
                          fontWeight: 700,
                          color: (t) => (t.palette.mode === 'dark' ? '#6ee7b7' : '#047857'),
                          '&.Mui-selected, &.Mui-focusVisible, &:hover': {
                            color: (t) => (t.palette.mode === 'dark' ? '#a7f3d0' : '#065f46'),
                          },
                        }
                      : undefined
                  }
                >
                  {item}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label="Note (optional)"
              value={call.notes}
              disabled={call.hangingUp}
              onChange={(e) => call.setNotes(e.target.value)}
            />
            <TextField
              size="small"
              fullWidth
              type="datetime-local"
              label="Callback (optional, IST)"
              value={call.callbackDueAt}
              disabled={call.hangingUp}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => call.setCallbackDueAt(e.target.value)}
            />

            <Button
              variant="contained"
              color="error"
              fullWidth
              startIcon={
                call.hangingUp ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <CallEndIcon />
                )
              }
              disabled={call.hangingUp || call.dispLoading || !call.disposition}
              onClick={() => void call.hangUp()}
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              {call.hangingUp ? 'Hanging up…' : 'Confirm Hang Up'}
            </Button>
          </Stack>
        ) : null}

        {!showHangupForm && live ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', px: 1.25, pb: 1, pt: 0 }}
            noWrap
          >
            {call.statusLabel}
            {call.callId ? ` · ${call.callId}` : ''}
          </Typography>
        ) : null}
      </Paper>

      <UserReportModal
        open={reportOpen && Boolean(call.dpId)}
        userId={call.dpId}
        userName={call.cxName !== '—' ? call.cxName : call.dpId}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
