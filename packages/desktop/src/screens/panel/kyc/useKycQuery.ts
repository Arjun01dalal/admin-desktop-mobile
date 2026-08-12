import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { dateTime } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import {
  apiFailed,
  EMPTY_KYC_FILTERS,
  type KycFilters,
  type KycRow,
} from './types';

export function useKycQuery() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<KycFilters>(EMPTY_KYC_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<KycFilters>(EMPTY_KYC_FILTERS);

  const [rows, setRows] = useState<KycRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, filtersOverride?: KycFilters, appOverride = appClientName) => {
      const active = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filter: Record<string, string> = {};
        if (active.name.trim()) filter.name = active.name.trim();
        if (active.dpId.trim()) filter._id = active.dpId.trim();
        if (active.mobile.trim()) filter.mobile = active.mobile.trim();
        if (active.aadhaarNumber.trim()) filter.aadhaarNumber = active.aadhaarNumber.trim();
        if (active.accountNumber.trim()) filter.accountNumber = active.accountNumber.trim();
        if (appOverride) filter.clientName = appOverride;

        const payload: Record<string, unknown> = {
          itemsPerPage: pageSize,
          pageNo,
          filter,
        };
        if (startDate && endDate) {
          payload.startDate = dateTime(startDate);
          payload.endDate = dateTime(endDate);
        }

        const res = await secureApi('users.getAll', payload);
        if (!isCurrent(gen)) return;

        if (apiFailed(res)) {
          const msg = res.message || 'Failed to load KYC list';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.users)
          ? (data.users as KycRow[])
          : Array.isArray(data.items)
            ? (data.items as KycRow[])
            : Array.isArray(res.data)
              ? (res.data as KycRow[])
              : [];
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setTotal(Number(data.total ?? data.count) || items.length);
        });
        if (items.length <= 0 && startDate && endDate) {
          toast.info('No kyc registered for selected date');
        }
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, startDate, endDate, appClientName, appliedFilters, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appClientName]);

  const deferredRows = useDeferredValue(rows);

  const applyDates = useCallback(() => {
    if (!startDate) {
      toast.error('Please select from date');
      return;
    }
    if (!endDate) {
      toast.error('Please select to date');
      return;
    }
    setPage(1);
    void load(1);
  }, [load, startDate, endDate]);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  const setDraftField = useCallback(
    (key: keyof KycFilters) => (value: string) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const reload = useCallback(() => {
    void load(page);
  }, [load, page]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    appClientName,
    setAppClientName,
    page,
    setPage,
    pageSize,
    setPageSize,
    draftFilters,
    setDraftField,
    search,
    applyDates,
    rows: deferredRows,
    totalPages,
    total,
    loading,
    error,
    reload,
  };
}
