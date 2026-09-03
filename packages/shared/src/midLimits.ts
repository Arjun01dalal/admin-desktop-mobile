/** Shared MID limits types and parsers — desktop + mobile. */
import { asList, unpackPayload } from './api/parse';

export type MidOption = {
  _id?: string;
  mid?: string | number;
  midName?: string;
  MID?: string;
  name?: string;
  paymentGatewayName?: string;
};

export type MidLimitRecord = {
  mid?: string;
  limit?: number;
  updatedBy?: { userId?: string; userName?: string };
  updatedOn?: string;
  updatedAt?: string;
};

export type MidLimitRow = {
  mid: string;
  gatewayName?: string;
  limit?: number;
  updatedBy?: { userId?: string; userName?: string };
  updatedOn?: string;
};

export type SubAdminOption = {
  _id?: string;
  name?: string;
  empCode?: string;
  block?: boolean;
  telegram_username?: string;
  telegramUsername?: string;
};

export type RoleGroup = {
  subAdmins?: SubAdminOption[];
};

export type RecipientsConfig = {
  telegramChatIds?: Array<number | string>;
  subAdminIds?: string[];
  enabled?: boolean;
};

export type MidLimitFetcher = (mid: string) => Promise<unknown>;

const LIMIT_FIELD_KEYS = [
  'limit',
  'depositLimit',
  'maxLimit',
  'limitAmount',
  'amount',
  'value',
  'midLimit',
  'deposit_limit',
  'max_limit',
] as const;

const MID_FIELD_KEYS = [
  'mid',
  'MID',
  'Mid',
  'merchantId',
  'merchant_id',
  'midName',
  'mid_name',
  'paymentGatewayName',
  'gatewayName',
  'gateway',
  'payinGateway',
  'name',
] as const;

const LIMIT_LIST_KEYS = [
  'items',
  'data',
  'limits',
  'rows',
  'list',
  'results',
  'midLimits',
  'records',
  'allLimits',
  'mid_limit_list',
] as const;

const WRAPPER_KEYS = ['payload', 'data', 'result', 'response'] as const;

const OBJECT_MAP_SKIP_KEYS = new Set([
  ...WRAPPER_KEYS,
  'updatedBy',
  'updated_by',
  'count',
  'total',
  'totalPages',
  'page',
  'pageSize',
  'success',
  'status',
  'message',
  'error',
  'alertRecipients',
  'recipients',
  'telegramChatIds',
  'subAdminIds',
  'enabled',
]);

function isConfigMidKey(mid: string): boolean {
  const normalized = mid.replace(/[\s_-]/g, '').toLowerCase();
  return (
    normalized === 'alertrecipients' ||
    normalized === 'recipients' ||
    normalized === 'telegramchatids' ||
    normalized === 'subadminids' ||
    normalized === 'enabled' ||
    normalized === 'config'
  );
}

/** Drill encrypted/unwrapped bodies down to arrays or limit maps. */
export function unwrapMidLimitsBody(data: unknown, depth = 0): unknown {
  if (data == null || depth > 8) return data;
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return data;

  const obj = data as Record<string, unknown>;

  for (const key of LIMIT_LIST_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return value;
  }

  for (const key of WRAPPER_KEYS) {
    const nested = obj[key];
    if (nested == null || nested === obj) continue;
    const unwrapped = unwrapMidLimitsBody(nested, depth + 1);
    if (unwrapped !== nested) return unwrapped;
  }

  return data;
}

const PER_MID_FETCH_CONCURRENCY = 8;

function pickLimitValue(row: Record<string, unknown>): number | undefined {
  for (const key of LIMIT_FIELD_KEYS) {
    const value = row[key];
    if (value == null) continue;
    if (typeof value === 'object') {
      const nested = pickLimitValue(value as Record<string, unknown>);
      if (nested != null) return nested;
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  for (const [key, value] of Object.entries(row)) {
    if (value == null || typeof value === 'object') continue;
    if (!/limit/i.test(key)) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  for (const nestedKey of ['limitDetails', 'details', 'limitInfo', 'item', 'record']) {
    const nested = row[nestedKey];
    if (nested && typeof nested === 'object') {
      const parsed = pickLimitValue(nested as Record<string, unknown>);
      if (parsed != null) return parsed;
    }
  }

  return undefined;
}

function pickMidValue(row: Record<string, unknown>): string {
  for (const key of MID_FIELD_KEYS) {
    const value = row[key];
    if (value == null) continue;
    const mid = String(value).trim();
    if (mid) return mid;
  }

  for (const [key, value] of Object.entries(row)) {
    if (value == null || typeof value === 'object') continue;
    if (!/(^mid$|mid|gateway|merchant|account|name)/i.test(key)) continue;
    const mid = String(value).trim();
    if (mid) return mid;
  }

  return '';
}

function normalizeUpdatedBy(value: unknown): MidLimitRecord['updatedBy'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const userId = row.userId ?? row.user_id ?? row.id;
  const userName = row.userName ?? row.user_name ?? row.name;
  if (userId == null && userName == null) return undefined;
  return {
    userId: userId != null ? String(userId) : undefined,
    userName: userName != null ? String(userName) : undefined,
  };
}

export function normalizeMidLimitRecord(
  item: unknown,
  midOverride?: string,
): MidLimitRecord | null {
  if (item == null) return null;

  if (typeof item === 'number' || typeof item === 'string') {
    const mid = String(midOverride || '').trim();
    if (!mid) return null;
    const limit = Number(item);
    if (!Number.isFinite(limit)) return null;
    return { mid, limit };
  }

  if (typeof item !== 'object') return null;

  const row = item as Record<string, unknown>;
  const mid = String(midOverride || pickMidValue(row)).trim();
  if (!mid) return null;

  const limit = pickLimitValue(row);
  const updatedBy = normalizeUpdatedBy(row.updatedBy ?? row.updated_by);
  const updatedOnRaw = row.updatedOn ?? row.updated_on ?? row.updatedAt ?? row.updated_at;

  return {
    mid,
    limit,
    updatedBy,
    updatedOn: updatedOnRaw != null ? String(updatedOnRaw) : undefined,
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined,
  };
}

export function findMidLimitRecord(
  map: Map<string, MidLimitRecord>,
  mid: string,
): MidLimitRecord | undefined {
  const direct = map.get(mid);
  if (direct) return direct;

  const lower = mid.trim().toLowerCase();
  if (!lower) return undefined;

  for (const [key, value] of map) {
    if (key.trim().toLowerCase() === lower) return value;
  }

  return undefined;
}

export function parseMidLimits(data: unknown): Map<string, MidLimitRecord> {
  const map = new Map<string, MidLimitRecord>();

  const add = (record: MidLimitRecord | null) => {
    if (!record?.mid || isConfigMidKey(record.mid)) return;
    const existing = findMidLimitRecord(map, record.mid);
    const merged: MidLimitRecord = existing
      ? {
          ...existing,
          ...record,
          limit:
            record.limit != null && Number.isFinite(record.limit) ? record.limit : existing.limit,
        }
      : record;
    map.set(String(merged.mid), merged);
  };

  const ingest = (input: unknown, midHint?: string, depth = 0): void => {
    if (input == null || depth > 6) return;

    if (Array.isArray(input)) {
      input.forEach((item) => ingest(item, undefined, depth + 1));
      return;
    }

    if (typeof input !== 'object') {
      if (midHint) add(normalizeMidLimitRecord(input, midHint));
      return;
    }

    const obj = input as Record<string, unknown>;
    add(normalizeMidLimitRecord(obj, midHint));

    for (const key of WRAPPER_KEYS) {
      const nested = obj[key];
      if (nested != null && nested !== obj) ingest(nested, undefined, depth + 1);
    }

    for (const key of LIMIT_LIST_KEYS) {
      const list = obj[key];
      if (Array.isArray(list)) {
        list.forEach((item) => ingest(item, undefined, depth + 1));
      } else if (list && typeof list === 'object') {
        ingest(list, undefined, depth + 1);
      }
    }

    for (const key of ['item', 'record', 'midLimitData'] as const) {
      const nested = obj[key];
      if (nested && typeof nested === 'object') ingest(nested, midHint, depth + 1);
    }

    const parallelMids = obj.mids ?? obj.midList ?? obj.midNames;
    const parallelLimits = obj.limits ?? obj.limitValues ?? obj.limitList;
    if (Array.isArray(parallelMids) && Array.isArray(parallelLimits)) {
      const limitsAreScalars = parallelLimits.every(
        (value) => typeof value === 'number' || typeof value === 'string',
      );
      if (limitsAreScalars) {
        parallelMids.forEach((midValue, index) => {
          const mid = String(midValue || '').trim();
          if (!mid) return;
          add(normalizeMidLimitRecord(parallelLimits[index], mid));
        });
      } else {
        ingest(parallelLimits, undefined, depth + 1);
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (OBJECT_MAP_SKIP_KEYS.has(key) || isConfigMidKey(key)) continue;
      if (!key.trim()) continue;
      ingest(value, key.trim(), depth + 1);
    }
  };

  ingest(unpackMidLimitsInput(data));
  return map;
}

function unpackMidLimitsInput(data: unknown): unknown {
  return unwrapMidLimitsBody(data);
}

function indexMidOptions(options: MidOption[]): Map<string, MidOption> {
  const index = new Map<string, MidOption>();
  for (const option of options) {
    for (const alias of [
      String(option.mid ?? ''),
      String(option.midName ?? ''),
      String(option.MID ?? ''),
      String(option.name ?? ''),
      String(option.paymentGatewayName ?? ''),
    ]) {
      const key = alias.trim().toLowerCase();
      if (key) index.set(key, option);
    }
  }
  return index;
}

function gatewayLabelForOption(
  option: MidOption | undefined,
  fallbackMid: string,
): string | undefined {
  const label = String(
    option?.paymentGatewayName || option?.name || option?.midName || option?.mid || fallbackMid,
  ).trim();
  return label || undefined;
}

export function resolveMidLimitForOption(
  limitsMap: Map<string, MidLimitRecord>,
  option: MidOption,
): MidLimitRecord | undefined {
  const candidates = [
    String(option.mid ?? '').trim(),
    String(option.name ?? '').trim(),
    String(option.paymentGatewayName ?? '').trim(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const rec = findMidLimitRecord(limitsMap, candidate);
    if (rec?.limit != null && Number.isFinite(Number(rec.limit))) {
      return rec;
    }
  }

  const gateway = String(option.paymentGatewayName || option.name || '')
    .trim()
    .toLowerCase();
  if (gateway) {
    for (const [key, rec] of limitsMap) {
      if (rec.limit == null || !Number.isFinite(Number(rec.limit))) continue;
      if (key.trim().toLowerCase() === gateway) {
        return { ...rec, mid: String(option.mid || key) };
      }
    }
  }

  return undefined;
}

export function resolveMidLimitRecord(
  data: unknown,
  fallbackMid: string,
  fallbackLimit: number,
): MidLimitRecord {
  const map = parseMidLimits(data);
  const fromMap = findMidLimitRecord(map, fallbackMid);
  if (fromMap?.limit != null && Number.isFinite(fromMap.limit)) {
    return { ...fromMap, mid: fallbackMid };
  }

  const single = normalizeMidLimitRecord(data, fallbackMid);
  if (single?.limit != null && Number.isFinite(single.limit)) {
    return { ...single, mid: fallbackMid };
  }

  return { mid: fallbackMid, limit: fallbackLimit };
}

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;

  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });

  await Promise.all(runners);
}

export async function collectMidLimitsMap(
  bulkData: unknown,
  options: MidOption[],
  fetchOne?: MidLimitFetcher,
): Promise<Map<string, MidLimitRecord>> {
  const map = parseMidLimits(bulkData);
  if (!fetchOne || !options.length) return map;

  const missing = options.filter((option) => {
    const rec =
      resolveMidLimitForOption(map, option) ||
      findMidLimitRecord(map, String(option.mid || '').trim());
    return !(rec?.limit != null && Number.isFinite(rec.limit));
  });
  if (!missing.length) return map;

  await runInBatches(missing, PER_MID_FETCH_CONCURRENCY, async (option) => {
    const mid = String(option.mid || option.name || option.paymentGatewayName || '').trim();
    if (!mid) return;

    try {
      const data = await fetchOne(mid);
      const parsed = parseMidLimits(data);
      for (const [, value] of parsed) {
        if (value.limit != null && Number.isFinite(value.limit)) {
          map.set(mid, { ...value, mid });
        }
      }

      const resolved = resolveMidLimitRecord(data, mid, Number.NaN);
      if (resolved.limit != null && Number.isFinite(resolved.limit)) {
        map.set(mid, { ...resolved, mid });
      }
    } catch {
      /* ignore per-MID fetch failures */
    }
  });

  return map;
}

export function applyMidLimitUpsert(rows: MidLimitRow[], record: MidLimitRecord): MidLimitRow[] {
  const target = String(record.mid || '')
    .trim()
    .toLowerCase();
  if (!target) return rows;

  return rows.map((row) => {
    if (row.mid.trim().toLowerCase() !== target) return row;
    return {
      ...row,
      limit: record.limit != null && Number.isFinite(record.limit) ? record.limit : row.limit,
      updatedBy: record.updatedBy ?? row.updatedBy,
      updatedOn: record.updatedOn || record.updatedAt || row.updatedOn,
    };
  });
}

export function parseMidOptions(data: unknown): MidOption[] {
  const unwrapped = unwrapMidLimitsBody(data);
  const raw = Array.isArray(unwrapped)
    ? unwrapped
    : (() => {
        if (unwrapped && typeof unwrapped === 'object') {
          const body = unwrapped as Record<string, unknown>;
          if (Array.isArray(body.items)) return body.items;
        }
        return asList<unknown>(data);
      })();

  return raw
    .map((option): MidOption | null => {
      if (typeof option === 'string') {
        const label = option.trim();
        return label ? { mid: label, name: label, paymentGatewayName: label } : null;
      }
      if (!option || typeof option !== 'object') return null;

      const row = option as MidOption;
      const mid = String(row.mid ?? row.midName ?? row.MID ?? '').trim();
      if (mid) {
        return {
          ...row,
          mid,
          paymentGatewayName: String(row.paymentGatewayName || row.name || mid).trim() || mid,
        };
      }

      const fallback = String(row.name ?? row.paymentGatewayName ?? '').trim();
      if (!fallback) return null;
      return {
        ...row,
        mid: fallback,
        paymentGatewayName: String(row.paymentGatewayName || fallback).trim() || fallback,
      };
    })
    .filter((option): option is MidOption => Boolean(option?.mid && String(option.mid).trim()));
}

export function parseRecipientsConfig(data: unknown): RecipientsConfig {
  const body = unpackPayload(data);
  const source =
    body.alertRecipients && typeof body.alertRecipients === 'object'
      ? (body.alertRecipients as RecipientsConfig)
      : body.recipients && typeof body.recipients === 'object'
        ? (body.recipients as RecipientsConfig)
        : body;

  const telegramChatIds = Array.isArray(source.telegramChatIds)
    ? source.telegramChatIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];

  const subAdminIds = Array.isArray(source.subAdminIds)
    ? source.subAdminIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  return {
    telegramChatIds,
    subAdminIds,
    enabled: source.enabled !== false,
  };
}

/** Read `alertRecipients` from POST /payinAccounts/mid-limits/get bulk response. */
export function parseAlertRecipientsFromLimitsGet(data: unknown): RecipientsConfig | null {
  if (data == null) return null;

  const queue: unknown[] = [data];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (current == null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const obj = current as Record<string, unknown>;
    const raw = obj.alertRecipients;
    if (raw != null) {
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        return parseRecipientsConfig(raw);
      }
      return parseRecipientsConfig({ alertRecipients: raw });
    }

    for (const key of WRAPPER_KEYS) {
      const nested = obj[key];
      if (nested && typeof nested === 'object') queue.push(nested);
    }
  }

  return null;
}

export type AlertRecipientDisplay = {
  key: string;
  label: string;
  detail?: string;
};

export function buildAlertRecipientDisplayList(
  config: RecipientsConfig | null | undefined,
  subAdminOptions: SubAdminOption[] = [],
): AlertRecipientDisplay[] {
  if (!config) return [];

  const byId = new Map(subAdminOptions.map((sub) => [String(sub._id), sub]));
  const list: AlertRecipientDisplay[] = [];

  for (const rawId of config.subAdminIds || []) {
    const id = String(rawId).trim();
    if (!id) continue;

    const sub = byId.get(id);
    const name = String(sub?.name || id).trim();
    const telegram = sub ? getSubAdminTelegramLabel(sub) : '';
    list.push({
      key: `sub:${id}`,
      label: name,
      detail: telegram || undefined,
    });
  }

  return list;
}

export function formatAlertRecipientsSummary(
  config: RecipientsConfig | null | undefined,
  displays: AlertRecipientDisplay[] = [],
): string {
  if (!config) return 'No alert recipients configured';
  if (config.enabled === false) return 'Alerts disabled';
  if (!displays.length) return 'No recipients configured';
  return displays
    .map((item) => (item.detail ? `${item.label} (${item.detail})` : item.label))
    .join(', ');
}

export function getSubAdminTelegramLabel(sub: SubAdminOption): string {
  return String(sub.telegram_username || sub.telegramUsername || '').trim();
}

/** Numeric chat ID or username (e.g. TRIGNOWALTZ) saved on the sub-admin profile. */
export function getSubAdminTelegramRecipientId(sub: SubAdminOption): string | number | null {
  const raw = getSubAdminTelegramLabel(sub);
  if (!raw) return null;

  const normalized = raw.replace(/^@/, '').trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return normalized;
}

/** @deprecated Prefer getSubAdminTelegramRecipientId — kept for numeric-only callers. */
export function getSubAdminTelegramChatId(sub: SubAdminOption): number | null {
  const recipient = getSubAdminTelegramRecipientId(sub);
  return typeof recipient === 'number' ? recipient : null;
}

export function buildSubAdminOptions(data: unknown): SubAdminOption[] {
  const body = data as { byRole?: RoleGroup[] } | null;
  return [
    ...new Map(
      (body?.byRole ?? [])
        .flatMap((group) => group.subAdmins || [])
        .map((sub) => [String(sub._id), sub] as const),
    ).values(),
  ]
    .filter((sub) => sub._id && !sub.block)
    .sort((a, b) => {
      const aHas = getSubAdminTelegramRecipientId(a) != null ? 0 : 1;
      const bHas = getSubAdminTelegramRecipientId(b) != null ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

export function mergeSavedRecipientSelection(
  config: RecipientsConfig,
  options: SubAdminOption[],
): string[] {
  const selected = new Set((config.subAdminIds || []).map((id) => String(id)));
  const chatIds = new Set(
    (config.telegramChatIds || []).map((id) => String(id).replace(/^@/, '').toLowerCase()),
  );

  for (const sub of options) {
    const id = String(sub._id);
    const recipientId = getSubAdminTelegramRecipientId(sub);
    if (selected.has(id)) continue;

    if (recipientId != null && chatIds.has(String(recipientId).toLowerCase())) {
      selected.add(id);
      continue;
    }

    const label = getSubAdminTelegramLabel(sub).replace(/^@/, '').toLowerCase();
    if (label && chatIds.has(label)) {
      selected.add(id);
    }
  }

  return Array.from(selected);
}

export function mergeMidLimitRows(midData: unknown, limitsData: unknown): MidLimitRow[] {
  const limitsMap = limitsData instanceof Map ? limitsData : parseMidLimits(limitsData);
  const options = parseMidOptions(midData);
  const byAlias = indexMidOptions(options);
  const rows = new Map<string, MidLimitRow>();

  const upsertRow = (mid: string, patch: Partial<MidLimitRow>) => {
    const trimmed = mid.trim();
    if (!trimmed || isConfigMidKey(trimmed)) return;
    const key = trimmed.toLowerCase();
    const option = byAlias.get(key);
    const prev = rows.get(key);
    rows.set(key, {
      mid: prev?.mid || String(option?.mid || trimmed).trim(),
      gatewayName: patch.gatewayName ?? prev?.gatewayName ?? gatewayLabelForOption(option, trimmed),
      limit:
        patch.limit != null && Number.isFinite(Number(patch.limit))
          ? Number(patch.limit)
          : prev?.limit,
      updatedBy: patch.updatedBy ?? prev?.updatedBy,
      updatedOn: patch.updatedOn ?? prev?.updatedOn,
    });
  };

  for (const [limitKey, rec] of limitsMap) {
    if (isConfigMidKey(limitKey)) continue;
    if (rec.limit == null || !Number.isFinite(Number(rec.limit))) continue;

    const option = byAlias.get(limitKey.trim().toLowerCase());
    const displayMid = String(option?.mid || limitKey).trim();
    upsertRow(displayMid, {
      limit: Number(rec.limit),
      updatedBy: rec.updatedBy,
      updatedOn: rec.updatedOn || rec.updatedAt,
    });
  }

  for (const option of options) {
    const mid = String(option.mid || '').trim();
    if (!mid) continue;
    upsertRow(mid, {});
  }

  return Array.from(rows.values()).sort((a, b) => a.mid.localeCompare(b.mid));
}

export function filterMidLimitRows(rows: MidLimitRow[], search: string): MidLimitRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.mid.toLowerCase().includes(q)) return true;
    if ((row.gatewayName || '').toLowerCase().includes(q)) return true;
    return false;
  });
}

export function filterSubAdminOptions(options: SubAdminOption[], search: string): SubAdminOption[] {
  const q = search.trim().toLowerCase();
  if (!q) return options;
  return options.filter((sub) => {
    const name = String(sub.name || '').toLowerCase();
    const empCode = String(sub.empCode || '').toLowerCase();
    const telegram = getSubAdminTelegramLabel(sub).toLowerCase();
    const id = String(sub._id || '').toLowerCase();
    return name.includes(q) || empCode.includes(q) || telegram.includes(q) || id.includes(q);
  });
}

export function parseLimitDraft(raw: string): number | null {
  const limit = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(limit) || limit < 0) return null;
  return limit;
}

export function formatMidLimitAmount(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return 'Not set';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

/** Gateway column label — falls back to MID when getAllMidOld returns names only. */
export function midLimitGatewayLabel(row: Pick<MidLimitRow, 'mid' | 'gatewayName'>): string {
  return String(row.gatewayName || row.mid || '').trim();
}

export function parseTelegramChatIdDraft(raw: string): number | null {
  const trimmed = raw.replace(/,/g, '').trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatTelegramChatIdsDraft(chatIds: Array<number | string> | undefined): string {
  if (!Array.isArray(chatIds) || !chatIds.length) return '';
  return chatIds
    .map((id) => String(id).trim())
    .filter(Boolean)
    .join(', ');
}

export function parseTelegramChatIdsListDraft(raw: string): number[] | null {
  const parts = raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const ids: number[] = [];
  for (const part of parts) {
    const parsed = parseTelegramChatIdDraft(part);
    if (parsed == null) return null;
    ids.push(parsed);
  }
  return ids;
}

export function buildTelegramChatIdsDraftFromConfig(config?: RecipientsConfig): string {
  return formatTelegramChatIdsDraft(config?.telegramChatIds);
}

/** @deprecated Per-sub-admin chat IDs replaced by a single telegramChatIds field. */
export function buildRecipientChatIdDrafts(
  selectedSubAdminIds: string[],
  subAdminOptions: SubAdminOption[],
  config?: RecipientsConfig,
): Record<string, string> {
  const drafts: Record<string, string> = {};
  const savedSubIds = (config?.subAdminIds || []).map(String);
  const savedChatIds = config?.telegramChatIds || [];
  const savedBySubId = new Map<string, number>();

  savedSubIds.forEach((subId, index) => {
    const parsed = Number(savedChatIds[index]);
    if (Number.isFinite(parsed) && parsed > 0) {
      savedBySubId.set(subId, parsed);
    }
  });

  for (const subAdminId of selectedSubAdminIds) {
    const fromSaved = savedBySubId.get(subAdminId);
    if (fromSaved != null) {
      drafts[subAdminId] = String(fromSaved);
      continue;
    }

    const sub = subAdminOptions.find((item) => String(item._id) === subAdminId);
    const fromProfile = sub ? getSubAdminTelegramChatId(sub) : null;
    drafts[subAdminId] = fromProfile != null ? String(fromProfile) : '';
  }

  return drafts;
}

export function ensureRecipientChatIdDraft(
  subAdminId: string,
  subAdminOptions: SubAdminOption[],
  currentDrafts: Record<string, string>,
): Record<string, string> {
  if (Object.prototype.hasOwnProperty.call(currentDrafts, subAdminId)) {
    return currentDrafts;
  }

  const sub = subAdminOptions.find((item) => String(item._id) === subAdminId);
  const fromProfile = sub ? getSubAdminTelegramChatId(sub) : null;
  return {
    ...currentDrafts,
    [subAdminId]: fromProfile != null ? String(fromProfile) : '',
  };
}

export type RecipientsSavePayload = {
  telegramChatIds?: number[];
  subAdminIds: string[];
  enabled: boolean;
};

export function buildRecipientsSavePayload(
  selectedSubAdminIds: string[],
  _subAdminOptions: SubAdminOption[],
  alertsEnabled: boolean,
  telegramChatIdsDraft: string,
): { ok: true; payload: RecipientsSavePayload } | { ok: false; error: string } {
  if (!selectedSubAdminIds.length) {
    return { ok: false, error: 'Select at least one sub-admin' };
  }

  const draft = telegramChatIdsDraft.trim();
  let telegramChatIds: number[] | undefined;

  if (draft) {
    const parsed = parseTelegramChatIdsListDraft(draft);
    if (!parsed?.length) {
      return {
        ok: false,
        error: 'Enter valid numeric Telegram Chat IDs (comma-separated)',
      };
    }
    telegramChatIds = parsed;
  }

  const payload: RecipientsSavePayload = {
    subAdminIds: selectedSubAdminIds.map(String),
    enabled: alertsEnabled,
  };

  if (telegramChatIds?.length) {
    payload.telegramChatIds = telegramChatIds;
  }

  return { ok: true, payload };
}
