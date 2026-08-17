import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { copyToClipboard } from '@/utils/clipboard';
import {
  buildChatSummaries,
  formatListTime,
  formatMessageTime,
  formatWhatsappTo,
  getInitials,
  getMessageKey,
  getProfileName,
  groupChats,
  isIncoming,
  normalizePhone,
  sortChats,
} from '@/screens/panel/whatsapp/helpers';
import type {
  GroupedChats,
  WhatsappMessage,
} from '@/screens/panel/whatsapp/types';

const POLL_INTERVAL_MS = 4000;

function unpackMessages(data: unknown): WhatsappMessage[] {
  if (Array.isArray(data)) return data as WhatsappMessage[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested = obj.payload ?? obj.data ?? obj.items;
    if (Array.isArray(nested)) return nested as WhatsappMessage[];
  }
  return [];
}

function Avatar({ name }: { name: string }) {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        bgcolor: '#2a4a3a',
        color: '#daF7f3',
        display: 'grid',
        placeItems: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getInitials(name || '?')}
    </Box>
  );
}

export function WhatsappPage() {
  const [records, setRecords] = useState<GroupedChats | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const fetchWhatsappData = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await secureApi('whatsapp.getCallbacks', {});
      if (!res.ok) {
        if (!silent) toast.error(res.message || 'Failed to load chats');
        return;
      }
      const grouped = sortChats(groupChats(unpackMessages(res.data)));
      setRecords(grouped);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isFetchingRef.current) return;
    setManualRefreshing(true);
    try {
      await fetchWhatsappData(false);
    } finally {
      setManualRefreshing(false);
    }
  }, [fetchWhatsappData]);

  useEffect(() => {
    void fetchWhatsappData(false);
    const poll = () => {
      if (document.visibilityState === 'visible') void fetchWhatsappData(true);
    };
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void fetchWhatsappData(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchWhatsappData]);

  const chatSummaries = useMemo(
    () => (records ? buildChatSummaries(records) : []),
    [records],
  );

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chatSummaries;
    return chatSummaries.filter(
      ({ phone, profileName, preview }) =>
        phone.toLowerCase().includes(query) ||
        profileName.toLowerCase().includes(query) ||
        preview.toLowerCase().includes(query),
    );
  }, [chatSummaries, search]);

  const activeMessages = useMemo(() => {
    if (!selectedUser || !records) return [];
    const key = normalizePhone(selectedUser);
    return records[key] ?? records[selectedUser] ?? [];
  }, [records, selectedUser]);

  const activeProfileName = useMemo(() => {
    if (!selectedUser || !records) return '';
    const key = normalizePhone(selectedUser);
    const messages = records[key] ?? records[selectedUser];
    if (!messages) return '';
    return getProfileName(messages, key);
  }, [records, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;
    requestAnimationFrame(scrollMessagesToBottom);
  }, [selectedUser, scrollMessagesToBottom]);

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if ((!text && !image) || !selectedUser || sending) return;

    setSending(true);
    try {
      const payload = image
        ? {
            to: formatWhatsappTo(selectedUser),
            type: 'image' as const,
            image,
            caption: text,
          }
        : {
            to: formatWhatsappTo(selectedUser),
            type: 'text' as const,
            text,
          };
      const res = await secureApi('whatsapp.sendExotel', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to send message');
        return;
      }
      setMessage('');
      setImage(null);
      toast.success('Message sent');
      void fetchWhatsappData(true);
      requestAnimationFrame(scrollMessagesToBottom);
    } finally {
      setSending(false);
    }
  }, [
    fetchWhatsappData,
    image,
    message,
    selectedUser,
    sending,
    scrollMessagesToBottom,
  ]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result?.toString() ?? null);
    reader.onerror = () => toast.error('Failed to read image');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const renderMessageContent = (msg: WhatsappMessage) => {
    if (msg.content?.type === 'text') {
      return (
        <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>
          {msg.content.text.body}
        </Typography>
      );
    }
    if (msg.content?.type === 'image') {
      const caption = msg.content.image.caption?.trim();
      return (
        <>
          <Box
            component="img"
            src={msg.content.image.s3_url || msg.content.image.url}
            alt={caption || 'Shared'}
            loading="lazy"
            sx={{
              maxWidth: 220,
              maxHeight: 220,
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 1,
              display: 'block',
              mb: caption ? 0.75 : 0,
            }}
          />
          {caption ? (
            <Typography sx={{ fontSize: 14 }}>{caption}</Typography>
          ) : null}
        </>
      );
    }
    if (msg.description) {
      return (
        <Typography sx={{ fontSize: 14 }}>{msg.description}</Typography>
      );
    }
    return null;
  };

  return (
    <Box
      sx={{
        height: 'calc(100dvh - 112px)',
        maxHeight: 'calc(100dvh - 112px)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Typography variant="h5" fontWeight={700} mb={1.5} sx={{ flexShrink: 0 }}>
        Whatsapp
      </Typography>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: selectedUser ? '320px 1fr' : '360px 1fr',
          },
          gridTemplateRows: 'minmax(0, 1fr)',
          overflow: 'hidden',
          bgcolor: '#111116',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Chat list */}
        <Box
          sx={{
            display: { xs: selectedUser ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#15151a',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <Typography fontWeight={700}>Chats</Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                bgcolor: '#1e1e24',
                borderRadius: 1,
              }}
            >
              <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              <InputBase
                fullWidth
                placeholder="Search or start new chat"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ ml: 1, fontSize: 13, py: 0.75 }}
              />
              <IconButton
                size="small"
                aria-label="Refresh chats"
                title="Refresh chats"
                disabled={manualRefreshing}
                onClick={() => void handleRefresh()}
              >
                {manualRefreshing ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshIcon sx={{ fontSize: 19 }} />
                )}
              </IconButton>
            </Paper>
          </Box>
          <List
            dense
            sx={{ overflow: 'auto', flex: 1, minHeight: 0, py: 0 }}
          >
            {filteredChats.length === 0 ? (
              <Typography
                color="text.secondary"
                sx={{ px: 2, py: 3, textAlign: 'center', fontSize: 13 }}
              >
                {records ? 'No chats found' : 'Loading chats...'}
              </Typography>
            ) : (
              filteredChats.map(({ phone, profileName, preview, timestamp }) => (
                <ListItemButton
                  key={phone}
                  selected={selectedUser === phone}
                  onClick={() => setSelectedUser(normalizePhone(phone))}
                  sx={{
                    gap: 1.25,
                    py: 1.25,
                    '&.Mui-selected': { bgcolor: 'rgba(255,159,10,0.12)' },
                  }}
                >
                  <Avatar name={profileName} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography
                        fontWeight={600}
                        fontSize={14}
                        noWrap
                      >
                        {profileName}
                      </Typography>
                      <Typography
                        fontSize={11}
                        color="text.secondary"
                        whiteSpace="nowrap"
                      >
                        {formatListTime(timestamp)}
                      </Typography>
                    </Stack>
                    <Typography
                      fontSize={12}
                      color="text.secondary"
                      noWrap
                    >
                      {preview}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))
            )}
          </List>
        </Box>

        {/* Chat panel */}
        <Box
          sx={{
            display: { xs: selectedUser ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
            bgcolor: '#0f0f12',
          }}
        >
          {selectedUser ? (
            <>
              <Stack
                direction="row"
                alignItems="center"
                gap={1.25}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: '#15151a',
                  flexShrink: 0,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => setSelectedUser(null)}
                  sx={{ display: { md: 'none' } }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Avatar name={activeProfileName} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700} noWrap>
                    {activeProfileName}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      {selectedUser}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        void copyToClipboard(selectedUser, {
                          successMessage: 'Phone number copied',
                        });
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                </Box>
              </Stack>

              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: '1 1 auto',
                  minHeight: 0,
                  overflowX: 'hidden',
                  overflowY: 'auto',
                  px: 2,
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  background:
                    'radial-gradient(ellipse at 20% 0%, #1a2a22 0%, transparent 50%), #0f0f12',
                }}
              >
                {activeMessages.map((msg, index) => {
                  if (msg.callback_type === 'dlr') return null;
                  const incoming = isIncoming(msg);
                  return (
                    <Box
                      key={getMessageKey(msg, index)}
                      sx={{
                        display: 'flex',
                        justifyContent: incoming ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '75%',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: incoming ? '#1f3d32' : '#1e1e28',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {renderMessageContent(msg)}
                        <Typography
                          fontSize={10}
                          color="text.secondary"
                          textAlign="right"
                          mt={0.5}
                        >
                          {formatMessageTime(msg.timestamp)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Stack
                direction="row"
                alignItems="flex-end"
                gap={1}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: '#15151a',
                  flexShrink: 0,
                  zIndex: 2,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AttachFileIcon fontSize="small" />
                </IconButton>
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                {image && (
                  <Box
                    component="img"
                    src={image}
                    alt="Preview"
                    onClick={() => setImage(null)}
                    sx={{
                      width: 44,
                      height: 44,
                      objectFit: 'cover',
                      borderRadius: 1,
                      cursor: 'pointer',
                    }}
                  />
                )}
                <Box
                  component="textarea"
                  rows={1}
                  placeholder="Type a message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  sx={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 2,
                    bgcolor: '#1e1e24',
                    color: '#e8e8ea',
                    px: 1.5,
                    py: 1,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    maxHeight: 100,
                  }}
                />
                <IconButton
                  size="small"
                  disabled={sending || (!message.trim() && !image)}
                  onClick={() => void handleSend()}
                  sx={{
                    bgcolor: '#ff9f0a',
                    color: '#1a1200',
                    '&:hover': { bgcolor: '#e08c00' },
                    '&.Mui-disabled': { bgcolor: '#333', color: '#777' },
                  }}
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </Stack>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                placeItems: 'center',
                color: 'text.secondary',
                px: 3,
                textAlign: 'center',
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700} color="#e8e8ea" mb={1}>
                  WhatsApp Web
                </Typography>
                <Typography fontSize={14}>
                  Select a chat from the list to view messages and delivery
                  status.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
