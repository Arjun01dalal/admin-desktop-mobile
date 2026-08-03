import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { formatDdMmYyyy } from '@/utils/dates';
import { POLL_INTERVAL_MS } from './constants';
import { filterCallsClientSide, getAssignedBotIds } from './utils';
import type {
  BotStatusSummary,
  CallLogRow,
  CallLogsFilterState,
  CallLogsListResponse,
} from './types';

type AdminBots = {
  botIds?: Array<string | number> | string;
  botNo?: Array<string | number> | string;
} | null | undefined;

export function useCallLogsQuery(
  filters: CallLogsFilterState,
  admin: AdminBots,
  options?: { poll?: boolean },
) {
  const [calls, setCalls] = useState<CallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [botSummary, setBotSummary] = useState<BotStatusSummary>({});
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end, isInFlight } = useRequestGeneration();

  const filtersRef = useRef(filters);
  const adminRef = useRef(admin);
  useEffect(() => {
    filtersRef.current = filters;
  });
  useEffect(() => {
    adminRef.current = admin;
  });

  const buildFilter = useCallback(() => {
    const f = filtersRef.current;
    const apiStatus =
      f.selectedStatus === 'All'
        ? ''
        : f.selectedStatus === 'Not Received'
          ? 'completed'
          : f.selectedStatus;

    const assigned = getAssignedBotIds(adminRef.current);
    let botId: number[] | null;
    if (assigned.length > 0) {
      // Callers / users with allotted bots — only their bot data
      if (f.selectedBotId && f.selectedBotId !== 'All') {
        const selected = Number(f.selectedBotId);
        botId = assigned.includes(selected) ? [selected] : assigned;
      } else {
        botId = assigned;
      }
    } else if (f.selectedBotId === 'All' || !f.selectedBotId) {
      botId = null;
    } else {
      botId = [Number(f.selectedBotId)];
    }

    return {
      mobileNo: f.mobNo || undefined,
      caller_user_id: f.dpId || undefined,
      sid: f.sid || undefined,
      state: f.state || undefined,
      status: apiStatus,
      startDate: formatDdMmYyyy(f.startDate),
      endDate: formatDdMmYyyy(f.endDate),
      index: f.page,
      limit: f.itemsPerPage,
      botId,
      comments: f.commentFilter === 'All' ? '' : f.commentFilter,
    };
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent && isInFlight()) return;

      const gen = next();
      begin();
      if (!opts?.silent) setLoading(true);

      try {
        const filter = buildFilter();
        const f = filtersRef.current;
        const assigned = getAssignedBotIds(adminRef.current);
        const [listRes, sumRes] = await Promise.all([
          secureApi<CallLogsListResponse>('callLogs.getDialerData', {
            userId: '',
            filter,
          }),
          secureApi<BotStatusSummary>('callLogs.botStatusSummary', {
            startDate: formatDdMmYyyy(f.startDate),
            endDate: formatDdMmYyyy(f.endDate),
          }),
        ]);

        if (!isCurrent(gen)) return;

        if (!listRes.ok) {
          if (!opts?.silent) toast.error(listRes.message || 'Failed to load call logs');
        } else {
          const data = listRes.data || {};
          const raw = data.calls || [];
          const nextCalls = filterCallsClientSide(
            raw,
            f.selectedStatus,
            assigned,
          );
          const nextTotal = Number(
            data.pagination?.totalCount ?? nextCalls.length,
          );
          startTransition(() => {
            setCalls(nextCalls);
            setTotal(nextTotal);
          });
        }

        if (sumRes.ok && sumRes.data) {
          startTransition(() => setBotSummary(sumRes.data as BotStatusSummary));
        }
      } finally {
        end();
        if (isCurrent(gen) && !opts?.silent) setLoading(false);
      }
    },
    [begin, buildFilter, end, isCurrent, isInFlight, next],
  );

  useEffect(() => {
    void load();
  }, [
    filters.page,
    filters.itemsPerPage,
    filters.selectedStatus,
    filters.selectedBotId,
    filters.commentFilter,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (options?.poll === false) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load, options?.poll]);

  return { calls, total, botSummary, loading, load, filtersRef };
}
