import { useEffect, useMemo, useState } from 'react';

import type { TabKey, UpdatedBy } from './types';
import {
  Permissions,
  canAccessDailyAccountReport,
  canManageDarAllotments,
  canManageDarBankAccounts,
  canManageDarMids,
  getSessionUser,
  hasPermission,
} from '../../../../auth/permissions';

export function useDarAccess() {
  const user = useMemo(() => getSessionUser(), []);
  const updatedBy = useMemo<UpdatedBy>(
    () => ({
      userId: String(user?._id || (user as { id?: string } | null)?.id || ''),
      userName: String(user?.name || ''),
    }),
    [user],
  );

  const hasAccess = canAccessDailyAccountReport(user);
  const canBank = canManageDarBankAccounts(user);
  const canMid = canManageDarMids(user);
  const canAllot = canManageDarAllotments(user);
  const canDailyBalance =
    hasAccess ||
    hasPermission(Permissions.daily_account_report, user) ||
    canBank ||
    canMid ||
    canAllot;
  const viewAllAllotments = canAllot;

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [];
    if (canDailyBalance) list.push({ key: 'balance', label: 'Day sheet' });
    if (canBank) list.push({ key: 'banks', label: 'Banks' });
    if (canMid) list.push({ key: 'mids', label: 'MIDs' });
    if (canAllot) list.push({ key: 'allot', label: 'Allot' });
    return list;
  }, [canAllot, canBank, canDailyBalance, canMid]);

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key || 'balance');
  useEffect(() => {
    if (!tabs.some((t) => t.key === tab) && tabs[0]) setTab(tabs[0].key);
  }, [tab, tabs]);

  return {
    user,
    updatedBy,
    hasAccess,
    canBank,
    canMid,
    canAllot,
    canDailyBalance,
    viewAllAllotments,
    tabs,
    tab,
    setTab,
  };
}
