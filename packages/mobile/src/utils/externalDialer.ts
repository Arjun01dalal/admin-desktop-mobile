/**
 * External dialer batch push — port of desktop electron/secure externalDialerBatch.
 * The dialer is a plain HTTPS API (api|api2.ganesha999.com), so mobile can call
 * it directly with fetch; no desktop bridge needed.
 */

export type DialerLeadSource = {
  _id?: string;
  name?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
};

const DIALER_SERVER_MAP: Record<string, string> = {
  '1': 'api2',
  '3': 'api',
  '49.206.26.7': 'api2',
  '3.200': 'api',
};

/** Prefer campaign id: K_3001 / 3001 → api; 1011 → api2 (same as desktop / laxmi). */
function dialerPrefixFromCampaignId(campaignId: unknown): string | null {
  const raw = String(campaignId ?? '').trim();
  if (!raw) return null;
  const stripped = raw.replace(/^[A-Za-z]+_/i, '');
  if (/^3/.test(stripped)) return 'api';
  if (/^1/.test(stripped)) return 'api2';
  return null;
}

function dialerBaseUrl(serverId: unknown, campaignId?: unknown): string | null {
  let prefix = dialerPrefixFromCampaignId(campaignId);
  if (!prefix) {
    const key = String(serverId ?? '').trim();
    prefix = DIALER_SERVER_MAP[key];
    if (!prefix) {
      if (key.startsWith('49.')) prefix = 'api2';
      else if (key.startsWith('3.')) prefix = 'api';
      else if (key.startsWith('1.')) prefix = 'api2';
      else prefix = 'api';
    }
  }
  if (prefix !== 'api' && prefix !== 'api2') return null;
  return `https://${prefix}.ganesha999.com/API/`;
}

/** Same shape the web panel sends (mapUsersToDialerLeads + sanitizeDialerLead). */
function toLead(item: DialerLeadSource) {
  const name = String(item.name || '').replace(/_/g, ' ').trim();
  const [first = name, ...rest] = name.split(' ');
  return {
    first_name: first.slice(0, 120),
    last_name: rest.join(' ').slice(0, 120),
    phone_number: String(item.mobile || '').replace(/\D/g, '').slice(0, 20),
    city: String(item.city ?? '').slice(0, 80),
    state: String(item.state ?? '').slice(0, 80),
    email: String(item.clientName || '').slice(0, 120),
    comments: String(item.clientName || '').slice(0, 200),
    province: String(item._id || '').slice(0, 80),
  };
}

function isDialerSuccess(data: Record<string, unknown> | null): boolean {
  if (!data || typeof data !== 'object') return false;
  if (data.success === true || data.success === 'true' || data.success === 1) return true;
  const status = String(data.status || '').trim().toLowerCase();
  return status === 'success' || status === 'ok';
}

function randomDialerListId(): number {
  // Match web panel: Math.floor(10000 + Math.random() * 90000)
  return Math.floor(10000 + Math.random() * 90000);
}

/**
 * Single-lead push — port of desktop externalDialerSingle (CallingBtn "Call").
 * Uses the admin's numeric extension ID as the campaign and `9<ext>` as list id.
 */
export async function singleCallToDialer(args: {
  lead: DialerLeadSource;
  extensionId?: string[] | string;
  adminName?: string;
  serverId?: unknown;
}): Promise<{ ok: boolean; message: string }> {
  const ids = Array.isArray(args.extensionId)
    ? args.extensionId.map(String)
    : typeof args.extensionId === 'string' && args.extensionId.trim()
      ? [args.extensionId.trim()]
      : [];
  const numericId = ids.find((val) => /^\d+$/.test(val));
  if (!numericId) return { ok: false, message: 'Dialer extension ID not found for this admin' };

  // Call uses extension as campaign_id: 3xxx → api; 1xxx → api2
  const url = dialerBaseUrl(args.serverId, numericId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  const lead = toLead(args.lead);
  if (!lead.phone_number) return { ok: false, message: 'No valid phone number' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list_id: `9${numericId}`,
        list_name: `${String(args.adminName || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
        campaign_id: numericId,
        leads: [lead],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const ok = isDialerSuccess(data) || (data != null && data.success !== false);
    return { ok, message: String(data?.message || (ok ? 'Connected to dialer' : 'Connect dialer failed')) };
  } catch {
    return { ok: false, message: 'Could not reach the dialer server' };
  }
}

export async function addToDialerBatch(args: {
  campaignId: string;
  serverId?: string;
  leads: DialerLeadSource[];
  listId?: string | number;
  listName?: string;
}): Promise<{ ok: boolean; message: string }> {
  const campaignId = args.campaignId.trim();
  if (!campaignId) return { ok: false, message: 'Campaign should not be empty' };

  const leads = args.leads.map(toLead).filter((l) => l.phone_number);
  if (!leads.length) return { ok: false, message: 'No valid phone numbers selected' };

  const url = dialerBaseUrl(args.serverId, campaignId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list_id: args.listId ?? randomDialerListId(),
        list_name: String(args.listName || campaignId).slice(0, 120),
        campaign_id: campaignId.slice(0, 64),
        leads,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (isDialerSuccess(data)) {
      const inserted = data?.inserted ?? leads.length;
      return { ok: true, message: String(data?.message || `${inserted} inserted successfully.`) };
    }
    return { ok: false, message: String(data?.message || 'Failed to add to dialer') };
  } catch {
    return { ok: false, message: 'Could not reach the dialer server' };
  }
}
