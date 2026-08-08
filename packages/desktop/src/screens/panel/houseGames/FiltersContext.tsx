import { createTableFiltersContext } from '@/components/createTableFiltersContext';
import type { FiltersState } from './constants';

export type HouseGamesFiltersValue = {
  filters: FiltersState;
  onFilterChange: (key: keyof FiltersState, value: string) => void;
  onCheckboxChange: (key: 'isBot' | 'human', checked: boolean) => void;
  onSearch: () => void;
  /** API-original gameId values for the Krida dropdown. */
  gameIdOptions: string[];
};

const { Provider, useFilters } =
  createTableFiltersContext<HouseGamesFiltersValue>('HouseGamesFilters');

export const HouseGamesFiltersProvider = Provider;
export const useHouseGamesFilters = useFilters;
