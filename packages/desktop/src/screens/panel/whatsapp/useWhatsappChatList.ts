import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  WHATSAPP_CHAT_LIST_PAGE_SIZE,
  WHATSAPP_SEARCH_DEBOUNCE_MS,
  buildChatListRequest,
  extractChatListPayload,
  filterChatList,
  mergeChatListPage,
  normalizePhone,
  type ChatListItem,
} from '@astro/shared/whatsappInbox';

export function useWhatsappChatList() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [chatListLoaded, setChatListLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const fetchingRef = useRef(false);

  const fetchChatList = useCallback(
    async (
      opts: { silent?: boolean; page?: number; searchQuery?: string; append?: boolean } = {},
    ) => {
      const {
        silent = false,
        page: nextPage = 1,
        searchQuery = appliedSearch,
        append = false,
      } = opts;
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (append) setLoadingMore(true);

      try {
        const res = await secureApi(
          'whatsapp.getChatList',
          buildChatListRequest(searchQuery, nextPage),
        );
        if (!res.ok) {
          if (!silent) toast.error(res.message || 'Failed to load chat list');
          return;
        }
        const { items, totalPages: pages } = extractChatListPayload(
          res.data,
          WHATSAPP_CHAT_LIST_PAGE_SIZE,
        );
        setChatList((prev) => (append ? mergeChatListPage(prev, items) : items));
        setPage(nextPage);
        setTotalPages(pages);
      } finally {
        fetchingRef.current = false;
        setLoadingMore(false);
        setChatListLoaded(true);
      }
    },
    [appliedSearch],
  );

  const hasMore = page < totalPages;

  const handleChatListScroll = useCallback(
    (event: UIEvent<HTMLUListElement>) => {
      const el = event.currentTarget;
      if (!hasMore || fetchingRef.current) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (!nearBottom) return;
      void fetchChatList({
        silent: true,
        page: page + 1,
        searchQuery: appliedSearch,
        append: true,
      });
    },
    [appliedSearch, fetchChatList, hasMore, page],
  );

  useEffect(() => {
    void fetchChatList({ page: 1, searchQuery: appliedSearch, append: false });
  }, [appliedSearch, fetchChatList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      setAppliedSearch((prev) => (prev === next ? prev : next));
    }, WHATSAPP_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredChats = useMemo(() => filterChatList(chatList, search), [chatList, search]);

  const refreshChats = useCallback(async () => {
    if (fetchingRef.current) return;
    setManualRefreshing(true);
    try {
      await fetchChatList({ page: 1, searchQuery: appliedSearch, append: false });
    } finally {
      setManualRefreshing(false);
    }
  }, [appliedSearch, fetchChatList]);

  const bumpChatPreview = useCallback(
    (phoneKey: string, selectedUser: string, preview: string, timestamp: string) => {
      setChatList((prev) => {
        const index = prev.findIndex(
          (chat) => normalizePhone(chat.phone) === phoneKey || chat.phone === selectedUser,
        );
        if (index === -1) return prev;
        const updated = [...prev];
        const [item] = updated.splice(index, 1);
        return [{ ...item, preview, timestamp }, ...updated];
      });
    },
    [],
  );

  return {
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
  };
}
