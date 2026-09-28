import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLayoutEffect, useRef, type RefObject, type UIEvent } from 'react';
import {
  formatMessageTime,
  getWhatsappMessageId,
  isIncoming,
  presentMessage,
  type WhatsappMessage,
} from '@astro/shared/whatsappInbox';
import { waChrome } from '@/screens/panel/whatsapp/chrome';

type Props = {
  messages: WhatsappMessage[];
  parentRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  messagesLoading: boolean;
  /** When true, keep the viewport on the newest message. */
  followLatest: boolean;
};

export function WhatsappMessageList({
  messages,
  parentRef,
  onScroll,
  messagesLoading,
  followLatest,
}: Props) {
  const chrome = waChrome(useTheme());
  const followLatestRef = useRef(followLatest);
  followLatestRef.current = followLatest;
  const lastMessageId = messages.length
    ? getWhatsappMessageId(messages[messages.length - 1], messages.length - 1)
    : '';

  const pinToLatest = () => {
    if (!followLatestRef.current) return;
    const el = parentRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useLayoutEffect(() => {
    if (!followLatest || messagesLoading || messages.length === 0) return;
    pinToLatest();
    const frame = requestAnimationFrame(pinToLatest);
    const soon = window.setTimeout(pinToLatest, 50);
    const afterLayout = window.setTimeout(pinToLatest, 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(soon);
      window.clearTimeout(afterLayout);
    };
  }, [followLatest, lastMessageId, messagesLoading]);

  return (
    <Box
      ref={parentRef}
      data-wa-messages
      onScroll={onScroll}
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        overflowAnchor: 'none',
        px: 2,
        py: 2,
        background: chrome.canvas,
      }}
    >
      {messagesLoading && messages.length === 0 ? (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <CircularProgress size={22} />
        </Box>
      ) : null}

      {messages.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.map((msg, index) => {
            const msgId = getWhatsappMessageId(msg, index);
            const incoming = isIncoming(msg);
            const view = presentMessage(msg);
            const showTimeUnderMedia = view.kind === 'image' || view.kind === 'audio';
            return (
              <Box
                key={msgId}
                data-msg-id={msgId}
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
                    bgcolor: incoming ? chrome.incoming : chrome.outgoing,
                    border: `1px solid ${chrome.border}`,
                    color: chrome.text,
                  }}
                >
                  {view.kind === 'text' ? (
                    <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{view.text}</Typography>
                  ) : null}
                  {view.kind === 'image' && view.src ? (
                    <Box
                      component="img"
                      src={view.src}
                      alt={view.caption || 'Shared'}
                      loading="lazy"
                      onLoad={pinToLatest}
                      sx={{
                        maxWidth: 220,
                        maxHeight: 220,
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        borderRadius: 1,
                        display: 'block',
                        mb: view.caption ? 0.75 : 0,
                      }}
                    />
                  ) : null}
                  {view.kind === 'image' && view.caption ? (
                    <Typography sx={{ fontSize: 14 }}>{view.caption}</Typography>
                  ) : null}
                  {view.kind === 'audio' && view.src ? (
                    <Box
                      component="audio"
                      controls
                      preload="metadata"
                      src={view.src}
                      onLoadedMetadata={pinToLatest}
                      sx={{ width: '100%', maxWidth: 220, display: 'block' }}
                    />
                  ) : null}
                  {view.kind === 'audio' && !view.src ? (
                    <Typography sx={{ fontSize: 14 }}>🎵 Audio</Typography>
                  ) : null}
                  <Typography
                    fontSize={10}
                    color="text.secondary"
                    textAlign="right"
                    mt={showTimeUnderMedia ? 0.5 : 0.5}
                  >
                    {formatMessageTime(msg.timestamp)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}
