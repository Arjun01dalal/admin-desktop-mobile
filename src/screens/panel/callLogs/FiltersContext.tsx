import { createTableFiltersContext } from '@/components/createTableFiltersContext';

export type CallLogsFiltersValue = {
  dpId: string;
  mobNo: string;
  state: string;
  sid: string;
  selectedStatus: string;
  selectedBotId: string;
  commentFilter: string;
  onDpIdChange: (value: string) => void;
  onMobNoChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onSidChange: (value: string) => void;
  onSelectedStatusChange: (value: string) => void;
  onSelectedBotIdChange: (value: string) => void;
  onCommentFilterChange: (value: string) => void;
  onApplyFilters: () => void;
  onPageReset: () => void;
};

const { Provider, useFilters } = createTableFiltersContext<CallLogsFiltersValue>(
  'CallLogsFilters',
);

export const CallLogsFiltersProvider = Provider;
export const useCallLogsFilters = useFilters;
