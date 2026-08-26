/**
 * Admin LLM Chat widget — port of admin-panel-domains AdminLlmChatWidget.
 * Floating AppBar icon → modal Assistant (gated by Admin_LLM_Chatbot).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import { toast } from 'react-toastify';
import {
  CAMPAIGN_LIST,
  LLM_CHAT_HISTORY_KEY,
  LLM_CHAT_OPEN_KEY,
  collectUserIds,
  columnsFromRows,
  formatLlmCell,
  getListIdForCampaign,
  historyForApi,
  looksLikeUsersTable,
  normalizeDialerLeads,
  parseLlmSendResult,
  rowsFromLlmPayload,
  type LlmChatMessage,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { canUseAdminLlmChat, getSessionUser } from '@/auth/permissions';

function loadStoredMessages(): LlmChatMessage[] {
  try {
    const raw = sessionStorage.getItem(LLM_CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function ResultTable({
  rows,
  collection,
  extraIds,
}: {
  rows: Record<string, unknown>[];
  collection?: string;
  extraIds?: string[];
}) {
  const [dialerLoading, setDialerLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const columns = columnsFromRows(rows);
  const showAddToDialer = looksLikeUsersTable(rows, collection);
  const admin = getSessionUser();

  const addToDialer = async () => {
    if (!selectedCampaignId) {
      toast.error('Please select a Campaign ID');
      return;
    }
    const userIds = Array.from(
      new Set([...collectUserIds(rows), ...(extraIds || [])]),
    );
    if (userIds.length === 0) {
      toast.error('No user IDs found in this result');
      return;
    }

    setDialerLoading(true);
    try {
      const res = await secureApi('users.getDialerDataByIds', { userIds });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load dialer leads');
        return;
      }
      const leads = normalizeDialerLeads(res.data);
      if (!leads.length) {
        toast.error('No dialer leads found for selected users');
        return;
      }
      const campaignMeta = CAMPAIGN_LIST.find(
        (item) => String(item.id).trim() === selectedCampaignId,
      );
      const dialerRes = await secureApi('callLogs.externalDialerBatch', {
        campaignId: selectedCampaignId,
        leads,
        serverId: campaignMeta?.serverId ?? String(admin?.serverId ?? ''),
        listId: getListIdForCampaign(selectedCampaignId),
        listName:
          campaignMeta?.name ||
          `${String(admin?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
      });
      if (!dialerRes.ok) {
        toast.error(dialerRes.message || 'Failed to push to dialer');
        return;
      }
      toast.success(dialerRes.message || `Pushed ${leads.length} leads to dialer`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push to dialer');
    } finally {
      setDialerLoading(false);
    }
  };

  return (
    <Box sx={{ width: 1 }}>
      {showAddToDialer && (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 1 }}
        >
          <Select
            size="small"
            displayEmpty
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(String(e.target.value))}
            disabled={dialerLoading}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: '#fff',
                  color: '#0f172a',
                  maxHeight: 360,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
                  '& .MuiMenuItem-root': {
                    color: '#0f172a',
                    fontSize: 13,
                  },
                  '& .MuiMenuItem-root.Mui-selected': {
                    bgcolor: '#e2e8f0',
                    color: '#0f172a',
                  },
                  '& .MuiMenuItem-root:hover': {
                    bgcolor: '#f1f5f9',
                  },
                  '& .MuiMenuItem-root.Mui-selected:hover': {
                    bgcolor: '#cbd5e1',
                  },
                },
              },
            }}
            sx={{
              minWidth: 220,
              maxWidth: 320,
              bgcolor: '#fff',
              fontSize: 13,
              color: '#0f172a',
              '& .MuiSelect-select': { color: '#0f172a' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
              '& .MuiSvgIcon-root': { color: '#0f172a' },
            }}
          >
            <MenuItem value="">
              <em style={{ color: '#64748b' }}>Select Campaign ID</em>
            </MenuItem>
            {CAMPAIGN_LIST.map((item) => (
              <MenuItem key={item.id} value={String(item.id).trim()}>
                {String(item.id).trim()} - {item.name}
              </MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="contained"
            onClick={() => void addToDialer()}
            disabled={dialerLoading || !selectedCampaignId}
            sx={{
              bgcolor: '#0f172a',
              color: '#f8fafc',
              '&:hover': { bgcolor: '#1e293b' },
              '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#f8fafc' },
            }}
          >
            {dialerLoading ? 'Pushing…' : 'Add to dialer'}
          </Button>
        </Stack>
      )}
      <Box
        sx={{
          maxHeight: 'min(62vh, 640px)',
          overflow: 'auto',
          borderRadius: 2,
          border: '1px solid #e2e8f0',
        }}
      >
        <Table size="small" stickyHeader sx={{ color: '#0f172a' }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col}
                  sx={{ bgcolor: '#0f172a', color: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx} hover sx={{ bgcolor: idx % 2 === 1 ? '#f8fafc' : '#fff' }}>
                {columns.map((col) => (
                  <TableCell
                    key={col}
                    title={formatLlmCell(row[col])}
                    sx={{
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#0f172a',
                      borderColor: '#e2e8f0',
                    }}
                  >
                    {formatLlmCell(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

function MessageBody({
  content,
  role,
  safeData,
  collection,
}: {
  content: string;
  role: LlmChatMessage['role'];
  safeData?: unknown;
  collection?: string;
}) {
  if (role === 'assistant') {
    const rows = rowsFromLlmPayload(content, safeData);
    if (rows && rows.length > 0) {
      const trimmed = content.trim();
      const contentIsJson = trimmed.startsWith('{') || trimmed.startsWith('[');
      return (
        <Stack spacing={1}>
          {!contentIsJson && trimmed ? (
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#0f172a' }}
            >
              {content}
            </Typography>
          ) : null}
          <ResultTable
            rows={rows}
            collection={collection}
            extraIds={collectUserIds(
              Array.isArray(safeData) ? (safeData as Record<string, unknown>[]) : [],
            )}
          />
        </Stack>
      );
    }
  }
  return (
    <Typography
      variant="body2"
      sx={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: role === 'user' ? '#fff' : '#0f172a',
      }}
    >
      {content}
    </Typography>
  );
}

export function AdminLlmChatWidget() {
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(
    () => sessionStorage.getItem(LLM_CHAT_OPEN_KEY) === '1',
  );
  const [messages, setMessages] = useState<LlmChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);

  const hasAccess = canUseAdminLlmChat();

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordingMs(0);
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    sessionStorage.setItem(LLM_CHAT_OPEN_KEY, open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    sessionStorage.setItem(LLM_CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) return;
    if (!mediaRecorderRef.current && !mediaStreamRef.current) return;
    cancelRecordingRef.current = true;
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        stopMediaTracks();
      }
    } catch {
      stopMediaTracks();
    }
    setRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recording) {
          e.preventDefault();
          void toggleRecording();
          return;
        }
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recording]);

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    sessionStorage.removeItem(LLM_CHAT_HISTORY_KEY);
  };

  const appendAssistantFromPayload = (payload: ReturnType<typeof parseLlmSendResult>, fallback: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: payload?.answer || payload?.validationError || fallback,
        refused: payload?.refused,
        safeData: payload?.safeData,
        collection: payload?.collection,
      },
    ]);
  };

  const sendVoiceBlob = async (blob: Blob) => {
    const history = historyForApi(messages);
    const pendingId = `voice-pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: '🎤 Transcribing…', _pendingVoiceId: pendingId },
    ]);
    setLoading(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const mime = blob.type || 'audio/webm';
      const ext = mime.includes('ogg')
        ? 'ogg'
        : mime.includes('mp4') || mime.includes('m4a')
          ? 'm4a'
          : 'webm';
      const res = await secureApi('llmChat.sendVoice', {
        audioBase64,
        mimeType: mime,
        fileName: `voice.${ext}`,
        history,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to send voice message');
        setMessages((prev) => [
          ...prev.filter((m) => m._pendingVoiceId !== pendingId),
          {
            role: 'assistant',
            content: 'Sorry, something went wrong with the voice request.',
          },
        ]);
        return;
      }
      const payload = parseLlmSendResult(res.data);
      const transcript = String(payload?.transcript || '').trim() || 'Voice message';
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m._pendingVoiceId !== pendingId);
        return [
          ...withoutPending,
          { role: 'user', content: transcript },
          {
            role: 'assistant',
            content: payload?.answer || payload?.validationError || 'No response',
            refused: payload?.refused,
            safeData: payload?.safeData,
            collection: payload?.collection,
          },
        ];
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send voice message');
      setMessages((prev) => [
        ...prev.filter((m) => m._pendingVoiceId !== pendingId),
        {
          role: 'assistant',
          content: 'Sorry, something went wrong with the voice request.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (loading) return;

    if (recording) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        setRecording(false);
        stopMediaTracks();
      }
      return;
    }

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording is not supported in this environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        toast.error('Recording failed');
        setRecording(false);
        stopMediaTracks();
      };
      recorder.onstop = async () => {
        setRecording(false);
        const chunks = audioChunksRef.current;
        const type = recorder.mimeType || 'audio/webm';
        const cancelled = cancelRecordingRef.current;
        cancelRecordingRef.current = false;
        stopMediaTracks();
        if (cancelled) return;
        if (!chunks.length) {
          toast.error('No audio captured. Try again.');
          return;
        }
        await sendVoiceBlob(new Blob(chunks, { type }));
      };

      recorder.start(250);
      recordStartedAtRef.current = Date.now();
      setRecordingMs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordStartedAtRef.current);
      }, 200);
      setRecording(true);
    } catch (err) {
      const denied =
        err instanceof DOMException && err.name === 'NotAllowedError';
      toast.error(denied ? 'Microphone permission denied' : 'Could not access microphone');
      stopMediaTracks();
      setRecording(false);
    }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || recording) return;
    setInput('');
    const history = historyForApi(messages);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await secureApi('llmChat.send', { message: text, history });
      if (!res.ok) {
        toast.error(res.message || 'Failed to send message');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          },
        ]);
        return;
      }
      appendAssistantFromPayload(parseLlmSendResult(res.data), 'No response');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, recording, messages]);

  if (!hasAccess) return null;

  const timerLabel = `${String(Math.floor(recordingMs / 60000)).padStart(2, '0')}:${String(
    Math.floor((recordingMs % 60000) / 1000),
  ).padStart(2, '0')}`;

  return (
    <>
      <IconButton
        color="inherit"
        title="Admin Assistant"
        aria-label="Admin Assistant"
        onClick={() => setOpen(true)}
      >
        <SmartToyOutlinedIcon />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            width: 'min(1440px, 96vw)',
            height: 'min(92vh, 980px)',
            maxHeight: '92vh',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#fff',
            color: '#0f172a',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            bgcolor: '#0f172a',
            color: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <SmartToyOutlinedIcon fontSize="small" />
            <Typography fontWeight={600} fontSize={15}>
              Admin Assistant
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={startNewChat}
              disabled={loading}
              title="New chat"
              sx={{ color: '#e2e8f0' }}
            >
              <AddCommentOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              title="Close"
              sx={{ color: '#e2e8f0' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent
          sx={{
            p: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative',
            bgcolor: '#f8fafc',
          }}
        >
          <Box
            ref={listRef}
            sx={{ flex: 1, overflowY: 'auto', px: 2.25, py: 2, minHeight: 0 }}
          >
            {messages.length === 0 && (
              <Typography
                color="text.secondary"
                sx={{ textAlign: 'center', py: 6, px: 3, fontSize: 14, lineHeight: 1.5 }}
              >
                Ask in English or Hindi about deposits, withdrawals, users, offices, callers,
                roles, or wallet metrics — type or use the mic. Sensitive customer data is
                masked.
              </Typography>
            )}
            {messages.map((m, idx) => {
              const withTable =
                m.role === 'assistant' &&
                Array.isArray(m.safeData) &&
                (m.safeData as unknown[]).length > 0;
              return (
                <Box
                  key={`${m.role}-${idx}-${m._pendingVoiceId || ''}`}
                  sx={{
                    maxWidth: withTable ? 'min(96%, 1100px)' : m.role === 'user' ? '78%' : '100%',
                    width: m.role === 'assistant' ? '100%' : undefined,
                    ml: m.role === 'user' ? 'auto' : 0,
                    mr: m.role === 'assistant' ? 'auto' : 0,
                    mb: 1.5,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2,
                    borderBottomRightRadius: m.role === 'user' ? 1 : 2,
                    borderBottomLeftRadius: m.role === 'assistant' ? 1 : 2,
                    bgcolor:
                      m.role === 'user'
                        ? '#1e293b'
                        : m.refused
                          ? '#fffbeb'
                          : '#fff',
                    color: m.role === 'user' ? '#fff' : '#0f172a',
                    border: m.role === 'assistant' ? '1px solid' : 'none',
                    borderColor: m.refused ? '#f59e0b' : '#e2e8f0',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <MessageBody
                    content={m.content}
                    role={m.role}
                    safeData={m.safeData}
                    collection={m.collection}
                  />
                </Box>
              );
            })}
            {loading && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  bgcolor: '#fff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <CircularProgress size={16} />
              </Box>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-end"
            sx={{
              px: 1.75,
              py: 1.5,
              borderTop: '1px solid #e2e8f0',
              bgcolor: '#fff',
              flexShrink: 0,
            }}
          >
            <TextField
              multiline
              minRows={3}
              maxRows={6}
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                recording
                  ? 'Listening… click stop when done'
                  : 'Ask a question (English or Hindi)…'
              }
              disabled={loading || recording}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#fff',
                  color: '#0f172a',
                },
                '& .MuiInputBase-input': { color: '#0f172a' },
              }}
            />
            <IconButton
              color={recording ? 'error' : 'default'}
              onClick={() => void toggleRecording()}
              disabled={loading}
              title={recording ? 'Stop recording' : 'Ask by voice'}
              sx={{
                color: recording ? undefined : '#0f172a',
                ...(recording
                  ? {
                      animation: 'llmMicPulse 1.2s ease-in-out infinite',
                      '@keyframes llmMicPulse': {
                        '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                        '50%': { transform: 'scale(1.08)', opacity: 0.85 },
                      },
                    }
                  : {}),
              }}
            >
              {recording ? <StopIcon /> : <MicIcon />}
            </IconButton>
            <IconButton
              color="primary"
              onClick={() => void send()}
              disabled={loading || recording || !input.trim()}
            >
              <SendIcon />
            </IconButton>
          </Stack>

          {recording && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                bgcolor: 'transparent',
              }}
            >
              <Stack
                alignItems="center"
                spacing={2}
                sx={{
                  pointerEvents: 'auto',
                  width: 'min(420px, 92%)',
                  px: 3,
                  py: 3.5,
                  borderRadius: 3,
                  background:
                    'linear-gradient(165deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                  color: '#f8fafc',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                  }}
                >
                  Listening…
                </Typography>
                <Typography
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  {timerLabel}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                  Click stop when you&apos;re done speaking
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={() => void toggleRecording()}
                  sx={{ borderRadius: 999, minWidth: 132, fontWeight: 600 }}
                >
                  Stop
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
