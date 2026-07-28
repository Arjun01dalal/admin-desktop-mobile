import type { Dispatch, SetStateAction } from 'react';
import { createTableFiltersContext } from '@/components/createTableFiltersContext';

export type NewRegistersFiltersValue = {
  searchName: string;
  setSearchName: Dispatch<SetStateAction<string>>;
  searchDpId: string;
  setSearchDpId: Dispatch<SetStateAction<string>>;
  userComesFrom: string;
  setUserComesFrom: Dispatch<SetStateAction<string>>;
  searchBalance: string;
  setSearchBalance: Dispatch<SetStateAction<string>>;
  showEmptyRecord: boolean;
  setShowEmptyRecord: Dispatch<SetStateAction<boolean>>;
  appClientName: string;
  setAppClientName: Dispatch<SetStateAction<string>>;
  searchPlayInStatus: string;
  setSearchPlayInStatus: Dispatch<SetStateAction<string>>;
  searchAccNo: string;
  setSearchAccNo: Dispatch<SetStateAction<string>>;
  searchAadharNo: string;
  setSearchAadharNo: Dispatch<SetStateAction<string>>;
  searchEmail: string;
  setSearchEmail: Dispatch<SetStateAction<string>>;
  searchCity: string;
  setSearchCity: Dispatch<SetStateAction<string>>;
  selectedState: string[];
  setSelectedState: Dispatch<SetStateAction<string[]>>;
  searchReferred: string;
  setSearchReferred: Dispatch<SetStateAction<string>>;
  searchReferralCodeUser: string;
  setSearchReferralCodeUser: Dispatch<SetStateAction<string>>;
  searchMobile: string;
  setSearchMobile: Dispatch<SetStateAction<string>>;
  appOptions: string[];
  applyFilters: () => void;
};

const { Provider, useFilters } =
  createTableFiltersContext<NewRegistersFiltersValue>('NewRegistersFilters');

export const NewRegistersFiltersProvider = Provider;
export const useNewRegistersFilters = useFilters;
