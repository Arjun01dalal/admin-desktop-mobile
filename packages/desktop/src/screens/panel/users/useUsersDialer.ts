import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CAMPAIGN_LIST } from '@/screens/panel/newRegisters/campaignList';
import { pushToBotDialer } from '../shared/pushToBotDialer';
import { mapUsersToBotSettings, mapUsersToDialerLeads, reasonForUserType } from './toolbarHelpers';
import type { UserType } from './constants';
import {
  actionForType,
  buildPayloadForType,
  buildUserFilter,
  empCodesEqual,
  excludeDumped,
  filterListByLoginEmpCode,
  filterSearchByEmpCode,
  hasOtherUserSearch,
  resolveSearchEmpCode,
  unpackByType,
  type UserFilters,
  type UserRow,
} from './utils';
import type { UsersAdmin } from './useUsersQuery';

type Params = {
  admin: UsersAdmin | null | undefined;
  rows: UserRow[];
  dialerData: UserRow[];
  setDialerData: (rows: UserRow[]) => void;
  total: number;
  applied: UserFilters;
  clientName: string;
  playedIn: string;
  uniqueUser: boolean;
  userType: UserType;
  startDate: string;
  endDate: string;
  itemsPerPage: number;
  isClientPagedType: boolean;
  allottedApps: string | string[] | undefined;
  accessibleStates: string[];
  loginEmpCode: string;
  loadGlobals: () => Promise<number>;
};

export function useUsersDialer({
  admin,
  rows,
  dialerData,
  total,
  applied,
  clientName,
  playedIn,
  uniqueUser,
  userType,
  startDate,
  endDate,
  itemsPerPage,
  isClientPagedType,
  allottedApps,
  accessibleStates,
  loginEmpCode,
  loadGlobals: loadGlobalsCount,
}: Params) {
  const [botId, setBotId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [globalCount, setGlobalCount] = useState(0);
  const [dialerLoading, setDialerLoading] = useState(false);

  const loadGlobals = useCallback(async () => {
    const count = await loadGlobalsCount();
    setGlobalCount(count);
    return count;
  }, [loadGlobalsCount]);

  /**
   * Resolve users for bot/dialer push.
   * Default page size is 10 — without this, Total=20 only pushes the loaded page.
   */
  const resolveDialerSource = useCallback(async (): Promise<UserRow[]> => {
    const current = dialerData.length ? dialerData : rows;
    // Already have the full set (or client-paged type which loads everything once).
    if (isClientPagedType || current.length >= total || total <= 0) {
      return current;
    }

    const pageSize = Math.min(Math.max(total, itemsPerPage, current.length), 10_000);
    const isNonPerfActive = userType === 'Non_Performing_Active_User';
    const applyEmpRules =
      userType === 'User' || userType === 'Non_Performing_User' || isNonPerfActive;
    const otherSearch = isNonPerfActive ? false : hasOtherUserSearch(applied, clientName, playedIn);

    let empResolved: Extract<ReturnType<typeof resolveSearchEmpCode>, { ok: true }> = {
      ok: true,
    };
    if (applyEmpRules) {
      const resolved = resolveSearchEmpCode(applied.empCode, loginEmpCode, otherSearch);
      if (!resolved.ok) {
        toast.error(resolved.message);
        return current;
      }
      empResolved = resolved;
    }

    const filter = buildUserFilter(
      userType,
      applied,
      clientName,
      playedIn,
      uniqueUser,
      applyEmpRules ? empResolved : undefined,
    );
    const payload = buildPayloadForType(userType, {
      pageNo: 1,
      itemsPerPage: pageSize,
      filter,
      startDate,
      endDate,
      allottedApps: userType === 'User' ? undefined : allottedApps,
      appWithState:
        userType === 'User' || userType === 'Sub_Admin' ? undefined : admin?.appWithState,
      selectedClientName: clientName || undefined,
      activeUserStart: applied.activeUserStart || undefined,
      activeUserEnd: applied.activeUserEnd || undefined,
    });

    const res = await secureApi(actionForType(userType), payload);
    if (!res.ok) {
      toast.error(res.message || 'Failed to load full list for bot push');
      return current;
    }

    const parsed = unpackByType(userType, res.data);
    let list = parsed.rows;
    if (userType === 'User') list = excludeDumped(list);

    const trimmedEmp = String(applied.empCode || '').trim();
    if (applyEmpRules && loginEmpCode) {
      if (empResolved.allowOwnAndDefault || empResolved.matchDefault) {
        list = filterSearchByEmpCode(list, loginEmpCode, empResolved);
      } else if (empResolved.apiEmpCode) {
        list = filterListByLoginEmpCode(list, empResolved.apiEmpCode);
      } else {
        list = filterListByLoginEmpCode(list, loginEmpCode);
      }
    } else if (isNonPerfActive && !loginEmpCode && trimmedEmp) {
      list = list.filter((row) => empCodesEqual(row.empCode, trimmedEmp));
    }
    if (accessibleStates.length > 0) {
      list = list.filter((row: UserRow) =>
        accessibleStates.includes(String(row.state || '').toLowerCase()),
      );
    }
    return list.length ? list : current;
  }, [
    accessibleStates,
    admin?.appWithState,
    allottedApps,
    applied,
    clientName,
    dialerData,
    endDate,
    isClientPagedType,
    itemsPerPage,
    loginEmpCode,
    playedIn,
    rows,
    startDate,
    total,
    uniqueUser,
    userType,
  ]);

  const handleAddToBot = useCallback(async () => {
    if (!botId) {
      toast.error('Bot ID should not be empty.');
      return;
    }
    setDialerLoading(true);
    try {
      const source = await resolveDialerSource();
      if (!source.length) {
        toast.error('No users available for bot');
        return;
      }
      if (total > 0 && source.length < total) {
        toast.warning(`Loaded ${source.length} of ${total} users — pushing what is available.`);
      }
      const res = await pushToBotDialer({
        userId: admin?._id,
        created_by: admin?.name,
        dialout_settings: mapUsersToBotSettings(source, botId, reasonForUserType(userType)),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add to bot');
        return;
      }
      toast.success(res.message || `Call Initiated Successfully (${res.pushed} leads).`);
    } finally {
      setDialerLoading(false);
    }
  }, [admin?._id, admin?.name, botId, resolveDialerSource, total, userType]);

  const handleAddToDialer = useCallback(async () => {
    if (!campaignId) {
      toast.error('Campaign Name should not be empty');
      return;
    }
    setDialerLoading(true);
    try {
      const source = await resolveDialerSource();
      if (!source.length) {
        toast.error('No users available for dialer');
        return;
      }
      const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId);
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId,
        leads: mapUsersToDialerLeads(source),
        serverId: campaign?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Dialer call failed');
        return;
      }
      await secureApi('ops.savePerformanceData', {
        subAdminId: admin?._id,
        dialledUserIds: source.map((r) => r._id).filter(Boolean),
        extensionId: campaignId,
      });
      toast.success(res.message || `Dialer call queued (${source.length} leads)`);
    } finally {
      setDialerLoading(false);
    }
  }, [admin?._id, campaignId, resolveDialerSource]);

  useEffect(() => {
    void loadGlobals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    botId,
    setBotId,
    campaignId,
    setCampaignId,
    globalCount,
    dialerLoading,
    loadGlobals,
    resolveDialerSource,
    handleAddToBot,
    handleAddToDialer,
  };
}
