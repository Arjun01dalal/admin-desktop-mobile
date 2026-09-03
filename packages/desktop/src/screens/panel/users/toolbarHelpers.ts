import { pickPageSizes } from '@astro/shared/pagination';
import type { UserType } from './constants';
import type { UserRow } from './utils';

/** Shared sizes + Users-only extras (250 / 10000). */
export const USERS_PAGE_SIZE_OPTIONS = Array.from(
  new Set([...pickPageSizes([10, 25, 50, 75, 100, 500]), 250, 10000]),
).sort((a, b) => a - b);

export function reasonForUserType(type: UserType): string {
  switch (type) {
    case 'Non_Performing_User':
      return 'non_performing';
    case 'Todays_Active':
      return 'today_active_user';
    case 'Active_User':
      return 'active_user';
    case 'In_Active_Deposit':
      return 'inactive';
    default:
      return 'Daily User';
  }
}

/** Laxminarayan `stateLanguageMap` — lowercase language codes for add-to-dialer. */
const STATE_LANGUAGE_MAP: Record<string, string> = {
  Maharashtra: 'hindi',
  Gujarat: 'gujarati',
  Karnataka: 'kannada',
  'Tamil Nadu': 'tamil',
  Telangana: 'telugu',
  'Andhra Pradesh': 'telugu',
  Kerala: 'malayalam',
  'West Bengal': 'bengali',
  Punjab: 'punjabi',
  Haryana: 'hindi',
  'Uttar Pradesh': 'hindi',
  'Madhya Pradesh': 'hindi',
  Rajasthan: 'hindi',
  Bihar: 'hindi',
  Chhattisgarh: 'hindi',
  Jharkhand: 'hindi',
  Uttarakhand: 'hindi',
  'Himachal Pradesh': 'hindi',
  Delhi: 'hindi',
  'Jammu and Kashmir': 'urdu',
  Ladakh: 'hindi',
  Goa: 'konkani',
  Odisha: 'odia',
  Tripura: 'bengali',
  Assam: 'assamese',
  Meghalaya: 'hindi',
  Manipur: 'meitei',
  Nagaland: 'english',
  Mizoram: 'mizo',
  'Arunachal Pradesh': 'english',
  Sikkim: 'nepali',
  Puducherry: 'tamil',
  Chandigarh: 'hindi',
  'Andaman and Nicobar Islands': 'hindi',
  Lakshadweep: 'malayalam',
  'Dadra and Nagar Haveli and Daman and Diu': 'gujarati',
};

export function languageByState(state?: string): string {
  return STATE_LANGUAGE_MAP[String(state || '')] || 'hindi';
}

/**
 * One dialout_settings row for `POST /SubAdmin/add-to-dialer`
 * (laxminarayan CallingBtn.initiateBotCall — strip empty/null/undefined only).
 */
export function buildBotDialoutSetting(
  item: UserRow,
  botId: string | number | undefined,
  reason: string,
): Record<string, unknown> {
  let lastPlayed: string | undefined;
  if (item.activeUser) {
    const raw = String(item.activeUser);
    // Laxmi: DD-MM-YYYY → reverse join then toLocaleDateString('en-GB', long month)
    const parsed =
      raw.includes('-') && raw.length <= 10
        ? new Date(raw.split('-').reverse().join('-'))
        : new Date(raw);
    lastPlayed = Number.isNaN(parsed.getTime())
      ? 'Invalid Date'
      : parsed.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  }

  const bot = Number.parseInt(String(botId ?? '1'), 10);
  const raw: Record<string, unknown> = {
    phone_number: item.mobile || item.userMobile,
    app_name: item.clientName,
    language: languageByState(String(item.state || '')),
    // Keep underscores — matches live curl / laxmi (do not replace with spaces).
    client_name: item.name || item.userName,
    id: item._id,
    state: item.state,
    city: item.city,
    last_played_date: lastPlayed,
    email: item.email,
    reason: reason || 'User List',
    botId: Number.isFinite(bot) && bot > 0 ? bot : 1,
  };

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  );
}

/** Map users → SubAdmin/add-to-dialer dialout_settings (laxminarayan addToDialer). */
export function mapUsersToBotSettings(
  rows: UserRow[],
  botId: string,
  reason: string,
): Record<string, unknown>[] {
  return rows.map((item) => buildBotDialoutSetting(item, botId, reason));
}

/** Leads for external dialer batch (laxminarayan addDialerCalls). */
export type DialerLeadSource = {
  _id?: string;
  name?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
};

export function mapUsersToDialerLeads(rows: DialerLeadSource[]) {
  return rows.map((item) => {
    const name = String(item.name || '')
      .replace(/_/g, ' ')
      .trim();
    const [first = name, ...rest] = name.split(' ');
    return {
      first_name: first,
      last_name: rest.join(' ') || '',
      phone_number: String(item.mobile || ''),
      city: String(item.city || ''),
      state: String(item.state || ''),
      email: String(item.clientName || ''),
      comments: String(item.clientName || ''),
      province: String(item._id || ''),
    };
  });
}

export function todayIstYmd(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function unpackGlobalsPayload(data: unknown): UserRow[] {
  if (Array.isArray(data)) return data as UserRow[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  if (Array.isArray(nested.payload)) return nested.payload as UserRow[];
  if (Array.isArray(nested.items)) return nested.items as UserRow[];
  if (Array.isArray(nested.users)) return nested.users as UserRow[];
  if (Array.isArray(obj.items)) return obj.items as UserRow[];
  return [];
}
