/**
 * C2C Campaign Data — shared types & parsers
 * (admin-panel-domains C2cCampaignData / campaignApi parity).
 */

export type C2cCampaignCaller = {
  _id: string;
  name: string;
  empCode?: string;
  extensionId?: string | string[];
  assignedOn?: string;
};

export type C2cCampaignCreatedBy = {
  _id?: string;
  name?: string;
  empCode?: string;
};

export type C2cCampaignStats = {
  total: number;
  pending: number;
  assigned: number;
  completed: number;
};

export type C2cCampaign = {
  _id: string;
  campaignName: string;
  isActive: boolean;
  createdBy?: C2cCampaignCreatedBy;
  callers: C2cCampaignCaller[];
  data: C2cCampaignStats;
  createdAt?: string;
  updatedAt?: string;
};

export type C2cCustomerStatus = 'pending' | 'assigned' | 'completed' | '';

export type C2cCampaignCustomer = {
  _id: string;
  dp_id?: string;
  userId?: string;
  name?: string;
  mobile?: string;
  phone?: string;
  appName?: string;
  lastActivity?: string;
  status?: string;
  assignedTo?: unknown;
  assignedAt?: string;
  completedAt?: string;
  callId?: string;
  [key: string]: unknown;
};

export type C2cCallerOption = {
  id: string;
  name: string;
  empCode?: string;
};

export type C2cNextCampaignCall = {
  campaignDataId: string;
  userId: string;
  phoneNumber: string;
  name?: string;
  appName?: string;
  lastActivity?: string;
  previousNote?: unknown;
  authUrl?: string;
  userMobile?: string;
  raw?: unknown;
};

export type C2cAddCustomersResult = {
  requested?: number;
  inserted?: number;
  skipped?: {
    notFound?: { count?: number; sample?: string[] };
    blocked?: { count?: number; sample?: string[] };
    alreadyInCampaign?: { count?: number; sample?: string[] };
    inOtherCampaign?: { count?: number; sample?: string[] };
  };
  summary?: string;
};

export const C2C_EMPTY_STATS: C2cCampaignStats = {
  total: 0,
  pending: 0,
  assigned: 0,
  completed: 0,
};

export const C2C_CAMPAIGN_PAGE_SIZE = 25;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const data = p.data;
  const dataObj = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const candidates = [
    p.items,
    p.docs,
    p.list,
    p.records,
    p.results,
    p.rows,
    p.customers,
    p.campaignData,
    Array.isArray(data) ? data : dataObj?.items,
    dataObj?.docs,
    dataObj?.list,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function looksLikeCampaignRow(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    row.campaignName != null ||
    (row._id != null && (Array.isArray(row.callers) || row.isActive != null || row.active != null))
  );
}

function resolvePayload(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;

  // After secureApi unwrap, the body is often the campaign itself. Campaign.stats
  // live under `.data` — do not treat that as another envelope.
  if (
    looksLikeCampaignRow(body) ||
    b.campaign != null ||
    Array.isArray(b.items) ||
    Array.isArray(b.docs) ||
    Array.isArray(b.list) ||
    Array.isArray(b.records) ||
    Array.isArray(b.customers) ||
    Array.isArray(b.campaignData)
  ) {
    return body;
  }

  const outer = b.data ?? b.payload ?? body;
  if (outer && typeof outer === 'object' && !Array.isArray(outer)) {
    const o = outer as Record<string, unknown>;
    if (
      looksLikeCampaignRow(outer) ||
      Array.isArray(o.items) ||
      Array.isArray(o.docs) ||
      Array.isArray(o.list) ||
      Array.isArray(o.records) ||
      o.campaign != null
    ) {
      return outer;
    }
    const nested = o.payload ?? o.data;
    if (nested !== undefined && !looksLikeCampaignRow(outer)) return nested;
  }
  return outer;
}

function coerceDateField(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.$date != null) return coerceDateField(obj.$date);
  }
  return undefined;
}

function normalizeCreatedBy(raw: unknown): C2cCampaignCreatedBy | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name } : undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const _id = firstString(row._id, row.id) || undefined;
  const name = firstString(row.name, row.userName, row.fullName, row.createdByName) || undefined;
  const empCode = firstString(row.empCode) || undefined;
  if (!_id && !name) return undefined;
  return { _id, name, empCode };
}

function pickPhone(row: Record<string, unknown>): string {
  const snap =
    (row.snapshot as Record<string, unknown> | undefined) ||
    (row.userSnapshot as Record<string, unknown> | undefined) ||
    (row.user as Record<string, unknown> | undefined) ||
    {};
  return firstString(
    row.userMobile,
    row.mobile,
    row.phone,
    row.phoneNumber,
    row.mobileNumber,
    row.contact,
    row.Mobile,
    snap.userMobile,
    snap.mobile,
    snap.phone,
    snap.phoneNumber,
    snap.mobileNumber,
    snap.contact,
  ).replace(/\D/g, '');
}

function toStats(raw: unknown): C2cCampaignStats {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    total: Number(r.total ?? 0) || 0,
    pending: Number(r.pending ?? 0) || 0,
    assigned: Number(r.assigned ?? 0) || 0,
    completed: Number(r.completed ?? 0) || 0,
  };
}

export function normalizeC2cCampaign(row: unknown): C2cCampaign {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const rawCallers = asArray(r.callers ?? r.callerList ?? r.assignedCallers);
  return {
    _id: String(r._id || r.id || ''),
    campaignName: String(r.campaignName || r.name || '').trim(),
    isActive: Boolean(r.isActive ?? r.active ?? false),
    createdBy: normalizeCreatedBy(r.createdBy ?? r.created_by ?? r.creator),
    callers: rawCallers
      .map((c) => {
        if (typeof c === 'string') {
          const id = c.trim();
          return id ? { _id: id, name: id } : null;
        }
        const caller = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
        const _id = String(caller._id || caller.id || '').trim();
        const name = firstString(caller.name, caller.userName, caller.fullName);
        if (!_id && !name) return null;
        return {
          _id: _id || name,
          name: name || _id || 'Caller',
          empCode: firstString(caller.empCode) || undefined,
          extensionId: caller.extensionId as string | string[] | undefined,
          assignedOn: coerceDateField(caller.assignedOn),
        };
      })
      .filter((c): c is C2cCampaignCaller => Boolean(c)),
    data: toStats(r.data || r.stats || C2C_EMPTY_STATS),
    createdAt: coerceDateField(r.createdAt ?? r.createdOn),
    updatedAt: coerceDateField(r.updatedAt ?? r.updatedOn),
  };
}

export function extractC2cCampaignList(body: unknown): { items: C2cCampaign[]; total: number } {
  const payload = (resolvePayload(body) ?? {}) as Record<string, unknown>;
  const rawList = pickList(payload);
  const items = rawList.map(normalizeC2cCampaign).filter((c) => c._id);
  const dataObj =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : null;
  const total =
    Number(payload.total ?? payload.totalCount ?? payload.count ?? dataObj?.total ?? items.length) ||
    items.length;
  return { items, total };
}

export function extractC2cCampaign(body: unknown): C2cCampaign | null {
  const payload = resolvePayload(body);
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const row = p.campaign ?? p.item ?? payload;
  const campaign = normalizeC2cCampaign(row);
  return campaign._id ? campaign : null;
}

export function extractC2cCampaignCustomers(body: unknown): {
  items: C2cCampaignCustomer[];
  total: number;
} {
  const payload = (resolvePayload(body) ?? {}) as Record<string, unknown>;
  const rawList = pickList(payload);
  const items: C2cCampaignCustomer[] = rawList.map((rowUnknown) => {
    const row = (rowUnknown && typeof rowUnknown === 'object' ? rowUnknown : {}) as Record<
      string,
      unknown
    >;
    const snap =
      (row.snapshot as Record<string, unknown> | undefined) ||
      (row.userSnapshot as Record<string, unknown> | undefined) ||
      (row.user as Record<string, unknown> | undefined) ||
      {};
    const phone = pickPhone(row);
    const userId = firstString(
      row.userId,
      row.dp_id,
      row.dpId,
      snap.userId,
      snap._id,
      snap.dp_id,
    );
    return {
      ...row,
      _id: String(row._id || row.id || ''),
      dp_id: userId,
      userId,
      name: firstString(row.name, row.userName, row.username, snap.name, snap.userName, snap.username),
      mobile: phone,
      phone,
      appName: firstString(row.appName, row.clientName, snap.appName, snap.clientName),
      lastActivity: firstString(row.lastActivity, row.activeUser, snap.lastActivity, snap.activeUser),
      status: String(row.status || '').toLowerCase(),
      assignedTo: row.assignedTo ?? row.assigned_to ?? null,
      assignedAt: firstString(row.assignedAt, row.assigned_at),
      completedAt: firstString(row.completedAt, row.completed_at),
      callId: firstString(row.callId, row.call_id),
    };
  });
  const dataObj =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : null;
  const total =
    Number(payload.total ?? payload.totalCount ?? payload.count ?? dataObj?.total ?? items.length) ||
    items.length;
  return { items, total };
}

function resolveAuthUrl(row: Record<string, unknown>, payload: Record<string, unknown>): string {
  const direct = firstString(
    row.authUrl,
    row.auth_url,
    row.loginUrl,
    row.login_url,
    row.url,
    row.redirectUrl,
    payload.authUrl,
    payload.loginUrl,
  );
  if (direct) return direct;

  const token = firstString(row.token, row.authToken, row.loginToken, payload.token, payload.authToken);
  if (!token) return '';
  if (/^https?:\/\//i.test(token)) return token;

  const base = firstString(row.authBaseUrl, row.appBaseUrl, payload.authBaseUrl, 'https://laxmi.powerplay247.com').replace(
    /\/$/,
    '',
  );
  return `${base}/auth?token=${encodeURIComponent(token)}`;
}

export function extractC2cNextCampaignCall(body: unknown): C2cNextCampaignCall | null {
  const payload = (resolvePayload(body) ?? {}) as Record<string, unknown>;
  const rowCandidate =
    payload.call ||
    payload.campaignData ||
    payload.nextCall ||
    payload.item ||
    payload.data ||
    payload;
  const row =
    rowCandidate && typeof rowCandidate === 'object' && !Array.isArray(rowCandidate)
      ? (rowCandidate as Record<string, unknown>)
      : null;
  if (!row) return null;

  const snap =
    (row.snapshot as Record<string, unknown> | undefined) ||
    (row.userSnapshot as Record<string, unknown> | undefined) ||
    (row.user as Record<string, unknown> | undefined) ||
    {};
  const campaignDataId = firstString(
    row._id,
    row.campaignDataId,
    (row.campaignData as Record<string, unknown> | undefined)?._id,
    row.id,
    payload.campaignDataId,
  );
  const userId = firstString(
    row.userId,
    row.dp_id,
    row.dpId,
    row.user_id,
    snap.userId,
    snap._id,
    snap.dp_id,
    payload.userId,
  );
  const phoneNumber = firstString(pickPhone(row), pickPhone(snap), pickPhone(payload));
  const name = firstString(row.name, row.userName, row.username, snap.name, snap.userName);
  const appName = firstString(row.appName, row.clientName, snap.appName, snap.clientName);
  const lastActivity = firstString(row.lastActivity, row.activeUser, snap.lastActivity, snap.activeUser);
  const authUrl = resolveAuthUrl(row, payload);

  if (!phoneNumber && !campaignDataId && !userId) return null;

  return {
    campaignDataId,
    userId,
    phoneNumber,
    userMobile: phoneNumber,
    name: name || undefined,
    appName: appName || undefined,
    lastActivity: lastActivity || undefined,
    previousNote: row.previousNote ?? snap.previousNote ?? payload.previousNote,
    authUrl: authUrl || undefined,
    raw: row,
  };
}

export function extractC2cAddCustomersResult(body: unknown): C2cAddCustomersResult {
  const payload = (resolvePayload(body) ?? {}) as Record<string, unknown>;
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    requested: Number(payload.requested ?? 0) || 0,
    inserted: Number(payload.inserted ?? 0) || 0,
    skipped: (payload.skipped as C2cAddCustomersResult['skipped']) || {},
    summary: firstString(b.message, payload.message, typeof payload.summary === 'string' ? payload.summary : ''),
  };
}

export function formatC2cAssignedLabel(assignedTo: unknown): string {
  if (!assignedTo) return '';
  if (typeof assignedTo === 'string') return assignedTo;
  if (typeof assignedTo !== 'object') return '';
  const a = assignedTo as Record<string, unknown>;
  const name = String(a.name || '').trim();
  const emp = a.empCode ? ` (${a.empCode})` : '';
  if (name) return `${name}${emp}`;
  return String(a._id || '').trim();
}

export function formatC2cCreatorLabel(campaign: Pick<C2cCampaign, 'createdBy'>): string {
  const name = String(campaign.createdBy?.name || '').trim();
  const emp = String(campaign.createdBy?.empCode || '').trim();
  if (name && emp) return `${name} (${emp})`;
  return name || emp || '—';
}

export function formatC2cCallerChipLabel(caller: {
  name?: string;
  empCode?: string;
}): string {
  const name = String(caller.name || '').trim();
  const emp = String(caller.empCode || '').trim();
  if (name && emp) return `${name} · ${emp}`;
  return name || emp || 'Caller';
}

export function c2cCustomerStatusTone(
  status?: string | null,
): 'pending' | 'assigned' | 'completed' | 'muted' {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'assigned') return 'assigned';
  if (s === 'pending') return 'pending';
  return 'muted';
}

export function buildC2cCampaignListQuery(params: {
  pageNo?: number;
  itemsPerPage?: number;
  isActive?: boolean | '';
  callerId?: string;
  search?: string;
}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    pageNo: params.pageNo ?? 1,
    itemsPerPage: params.itemsPerPage ?? C2C_CAMPAIGN_PAGE_SIZE,
  };
  if (params.isActive === true || params.isActive === false) query.isActive = params.isActive;
  if (params.callerId?.trim()) query.callerId = params.callerId.trim();
  if (params.search?.trim()) query.search = params.search.trim();
  return query;
}

export function buildC2cCampaignDataQuery(params: {
  pageNo?: number;
  itemsPerPage?: number;
  status?: C2cCustomerStatus;
  assignedTo?: string;
  search?: string;
}): Record<string, string | number> {
  const query: Record<string, string | number> = {
    pageNo: params.pageNo ?? 1,
    itemsPerPage: params.itemsPerPage ?? C2C_CAMPAIGN_PAGE_SIZE,
  };
  if (params.status) query.status = params.status;
  if (params.assignedTo?.trim()) query.assignedTo = params.assignedTo.trim();
  if (params.search?.trim()) query.search = params.search.trim();
  return query;
}
