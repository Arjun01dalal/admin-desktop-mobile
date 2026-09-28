import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  WHATSAPP_CHAT_LIST_PAGE_SIZE,
  WHATSAPP_MESSAGE_PAGE_SIZE,
  WHATSAPP_POLL_INTERVAL_MS,
  WHATSAPP_SEARCH_DEBOUNCE_MS,
  buildChatListRequest,
  buildMessageRequest,
  extractChatListPayload,
  extractWhatsappMessagesWithMeta,
  filterChatList,
  getMessagePreview,
  getProfileName,
  isDlr,
  mergeChatListPage,
  mergePolledMessages,
  normalizePhone,
  prependUniqueMessages,
  sortMessages,
  toApiMobile,
  type ChatListItem,
  type WhatsappMessage,
} from '@astro/shared/whatsappInbox';
import { secureApi } from '../../../../api/client';

export function useWhatsappInbox() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [chatListLoaded, setChatListLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showLoadPrevious, setShowLoadPrevious] = useState(false);

  const listFetchingRef = useRef(false);
  const fetchingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const skipRef = useRef(0);
  const hasMoreRef = useRef(true);
  const selectedMobileRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const threadIdRef = useRef(0);
  const messagesRef = useRef(messages);
  const appliedSearchRef = useRef(appliedSearch);
  messagesRef.current = messages;
  appliedSearchRef.current = appliedSearch;

  const fetchChatList = useCallback(
    async (opts: { silent?: boolean; page?: number; searchQuery?: string; append?: boolean } = {}) => {
      const {
        silent = false,
        page: nextPage = 1,
        searchQuery = appliedSearchRef.current,
        append = false,
      } = opts;
      if (listFetchingRef.current) return;
      listFetchingRef.current = true;
      if (append) setLoadingMore(true);
      else if (!silent) setLoadingList(true);

      try {
        const res = await secureApi<unknown>(
          'whatsapp.getChatList',
          buildChatListRequest(searchQuery, nextPage),
        );
        if (!res.ok) {
          if (!silent) setListError(res.message || 'Failed to load chats');
          return;
        }
        setListError(null);
        const { items, totalPages: pages } = extractChatListPayload(
          res.data,
          WHATSAPP_CHAT_LIST_PAGE_SIZE,
        );
        setChatList((prev) => (append ? mergeChatListPage(prev, items) : items));
        setPage(nextPage);
        setTotalPages(pages);
      } finally {
        listFetchingRef.current = false;
        setLoadingMore(false);
        setLoadingList(false);
        setChatListLoaded(true);
      }
    },
    [],
  );

  const hasMoreChats = page < totalPages;

  const loadMoreChats = useCallback(() => {
    if (!hasMoreChats || listFetchingRef.current) return;
    void fetchChatList({
      silent: true,
      page: page + 1,
      searchQuery: appliedSearch,
      append: true,
    });
  }, [appliedSearch, fetchChatList, hasMoreChats, page]);

  useEffect(() => {
    void fetchChatList({ page: 1, searchQuery: appliedSearch, append: false });
  }, [appliedSearch, fetchChatList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setAppliedSearch((prev) => (prev === next ? prev : next));
    }, WHATSAPP_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredChats = useMemo(() => filterChatList(chatList, search), [chatList, search]);

  const refreshChats = useCallback(async () => {
    await fetchChatList({ page: 1, searchQuery: appliedSearch, append: false });
  }, [appliedSearch, fetchChatList]);

  const fetchMessages = useCallback(async (mobile: string, silent = false, loadOlder = false) => {
    if (!mobile) return false;
    const threadId = threadIdRef.current;
    if (loadOlder) {
      if (!hasMoreRef.current || loadingOlderRef.current) return false;
      loadingOlderRef.current = true;
      setLoadingOlder(true);
    } else if (fetchingRef.current || loadingOlderRef.current) {
      return false;
    } else {
      fetchingRef.current = true;
      if (!silent) setMessagesLoading(true);
    }

    const skip = loadOlder ? skipRef.current : 0;
    try {
      const res = await secureApi<unknown>('whatsapp.getCallbacks', buildMessageRequest(mobile, skip));
      if (threadId !== threadIdRef.current) return false;
      if (!res.ok) return false;
      const { messages: incoming, rawCount } = extractWhatsappMessagesWithMeta(res.data);
      const more = rawCount >= WHATSAPP_MESSAGE_PAGE_SIZE;
      if (loadOlder) {
        const merged = prependUniqueMessages(messagesRef.current, incoming);
        if (merged) setMessages(merged);
        skipRef.current = skip + WHATSAPP_MESSAGE_PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
        return Boolean(merged);
      }
      if (!silent) {
        setMessages(sortMessages(incoming));
        skipRef.current = WHATSAPP_MESSAGE_PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
        return false;
      }
      setMessages((prev) => mergePolledMessages(prev, incoming) ?? prev);
      return false;
    } finally {
      if (threadId === threadIdRef.current) {
        if (loadOlder) {
          loadingOlderRef.current = false;
          setLoadingOlder(false);
        } else {
          fetchingRef.current = false;
          setMessagesLoading(false);
        }
      }
    }
    return false;
  }, []);

  const pollMessages = useCallback(() => {
    const mobile = selectedMobileRef.current;
    if (!mobile || !stickToBottomRef.current) return;
    if (AppState.currentState !== 'active') return;
    if (loadingOlderRef.current || fetchingRef.current) return;
    void fetchMessages(mobile, true, false);
  }, [fetchMessages]);

  useEffect(() => {
    if (!selectedUser) return;
    const timer = setInterval(pollMessages, WHATSAPP_POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') pollMessages();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [pollMessages, selectedUser]);

  const activeMessages = useMemo(() => messages.filter((msg) => !isDlr(msg)), [messages]);

  const activeProfileName = useMemo(() => {
    if (!selectedUser) return '';
    const fromList = chatList.find(
      (chat) => normalizePhone(chat.phone) === selectedUser || chat.phone === selectedUser,
    );
    if (fromList?.profileName) return fromList.profileName;
    return getProfileName(activeMessages, selectedUser);
  }, [activeMessages, chatList, selectedUser]);

  const selectChat = useCallback(
    (phone: string) => {
      threadIdRef.current += 1;
      fetchingRef.current = false;
      loadingOlderRef.current = false;
      const mobile = toApiMobile(phone);
      selectedMobileRef.current = mobile;
      stickToBottomRef.current = true;
      skipRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
      setShowLoadPrevious(false);
      setSelectedUser(normalizePhone(phone));
      setMessages([]);
      setLoadingOlder(false);
      void fetchMessages(mobile, false, false);
    },
    [fetchMessages],
  );

  const backToList = useCallback(() => {
    threadIdRef.current += 1;
    fetchingRef.current = false;
    loadingOlderRef.current = false;
    selectedMobileRef.current = null;
    skipRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setShowLoadPrevious(false);
    setSelectedUser(null);
    setMessages([]);
    setMessagesLoading(false);
    setLoadingOlder(false);
  }, []);

  const loadOlder = useCallback(() => {
    const mobile = selectedMobileRef.current;
    if (!mobile || !hasMoreRef.current || loadingOlderRef.current) return Promise.resolve(false);
    return fetchMessages(mobile, true, true);
  }, [fetchMessages]);

  const bumpChatPreview = useCallback(
    (phoneKey: string, selected: string, preview: string, timestamp: string) => {
      setChatList((prev) => {
        const index = prev.findIndex(
          (chat) => normalizePhone(chat.phone) === phoneKey || chat.phone === selected,
        );
        if (index === -1) return prev;
        const updated = [...prev];
        const [item] = updated.splice(index, 1);
        return [{ ...item, preview, timestamp }, ...updated];
      });
    },
    [],
  );

  const appendOptimisticMessage = useCallback(
    (msg: WhatsappMessage) => {
      if (!selectedUser) return;
      setMessages((prev) => [...prev, msg]);
      bumpChatPreview(normalizePhone(selectedUser), selectedUser, getMessagePreview(msg), msg.timestamp);
    },
    [bumpChatPreview, selectedUser],
  );

  return {
    chatList,
    filteredChats,
    chatListLoaded,
    loadingList,
    loadingMore,
    listError,
    search,
    setSearch,
    hasMoreChats,
    loadMoreChats,
    refreshChats,
    selectedUser,
    selectedMobileRef,
    activeMessages,
    activeProfileName,
    messagesLoading,
    loadingOlder,
    hasMore,
    showLoadPrevious,
    setShowLoadPrevious,
    stickToBottomRef,
    selectChat,
    backToList,
    loadOlder,
    appendOptimisticMessage,
  };
}
