import { secureApi } from '@/api/secureClient';
import {
  getCachedEmpCodeNameMap,
  getEmpCodeNameMap as sharedGetEmpCodeNameMap,
  type EmpCodeNameFetchResult,
} from '@astro/shared';

export { getCachedEmpCodeNameMap };

/** Desktop wrapper — uses ops.callerAllotmentSubadmins (same as Caller Allotment). */
export async function getEmpCodeNameMap(options?: {
  forceRefresh?: boolean;
}): Promise<Record<string, string>> {
  return sharedGetEmpCodeNameMap(async () => {
    const res = await secureApi<EmpCodeNameFetchResult>('ops.callerAllotmentSubadmins', {
      filter: {},
    });
    if (!res.ok) return null;
    return (res.data as EmpCodeNameFetchResult) || null;
  }, options);
}
