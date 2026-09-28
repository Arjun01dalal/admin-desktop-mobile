import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type { UserFilters, UserRow } from '../utils';
import type { UserType } from '../constants';

/** Values closed over by every Users table column builder. */
export type UsersColumnContext = {
  userType: UserType;
  page: number;
  itemsPerPage: number;
  draft: UserFilters;
  setDraft: Dispatch<SetStateAction<UserFilters>>;
  setDraftField: (key: keyof UserFilters) => (value: string) => void;
  search: () => void;
  clientName: string;
  setClientName: (v: string) => void;
  playedIn: string;
  setPlayedIn: (v: string) => void;
  setPage: (p: number) => void;
  botId: string;
  canShowMobile: boolean;
  showMobileColumn: boolean;
  hideContact: boolean;
  isCaller: boolean;
  loginEmpCode: string;
  actionBusyId: string;
  otpSending: boolean;
  blockCallerBusy: boolean;
  canEditSubAdminRole: boolean;
  locationDraft: Record<string, string>;
  setLocationDraft: Dispatch<SetStateAction<Record<string, string>>>;
  locationBusyId: string;
  renderUserName: (r: { _id?: string; name?: string }) => ReactNode;
  renderEmpCodeCell: (r: UserRow) => ReactNode;
  openSubEdit: (
    id: string,
    type: 'name' | 'mobile' | 'telegram' | 'empCode',
    current?: string,
  ) => void;
  openRoleEdit: (row: UserRow) => void;
  updateSubAdminLocation: (row: UserRow) => void;
  startBlockCaller: (row: UserRow) => void;
  openRealName: (row: UserRow) => void;
  startBlockWithOtp: (row: UserRow) => void;
  openDump: (row: UserRow) => void;
  appVersions: Record<string, string>;
};
