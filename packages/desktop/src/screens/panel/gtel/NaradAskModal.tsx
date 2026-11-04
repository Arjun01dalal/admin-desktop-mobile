/**
 * Narad Ask — question modal for Caller Dashboard.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { toast } from 'react-toastify';
import { buildNaradAskPayload, extractNaradAskAnswer } from '@astro/shared/naradAsk';
import { secureApi } from '@/api/secureClient';
import { getRoleName, getSessionUser } from '@/auth/permissions';
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';
import { NaradAskAnswer } from './NaradAskAnswer';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NaradAskModal({ open, onClose }: Props) {
  const session = useMemo(() => getSessionUser(), [open]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuestion('');
    setAnswer('');
    setLoading(false);
  }, [open]);

  const askUser = useMemo(() => {
    const id = String(session?._id || session?.name || session?.mobile || '').trim();
    const role = getRoleName(session) || 'admin';
    return { id: id || 'admin', name: String(session?.name || id || 'admin'), role };
  }, [session]);

  const onSubmit = async () => {
    const q = question.trim();
    if (!q) {
      toast.error('Enter a question');
      return;
    }
    setLoading(true);
    setAnswer('');
    try {
      const payload = buildNaradAskPayload(q, askUser);
      const res = await secureApi('gtel.naradAsk', payload);
      if (!res.ok) {
        toast.error(res.message || 'Ask failed');
        setAnswer(res.message || 'Ask failed');
        return;
      }
      setAnswer(extractNaradAskAnswer(res.data ?? res));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ask failed';
      toast.error(msg);
      setAnswer(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !loading && onClose()}
      fullWidth
      maxWidth="md"
      aria-labelledby="narad-ask-title"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle id="narad-ask-title" sx={{ pb: 1, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <AutoAwesomeIcon sx={{ color: '#ff9f0a' }} />
          <Box>
            <Typography fontWeight={800} fontSize={18}>
              Ask AI
            </Typography>
            <Typography variant="body2" color="text.secondary">
              As {askUser.name} · {askUser.role}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5, overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
        <TextField
          label="Question"
          placeholder="e.g. withdrawal approval rate per caller last 30 days"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          autoFocus
          disabled={loading}
          sx={{ ...fieldSx, mt: 1 }}
        />
        {loading ? (
          <Stack alignItems="center" py={3} gap={1}>
            <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
            <Typography color="text.secondary" fontWeight={600} fontSize={13}>
              Asking AI…
            </Typography>
          </Stack>
        ) : null}
        {answer && !loading ? <NaradAskAnswer answer={answer} /> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexShrink: 0 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Close
        </Button>
        <Box flex={1} />
        <Button
          variant="contained"
          disabled={loading || !question.trim()}
          onClick={() => void onSubmit()}
          startIcon={<AutoAwesomeIcon />}
          sx={orangeBtnSx}
        >
          {loading ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
