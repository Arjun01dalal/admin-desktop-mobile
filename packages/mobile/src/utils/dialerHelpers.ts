/**
 * Dialer helpers — mobile parity with desktop users/toolbarHelpers.ts
 * (lowercase language codes + buildBotDialoutSetting for add-to-dialer).
 */

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

export type DialoutUserLike = {
  _id?: unknown;
  mobile?: unknown;
  userMobile?: unknown;
  clientName?: unknown;
  name?: unknown;
  userName?: unknown;
  state?: unknown;
  userState?: unknown;
  city?: unknown;
  userCity?: unknown;
  email?: unknown;
  activeUser?: unknown;
};

/**
 * One dialout_settings row for `POST /SubAdmin/add-to-dialer`
 * (desktop CallingBtn.initiateBotCall — strip empty/null/undefined only).
 */
export function buildBotDialoutSetting(
  item: DialoutUserLike,
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
  const state = item.state ?? item.userState;
  const raw: Record<string, unknown> = {
    phone_number: item.mobile || item.userMobile,
    app_name: item.clientName,
    language: languageByState(String(state || '')),
    // Keep underscores — matches live curl / laxmi (do not replace with spaces).
    client_name: item.name || item.userName,
    id: item._id,
    state,
    city: item.city ?? item.userCity,
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

/** Map users → SubAdmin/add-to-dialer dialout_settings. */
export function mapUsersToBotSettings(
  rows: DialoutUserLike[],
  botId: string,
  reason: string,
): Record<string, unknown>[] {
  return rows.map((item) => buildBotDialoutSetting(item, botId, reason));
}
