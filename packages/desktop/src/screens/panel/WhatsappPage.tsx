import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
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
import { useTheme } from '@mui/material/styles';
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
  buildExotelWhatsappSend,
  chatMatchesSelection,
  formatListTime,
  getInitials,
  toApiMobile,
} from '@astro/shared/whatsappInbox';
import { useWhatsappChatList } from '@/screens/panel/whatsapp/useWhatsappChatList';
import { useWhatsappThread } from '@/screens/panel/whatsapp/useWhatsappThread';
import { WhatsappChatErrorBoundary } from '@/screens/panel/whatsapp/WhatsappChatErrorBoundary';
import { WhatsappMessageList } from '@/screens/panel/whatsapp/WhatsappMessageList';
import { waChrome } from '@/screens/panel/whatsapp/chrome';

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
  const chrome = waChrome(useTheme());
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const {
    chatList,
    filteredChats,
    chatListLoaded,
    loadingMore,
    manualRefreshing,
    search,
    setSearch,
    handleChatListScroll,
    refreshChats,
    bumpChatPreview,
  } = useWhatsappChatList();

  const {
    selectedUser,
    selectedMobileRef,
    activeMessages,
    activeProfileName,
    messagesLoading,
    loadingOlder,
    hasMore,
    showLoadPrevious,
    followLatest,
    messagesContainerRef,
    stickToBottomRef,
    scrollMessagesToBottom,
    handleMessagesScroll,
    handleLoadPrevious,
    handleSelectChat,
    handleBackToList,
    appendOptimisticMessage,
  } = useWhatsappThread({ chatList, onOptimisticPreview: bumpChatPreview });

  const handleSend = useCallback(async () => {
    const text = message.trim();
    const recipient = selectedMobileRef.current || (selectedUser ? toApiMobile(selectedUser) : '');
    if ((!text && !image) || !recipient || !selectedUser || sending) return;

    const plan = buildExotelWhatsappSend({ recipient, text, image });
    if (!plan.ok) {
      toast.error(plan.error);
      return;
    }

    setSending(true);
    try {
      const res = await secureApi('whatsapp.sendExotel', { ...plan.body });
      if (!res.ok) {
        toast.error(res.message || 'Failed to send message');
        return;
      }
      stickToBottomRef.current = true;
      appendOptimisticMessage(plan.optimistic);
      setMessage('');
      setImage(null);
      toast.success('Message sent');
      requestAnimationFrame(() => scrollMessagesToBottom(true));
    } finally {
      setSending(false);
    }
  }, [
    appendOptimisticMessage,
    image,
    message,
    scrollMessagesToBottom,
    selectedMobileRef,
    selectedUser,
    sending,
    stickToBottomRef,
  ]);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result?.toString() ?? null);
    reader.onerror = () => toast.error('Failed to read image');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const showLoadPreviousButton =
    Boolean(selectedUser) && hasMore && (showLoadPrevious || loadingOlder) && activeMessages.length > 0;

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
          bgcolor: chrome.shell,
          border: `1px solid ${chrome.borderStrong}`,
        }}
      >
        <Box
          sx={{
            display: { xs: selectedUser ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            borderRight: `1px solid ${chrome.border}`,
            bgcolor: chrome.sidebar,
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
              borderBottom: `1px solid ${chrome.border}`,
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
                gap: 0.5,
                pl: 1.25,
                pr: 0.5,
                minHeight: 40,
                bgcolor: chrome.field,
                border: `1px solid ${chrome.fieldBorder}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <SearchIcon sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />
              <InputBase
                fullWidth
                placeholder="Search or start new chat"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{
                  flex: 1,
                  fontSize: 13,
                  color: chrome.text,
                  bgcolor: 'transparent !important',
                  '& .MuiInputBase-input': {
                    p: 0,
                    height: 'auto',
                    bgcolor: 'transparent !important',
                    color: `${chrome.text} !important`,
                    WebkitTextFillColor: `${chrome.text} !important`,
                  },
                }}
              />
              <IconButton
                size="small"
                aria-label="Refresh chats"
                title="Refresh chats"
                disabled={manualRefreshing}
                onClick={() => void refreshChats()}
                sx={{
                  color: 'text.secondary',
                  bgcolor: 'transparent',
                  '&:hover': {
                    bgcolor: chrome.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  },
                }}
              >
                {manualRefreshing ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshIcon sx={{ fontSize: 19 }} />
                )}
              </IconButton>
            </Paper>
          </Box>
          <List dense onScroll={handleChatListScroll} sx={{ overflow: 'auto', flex: 1, minHeight: 0, py: 0 }}>
            {filteredChats.length === 0 ? (
              <Typography color="text.secondary" sx={{ px: 2, py: 3, textAlign: 'center', fontSize: 13 }}>
                {chatListLoaded ? 'No chats found' : 'Loading chats...'}
              </Typography>
            ) : (
              filteredChats.map(({ phone, profileName, preview, timestamp }) => (
                <ListItemButton
                  key={phone}
                  selected={chatMatchesSelection(phone, selectedUser)}
                  onClick={() => handleSelectChat(phone)}
                  sx={{
                    gap: 1.25,
                    py: 1.25,
                    '&.Mui-selected': { bgcolor: chrome.selected },
                  }}
                >
                  <Avatar name={profileName} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography fontWeight={600} fontSize={14} noWrap>
                        {profileName}
                      </Typography>
                      <Typography fontSize={11} color="text.secondary" whiteSpace="nowrap">
                        {formatListTime(timestamp)}
                      </Typography>
                    </Stack>
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      {preview}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))
            )}
            {loadingMore ? (
              <Typography color="text.secondary" sx={{ px: 2, py: 1.5, textAlign: 'center', fontSize: 12 }}>
                Loading more...
              </Typography>
            ) : null}
          </List>
        </Box>

        <Box
          sx={{
            display: { xs: selectedUser ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
            bgcolor: chrome.panel,
          }}
        >
          {selectedUser ? (
            <WhatsappChatErrorBoundary resetKey={selectedUser} onReset={() => handleSelectChat(selectedUser)}>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
              <Stack
                direction="row"
                alignItems="center"
                gap={1.25}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderBottom: `1px solid ${chrome.border}`,
                  bgcolor: chrome.header,
                  flexShrink: 0,
                }}
              >
                <IconButton size="small" onClick={handleBackToList} sx={{ display: { md: 'none' } }}>
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

              <Box sx={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
                {showLoadPreviousButton ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 0,
                      right: 0,
                      zIndex: 2,
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      disabled={loadingOlder}
                      onClick={handleLoadPrevious}
                      sx={{
                        pointerEvents: 'auto',
                        border: `1px solid ${chrome.fieldBorder}`,
                        bgcolor: chrome.field,
                        color: chrome.text,
                        borderRadius: 2,
                        px: 1.5,
                        py: 0.5,
                        fontSize: 12,
                        cursor: loadingOlder ? 'default' : 'pointer',
                      }}
                    >
                      {loadingOlder ? 'Loading...' : 'Load previous'}
                    </Box>
                  </Box>
                ) : null}
                <WhatsappMessageList
                  messages={activeMessages}
                  parentRef={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  messagesLoading={messagesLoading}
                  followLatest={followLatest}
                />
              </Box>

              <Composer
                chrome={chrome}
                message={message}
                image={image}
                sending={sending}
                onMessageChange={setMessage}
                onSend={() => void handleSend()}
                onKeyDown={handleKeyDown}
                onImageUpload={handleImageUpload}
                onClearImage={() => setImage(null)}
              />
              </Box>
            </WhatsappChatErrorBoundary>
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
                <Typography variant="h6" fontWeight={700} color={chrome.text} mb={1}>
                  WhatsApp Web
                </Typography>
                <Typography fontSize={14}>
                  Select a chat from the list to view messages and delivery status.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

function Composer({
  chrome,
  message,
  image,
  sending,
  onMessageChange,
  onSend,
  onKeyDown,
  onImageUpload,
  onClearImage,
}: {
  chrome: ReturnType<typeof waChrome>;
  message: string;
  image: string | null;
  sending: boolean;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <Stack
      direction="row"
      alignItems="flex-end"
      gap={1}
      sx={{
        px: 1.5,
        py: 1.25,
        borderTop: `1px solid ${chrome.border}`,
        bgcolor: chrome.header,
        flexShrink: 0,
        zIndex: 2,
      }}
    >
      <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
        <AttachFileIcon fontSize="small" />
      </IconButton>
      <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={onImageUpload} />
      {image ? (
        <Box
          component="img"
          src={image}
          alt="Preview"
          onClick={onClearImage}
          sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
        />
      ) : null}
      <Box
        component="textarea"
        rows={1}
        placeholder="Type a message"
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        onKeyDown={onKeyDown}
        sx={{
          flex: 1,
          resize: 'none',
          border: `1px solid ${chrome.fieldBorder}`,
          borderRadius: 2,
          bgcolor: chrome.field,
          color: chrome.text,
          '&::placeholder': { color: 'text.secondary' },
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
        onClick={onSend}
        sx={{
          bgcolor: '#ff9f0a',
          color: '#1a1200',
          '&:hover': { bgcolor: '#e08c00' },
          '&.Mui-disabled': { bgcolor: chrome.sendDisabledBg, color: chrome.sendDisabledColor },
        }}
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
