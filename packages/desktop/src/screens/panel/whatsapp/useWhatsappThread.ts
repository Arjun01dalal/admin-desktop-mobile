import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  WHATSAPP_MESSAGE_PAGE_SIZE,
  WHATSAPP_NEAR_BOTTOM_PX,
  WHATSAPP_NEAR_TOP_PX,
  WHATSAPP_POLL_INTERVAL_MS,
  buildMessageRequest,
  extractWhatsappMessagesWithMeta,
  getMessagePreview,
  getProfileName,
  isDlr,
  mergePolledMessages,
  normalizePhone,
  prependUniqueMessages,
  sortMessages,
  toApiMobile,
  type ChatListItem,
  type WhatsappMessage,
} from '@astro/shared/whatsappInbox';

type Args = {
  chatList: ChatListItem[];
  onOptimisticPreview: (
    phoneKey: string,
    selectedUser: string,
    preview: string,
    timestamp: string,
  ) => void;
};

export function useWhatsappThread({ chatList, onOptimisticPreview }: Args) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showLoadPrevious, setShowLoadPrevious] = useState(false);
  const [followLatest, setFollowLatest] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const skipRef = useRef(0);
  const hasMoreRef = useRef(true);
  const selectedMobileRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const showLoadPreviousRef = useRef(false);
  const messagesRef = useRef(messages);
  const threadIdRef = useRef(0);
  const pendingAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  messagesRef.current = messages;

  const scrollMessagesToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const top = el.scrollHeight;
    if (smooth) el.scrollTo({ top, behavior: 'smooth' });
    else el.scrollTop = top;
  }, []);

  const setNearTopVisible = useCallback((nearTop: boolean) => {
    if (showLoadPreviousRef.current === nearTop) return;
    showLoadPreviousRef.current = nearTop;
    setShowLoadPrevious(nearTop);
  }, []);

  const captureScrollAnchor = useCallback(() => {
    const el = messagesContainerRef.current;
    const firstRow = el?.querySelector('[data-msg-id]') as HTMLElement | null;
    if (!el || !firstRow?.dataset.msgId) {
      pendingAnchorRef.current = null;
      return;
    }
    pendingAnchorRef.current = {
      id: firstRow.dataset.msgId,
      offset: firstRow.getBoundingClientRect().top - el.getBoundingClientRect().top,
    };
  }, []);

  const fetchMessages = useCallback(
    async (mobile: string, silent = false, loadOlder = false) => {
      if (!mobile) return;
      const threadId = threadIdRef.current;

      if (loadOlder) {
        if (!hasMoreRef.current || loadingOlderRef.current) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
      } else if (fetchingRef.current || loadingOlderRef.current) {
        return;
      } else {
        fetchingRef.current = true;
        if (!silent) setMessagesLoading(true);
      }

      const skip = loadOlder ? skipRef.current : 0;

      try {
        const res = await secureApi('whatsapp.getCallbacks', buildMessageRequest(mobile, skip));
        if (threadId !== threadIdRef.current) return;
        if (!res.ok) {
          if (!silent && !loadOlder) toast.error(res.message || 'Failed to load messages');
          return;
        }

        const { messages: incoming, rawCount } = extractWhatsappMessagesWithMeta(res.data);
        const more = rawCount >= WHATSAPP_MESSAGE_PAGE_SIZE;

        if (loadOlder) {
          const merged = prependUniqueMessages(messagesRef.current, incoming);
          if (merged) {
            captureScrollAnchor();
            setMessages(merged);
          } else {
            pendingAnchorRef.current = null;
          }
          skipRef.current = skip + WHATSAPP_MESSAGE_PAGE_SIZE;
          hasMoreRef.current = more;
          setHasMore(more);
          return;
        }

        if (!silent) {
          setMessages(sortMessages(incoming));
          skipRef.current = WHATSAPP_MESSAGE_PAGE_SIZE;
          hasMoreRef.current = more;
          setHasMore(more);
          return;
        }

        setMessages((prev) => mergePolledMessages(prev, incoming) ?? prev);
      } finally {
        if (threadId !== threadIdRef.current) return;
        if (loadOlder) {
          loadingOlderRef.current = false;
          setLoadingOlder(false);
        } else {
          fetchingRef.current = false;
          setMessagesLoading(false);
        }
      }
    },
    [captureScrollAnchor],
  );

  const handleMessagesScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setNearTopVisible(el.scrollTop <= WHATSAPP_NEAR_TOP_PX);
      // Programmatic jumps (opening a chat) are not trusted and must not unpin.
      if (!event.nativeEvent.isTrusted) return;
      const atBottom = distanceFromBottom < WHATSAPP_NEAR_BOTTOM_PX;
      stickToBottomRef.current = atBottom;
      setFollowLatest((prev) => (prev === atBottom ? prev : atBottom));
    },
    [setNearTopVisible],
  );

  const handleLoadPrevious = useCallback(() => {
    const mobile = selectedMobileRef.current;
    if (!mobile || !hasMoreRef.current || loadingOlderRef.current) return;
    stickToBottomRef.current = false;
    setFollowLatest(false);
    void fetchMessages(mobile, true, true);
  }, [fetchMessages]);

  useEffect(() => {
    if (!selectedUser) return;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      const mobile = selectedMobileRef.current;
      if (!mobile || !stickToBottomRef.current) return;
      if (loadingOlderRef.current || fetchingRef.current) return;
      void fetchMessages(mobile, true, false);
    };
    const intervalId = window.setInterval(poll, WHATSAPP_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchMessages, selectedUser]);

  const activeMessages = useMemo(() => messages.filter((msg) => !isDlr(msg)), [messages]);

  const activeProfileName = useMemo(() => {
    if (!selectedUser) return '';
    const fromList = chatList.find(
      (chat) => normalizePhone(chat.phone) === selectedUser || chat.phone === selectedUser,
    );
    if (fromList?.profileName) return fromList.profileName;
    return getProfileName(activeMessages, selectedUser);
  }, [activeMessages, chatList, selectedUser]);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    pendingAnchorRef.current = null;
    const el = messagesContainerRef.current;
    if (!el) return;
    const node = el.querySelector(`[data-msg-id="${CSS.escape(anchor.id)}"]`) as HTMLElement | null;
    if (!node) return;
    const top = node.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop += top - anchor.offset;
    setNearTopVisible(el.scrollTop <= WHATSAPP_NEAR_TOP_PX);
  }, [activeMessages, loadingOlder, setNearTopVisible]);

  const appendOptimisticMessage = useCallback(
    (msg: WhatsappMessage) => {
      if (!selectedUser) return;
      stickToBottomRef.current = true;
      setFollowLatest(true);
      setMessages((prev) => [...prev, msg]);
      onOptimisticPreview(
        normalizePhone(selectedUser),
        selectedUser,
        getMessagePreview(msg),
        msg.timestamp,
      );
    },
    [onOptimisticPreview, selectedUser],
  );

  const handleSelectChat = useCallback(
    (phone: string) => {
      threadIdRef.current += 1;
      fetchingRef.current = false;
      loadingOlderRef.current = false;
      const mobile = toApiMobile(phone);
      selectedMobileRef.current = mobile;
      stickToBottomRef.current = true;
      setFollowLatest(true);
      skipRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
      setNearTopVisible(false);
      setSelectedUser(normalizePhone(phone));
      setMessages([]);
      setLoadingOlder(false);
      void fetchMessages(mobile, false, false);
    },
    [fetchMessages, setNearTopVisible],
  );

  const handleBackToList = useCallback(() => {
    threadIdRef.current += 1;
    fetchingRef.current = false;
    loadingOlderRef.current = false;
    selectedMobileRef.current = null;
    skipRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setNearTopVisible(false);
    setSelectedUser(null);
    setMessages([]);
    setMessagesLoading(false);
    setLoadingOlder(false);
  }, [setNearTopVisible]);

  return {
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
  };
}
