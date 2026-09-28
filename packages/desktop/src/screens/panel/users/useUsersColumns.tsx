import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type CommonTableColumn } from '@/components/CommonTable';
import { type UserType } from './constants';
import { buildDefaultUserColumns } from './columns/defaultUserColumns';
import { buildInactiveDepositColumns } from './columns/inactiveDepositColumns';
import { buildLaxmiUsersColumns } from './columns/laxmiUsersColumns';
import { buildNonPerformingActiveColumns } from './columns/nonPerformingActiveColumns';
import { buildSubAdminColumns } from './columns/subAdminColumns';
import { buildTodaysActiveColumns } from './columns/todaysActiveColumns';
import type { UsersColumnContext } from './columns/context';
import { type UserFilters, type UserRow } from './utils';

export type UseUsersColumnsParams = {
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
  /** clientName → published app version (from users.appVersions). */
  appVersions?: Record<string, string>;
};

export function useUsersColumns(p: UseUsersColumnsParams) {
  const {
    userType,
    page,
    itemsPerPage,
    draft,
    setDraft,
    setDraftField,
    search,
    clientName,
    setClientName,
    playedIn,
    setPlayedIn,
    setPage,
    botId,
    canShowMobile,
    showMobileColumn,
    hideContact,
    isCaller,
    loginEmpCode,
    actionBusyId,
    otpSending,
    blockCallerBusy,
    canEditSubAdminRole,
    locationDraft,
    setLocationDraft,
    locationBusyId,
    renderUserName,
    renderEmpCodeCell,
    openSubEdit,
    openRoleEdit,
    updateSubAdminLocation,
    startBlockCaller,
    openRealName,
    startBlockWithOtp,
    openDump,
  } = p;
  const appVersions = p.appVersions || {};

  return useMemo<CommonTableColumn<UserRow>[]>(() => {
    const ctx: UsersColumnContext = {
      userType,
      page,
      itemsPerPage,
      draft,
      setDraft,
      setDraftField,
      search,
      clientName,
      setClientName,
      playedIn,
      setPlayedIn,
      setPage,
      botId,
      canShowMobile,
      showMobileColumn,
      hideContact,
      isCaller,
      loginEmpCode,
      actionBusyId,
      otpSending,
      blockCallerBusy,
      canEditSubAdminRole,
      locationDraft,
      setLocationDraft,
      locationBusyId,
      renderUserName,
      renderEmpCodeCell,
      openSubEdit,
      openRoleEdit,
      updateSubAdminLocation,
      startBlockCaller,
      openRealName,
      startBlockWithOtp,
      openDump,
      appVersions,
    };
    if (ctx.userType === 'Sub_Admin') return buildSubAdminColumns(ctx);
    if (ctx.userType === 'Non_Performing_Active_User') return buildNonPerformingActiveColumns(ctx);
    if (ctx.userType === 'LAXMI_999_Users') return buildLaxmiUsersColumns(ctx);
    if (ctx.userType === 'In_Active_Deposit') return buildInactiveDepositColumns(ctx);
    if (ctx.userType === 'Todays_Active') return buildTodaysActiveColumns(ctx);
    return buildDefaultUserColumns(ctx);
  }, [
    actionBusyId,
    blockCallerBusy,
    botId,
    canEditSubAdminRole,
    canShowMobile,
    clientName,
    playedIn,
    draft,
    hideContact,
    isCaller,
    itemsPerPage,
    locationBusyId,
    locationDraft,
    loginEmpCode,
    openDump,
    openRealName,
    openRoleEdit,
    openSubEdit,
    otpSending,
    page,
    renderEmpCodeCell,
    renderUserName,
    search,
    setClientName,
    setPlayedIn,
    setDraft,
    setDraftField,
    setLocationDraft,
    setPage,
    showMobileColumn,
    startBlockCaller,
    startBlockWithOtp,
    updateSubAdminLocation,
    userType,
    appVersions,
  ]);
}
