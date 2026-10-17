/** Load caller options for C2C campaign create / edit / duplicate. */
import { useCallback, useEffect, useState } from 'react';

import { CALLER_ROLE_IDS, type C2cCallerOption } from '@astro/shared';

import { secureApi } from '../../../../api/client';

export function useC2cCallers(autoload = true) {
  const [callers, setCallers] = useState<C2cCallerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCallers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<{ byRole?: Array<{ roleId?: string; subAdmins?: unknown[] }> }>(
        'caller.subadminsByRole',
        { filter: {} },
      );
      if (!res.ok) return;
      const raw = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<
        string,
        unknown
      >;
      const nested =
        raw.payload && typeof raw.payload === 'object'
          ? (raw.payload as Record<string, unknown>)
          : null;
      const byRoleRaw = raw.byRole ?? nested?.byRole ?? (Array.isArray(res.data) ? res.data : []);
      const byRole = Array.isArray(byRoleRaw) ? byRoleRaw : [];
      const options: C2cCallerOption[] = [];
      for (const role of byRole) {
        const roleRow = (role && typeof role === 'object' ? role : {}) as Record<string, unknown>;
        if (!CALLER_ROLE_IDS.has(String(roleRow.roleId || ''))) continue;
        const subAdmins = Array.isArray(roleRow.subAdmins) ? roleRow.subAdmins : [];
        for (const row of subAdmins) {
          const r = row as Record<string, unknown>;
          if (r.block === true || r.Block === true) continue;
          const id = String(r._id || r.id || '').trim();
          if (!id) continue;
          const name = String(r.name || r.userName || '').trim();
          const empCode = String(r.empCode || '').trim();
          options.push({
            id,
            name: empCode ? `${name} (${empCode})` : name || 'Caller',
            empCode,
          });
        }
      }
      const deduped = new Map(options.map((o) => [o.id, o]));
      setCallers(Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoload) return;
    void loadCallers();
  }, [autoload, loadCallers]);

  return { callers, callersLoading: loading, loadCallers };
}
