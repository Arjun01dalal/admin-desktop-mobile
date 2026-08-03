import { useCallback, useState } from 'react';
import { todayIST } from '@/utils/dates';
import type { DashboardFilters, ProviderFilter } from './types';

const today = () => todayIST();

export function useDashboardFilters(initial?: Partial<DashboardFilters>) {
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [endDate, setEndDate] = useState(initial?.endDate ?? today());
  const [appClientName, setAppClientName] = useState(initial?.appClientName ?? '');
  const [filterBy, setFilterBy] = useState<ProviderFilter>(
    initial?.filterBy ?? 'All',
  );
  /** Applied snapshot — only changes on Apply / All Data. */
  const [applied, setApplied] = useState<DashboardFilters>({
    startDate: initial?.startDate ?? today(),
    endDate: initial?.endDate ?? today(),
    appClientName: initial?.appClientName ?? '',
    filterBy: initial?.filterBy ?? 'All',
  });

  const apply = useCallback(() => {
    setApplied({ startDate, endDate, appClientName, filterBy });
  }, [startDate, endDate, appClientName, filterBy]);

  const clearAll = useCallback(() => {
    const t = today();
    setStartDate(t);
    setEndDate(t);
    setAppClientName('');
    setFilterBy('All');
    setApplied({
      startDate: t,
      endDate: t,
      appClientName: '',
      filterBy: 'All',
    });
  }, []);

  return {
    startDate,
    endDate,
    appClientName,
    filterBy,
    applied,
    setStartDate,
    setEndDate,
    setAppClientName,
    setFilterBy,
    apply,
    clearAll,
  };
}
