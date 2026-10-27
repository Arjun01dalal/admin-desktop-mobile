/** Shared auth / role flags for Gtel screens. */

import { useEffect, useMemo, useState } from 'react';

import { getRoleId, getSessionUser, hasPermission, isCallerRole } from '@/auth/permissions';
import {
  CALLER_ROLE_IDS,
  EMPCODE_LIST_FILTER_ROLE_ID,
  canShowGtelC2c,
  canShowGtelMobile,
  getNumericExtension,
  isGtelCallerHeadDashboardRole,
} from '@astro/shared';

export function useGtelAuth() {
  // Re-read session when responsibilities / profile update (don't freeze empty mount).
  const [sessionTick, setSessionTick] = useState(0);
  useEffect(() => {
    const bump = () => setSessionTick((n) => n + 1);
    window.addEventListener('gcalc:user-updated', bump);
    return () => window.removeEventListener('gcalc:user-updated', bump);
  }, []);

  const admin = useMemo(() => getSessionUser(), [sessionTick]);
  const loginMobile = String(admin?.mobile || '').trim();
  const loginEmpCode = String(admin?.empCode || '').trim();
  const loginUserId = String(admin?._id || '').trim();
  const loginExtensionId = getNumericExtension(
    (admin as { extensionId?: unknown } | null)?.extensionId,
  );
  const roleId = getRoleId(admin) || String(admin?.Role_ID || '');
  const isCallerNew = roleId === EMPCODE_LIST_FILTER_ROLE_ID;
  const isCaller = CALLER_ROLE_IDS.has(roleId) || isCallerRole(admin);
  const shouldLockEmpCode = isCallerNew && Boolean(loginEmpCode);
  const lockEmpCode = (isCaller || isCallerNew) && Boolean(loginEmpCode);
  const restrictToAssignedCallers = isGtelCallerHeadDashboardRole(roleId);

  return {
    admin,
    loginMobile,
    loginEmpCode,
    loginUserId,
    loginExtensionId,
    roleId,
    isCallerNew,
    isCaller,
    shouldLockEmpCode,
    lockEmpCode,
    restrictToAssignedCallers,
    canShowMobile: canShowGtelMobile(admin),
    canShowC2c: canShowGtelC2c(admin),
    canShowGtelCalls: hasPermission('show_gtel_calls', admin),
    canShowGtelDashboard: hasPermission('show_gtel_dashboard', admin),
    canShowSuspiciousCall: hasPermission('show_suspicious_call', admin),
    canShowRecording: !isCaller,
  };
}
