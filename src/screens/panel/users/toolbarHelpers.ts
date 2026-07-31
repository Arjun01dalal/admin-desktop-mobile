import { formatDisplayDate } from '@/utils/dates';
import type { UserType } from './constants';
import type { UserRow } from './utils';

export const USERS_PAGE_SIZE_OPTIONS = [
  10, 25, 50, 75, 100, 250, 500, 10000,
] as const;

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

export function languageByState(state?: string): string {
  const map: Record<string, string> = {
    Maharashtra: 'Marathi',
    Gujarat: 'Gujarati',
    'Tamil Nadu': 'Tamil',
    Karnataka: 'Kannada',
    Telangana: 'Telugu',
    'Andhra Pradesh': 'Telugu',
    Kerala: 'Malayalam',
    'West Bengal': 'Bengali',
    Punjab: 'Punjabi',
  };
  return map[String(state || '')] || 'Hindi';
}

/** Map users → SubAdmin/add-to-dialer dialout_settings (laxminarayan addToDialer). */
export function mapUsersToBotSettings(
  rows: UserRow[],
  botId: string,
  reason: string,
): Record<string, unknown>[] {
  const bot = Number.parseInt(botId, 10) || 1;
  return rows.map((item) => {
    const obj: Record<string, unknown> = { botId: bot };
    if (item.mobile) obj.phone_number = item.mobile;
    if (item.clientName) obj.app_name = item.clientName;
    obj.language = languageByState(item.state);
    const clientName = String(item.name || '')
      .replace(/_/g, ' ')
      .trim();
    if (clientName) obj.client_name = clientName;
    if (item._id) obj.id = item._id;
    if (item.state) obj.state = item.state;
    if (item.city) obj.city = item.city;
    if (item.email) obj.email = item.email;
    if (item.activeUser) {
      const lastPlayed = formatDisplayDate(item.activeUser);
      if (lastPlayed) obj.last_played_date = lastPlayed;
    }
    if (reason) obj.reason = reason;
    return obj;
  });
}

/** Leads for external dialer batch (laxminarayan addDialerCalls). */
export function mapUsersToDialerLeads(rows: UserRow[]) {
  return rows.map((item) => {
    const name = String(item.name || '').replace(/_/g, ' ').trim();
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
