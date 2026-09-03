/**
 * empCode → caller/sub-admin name map.
 * Cached in localStorage; SubAdmin/subadmins-by-role at most 2 times per IST day
 * (morning + afternoon slot) — same API as Caller Allotment.
 */

const CACHE_KEY = 'empCodeNameCache_v1';
const MAX_CALLS_PER_DAY = 2;

export type EmpCodeNameCache = {
  date: string;
  calls: number;
  /** 0 = before 12:00 IST, 1 = after — at most one fetch per slot. */
  slots?: number[];
  map: Record<string, string>;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getStorage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (s && typeof s.getItem === 'function' && typeof s.setItem === 'function') {
      return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const getIstNow = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000);

export const getTodayIst = (): string => getIstNow().toISOString().split('T')[0];

/** Half-day slot: 0 = 00:00–11:59 IST, 1 = 12:00–23:59 IST. */
export const getIstDaySlot = (): number => (getIstNow().getUTCHours() < 12 ? 0 : 1);

export const readEmpCodeNameCache = (): EmpCodeNameCache | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmpCodeNameCache;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      date: String(parsed.date || ''),
      calls: Number(parsed.calls) || 0,
      slots: Array.isArray(parsed.slots)
        ? parsed.slots.map(Number).filter((n) => n === 0 || n === 1)
        : [],
      map: parsed.map && typeof parsed.map === 'object' ? parsed.map : {},
    };
  } catch {
    return null;
  }
};

export const writeEmpCodeNameCache = (cache: EmpCodeNameCache): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota / private mode */
  }
};

/** Sync read from today's cache (no API). */
export const getCachedEmpCodeNameMap = (): Record<string, string> => {
  const cached = readEmpCodeNameCache();
  if (cached?.date === getTodayIst()) return cached.map || {};
  return {};
};

export const buildEmpCodeNameMap = (
  byRole: Array<{ subAdmins?: Array<Record<string, unknown>> }> = [],
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const role of byRole) {
    for (const admin of role?.subAdmins || []) {
      const code = String(admin?.empCode || '').trim();
      if (!code) continue;
      const name = String(admin?.name || admin?.realName || admin?.userName || '').trim();
      if (name) map[code] = name;
    }
  }
  return map;
};

export type EmpCodeNameFetchResult = {
  byRole?: Array<{ subAdmins?: Array<Record<string, unknown>> }>;
};

/**
 * Returns empCode → name map.
 * Uses localStorage; calls fetchByRole at most twice per IST day
 * (once in morning slot, once in afternoon). Other page opens use cache.
 */
export async function getEmpCodeNameMap(
  fetchByRole: () => Promise<EmpCodeNameFetchResult | null | undefined>,
  options?: { forceRefresh?: boolean },
): Promise<Record<string, string>> {
  const today = getTodayIst();
  const slot = getIstDaySlot();
  const cached = readEmpCodeNameCache();
  const sameDay = cached?.date === today;
  const cachedMap = sameDay ? cached?.map || {} : {};
  const calls = sameDay ? cached?.calls || 0 : 0;
  const slots = sameDay ? cached?.slots || [] : [];
  const hasMap = Object.keys(cachedMap).length > 0;
  const slotDone = slots.includes(slot);

  if (!options?.forceRefresh && hasMap && slotDone) {
    return cachedMap;
  }

  if (calls >= MAX_CALLS_PER_DAY) {
    return cachedMap;
  }

  try {
    const data = await fetchByRole();
    const byRole = data?.byRole ?? [];
    const map = buildEmpCodeNameMap(byRole);
    const nextMap = Object.keys(map).length > 0 ? map : cachedMap;

    writeEmpCodeNameCache({
      date: today,
      calls: calls + 1,
      slots: Array.from(new Set([...slots, slot])),
      map: nextMap,
    });

    return nextMap;
  } catch {
    return cachedMap;
  }
}
