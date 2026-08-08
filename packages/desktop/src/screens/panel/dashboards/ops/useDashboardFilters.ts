import { useCallback, useState } from 'react';
import { todayIST } from '@/utils/dates';
import type { DashboardFilters, ProviderFilter } from './types';
import { DEFAULT_PROVIDER_FILTER } from './constants';

const today = () => todayIST();

export function useDashboardFilters(initial?: Partial<DashboardFilters>) {
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [endDate, setEndDate] = useState(initial?.endDate ?? today());
  const [appClientName, setAppClientName] = useState(initial?.appClientName ?? '');
  const [filterBy, setFilterBy] = useState<ProviderFilter>(
    initial?.filterBy ?? DEFAULT_PROVIDER_FILTER,
  );
  /** Applied snapshot — only changes on Apply. */
  const [applied, setApplied] = useState<DashboardFilters>({
    startDate: initial?.startDate ?? today(),
    endDate: initial?.endDate ?? today(),
    appClientName: initial?.appClientName ?? '',
    filterBy: initial?.filterBy ?? DEFAULT_PROVIDER_FILTER,
  });

  const apply = useCallback(() => {
    setApplied({ startDate, endDate, appClientName, filterBy });
  }, [startDate, endDate, appClientName, filterBy]);

  const clearAll = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setAppClientName('');
    setFilterBy(DEFAULT_PROVIDER_FILTER);
    setApplied({
      startDate: '',
      endDate: '',
      appClientName: '',
      filterBy: DEFAULT_PROVIDER_FILTER,
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
