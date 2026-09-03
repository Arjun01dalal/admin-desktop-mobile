import { CLIENT_NAMES } from '@astro/shared/clientNames';

/**
 * Deterministic astro aliases for unknown providers / games.
 * Persisted so Reveal codes can reverse them for the session lifetime.
 */

const STORAGE_KEY = 'astroAutoProviderMap';

/** 27 nakshatras + a few graha names — pool for auto aliases. */
const ASTRO_POOL = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'PurvaPhalguni',
  'UttaraPhalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'PurvaAshadha',
  'UttaraAshadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'PurvaBhadrapada',
  'UttaraBhadrapada',
  'Revati',
  'Surya',
  'Chandra',
  'Mangala',
  'Budha',
  'Guru',
  'Shukra',
  'Shani',
  'Rahu',
  'Ketu',
  'Vivarta',
  'Abhijit',
  'Nakshatra',
  'Graha',
] as const;

/** Values that must never auto-alias (UI chrome, statuses, PII-ish fields). */
const AUTO_BLOCKLIST = new Set(
  [
    'pending',
    'approved',
    'rejected',
    'success',
    'failed',
    'active',
    'inactive',
    'blocked',
    'unblock',
    'select',
    'search',
    'name',
    'amount',
    'status',
    'action',
    'image',
    'mobile',
    'email',
    'city',
    'state',
    'address',
    'admin',
    'user',
    'users',
    'true',
    'false',
    'null',
    'undefined',
    'inr',
    'usd',
    'eur',
    'yes',
    'no',
    'none',
    'n/a',
    'na',
    'human',
    'bot',
    'loss',
    'profit',
    'deposit',
    'refund',
    'total',
    'count',
    'details',
    'history',
    'report',
    'today',
    'yesterday',
    'welcome',
    'dashboard',
    'login',
    'logout',
    'password',
    'otp',
    'token',
    // App / client codes — never rewrite Deposit Config etc.
    ...CLIENT_NAMES.map((n) => n.toLowerCase()),
    'fairbet',
    'fairbets',
    'fb',
    'goldexchange',
    'betclub247',
    'gold247',
    'star247',
    'osgames',
    'astroadmin',
    'thirdeye',
    'thirdeyeastro',
  ].map((s) => s.toLowerCase()),
);

type AliasMap = Record<string, string>; // originalLower → jyotish

let cache: AliasMap | null = null;

function readStore(): AliasMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as AliasMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeStore(map: AliasMap): void {
  cache = map;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function reservedJyotishNames(): Set<string> {
  const set = new Set<string>(ASTRO_POOL.map((s) => s.toLowerCase()));
  // Avoid colliding with hardcoded UI jyotish terms from the static map.
  for (const name of [
    'ashwini',
    'exaltation',
    'chandra',
    'ketu',
    'vakra',
    'shani',
    'budha',
    'jyeshtha',
    'phalguni',
    'ascendant',
    'shatabhisha',
    'chitra',
    'pushya',
    'indu',
    'lagna',
    'dhana',
    'vyaya',
    'dakshina',
    'labha',
    'artha',
    'jaya',
    'rashi',
    'jiva',
    'nivritti',
    'vriddhi',
    'bhava',
    'phala',
    'siddhi',
    'sampat',
    'pushti',
    'panchang',
    'gochar',
    'panja',
    'varadan',
    'krida',
    'niyanta',
    'kridak',
    'vivarta',
    'rohiní',
    'rohini',
    'abhijit',
  ]) {
    set.add(name);
  }
  return set;
}

function pickAlias(originalKey: string, used: Set<string>): string {
  const h = hashString(originalKey);
  const reserved = reservedJyotishNames();
  for (let i = 0; i < ASTRO_POOL.length * 3; i += 1) {
    const base = ASTRO_POOL[(h + i) % ASTRO_POOL.length];
    const candidate = i < ASTRO_POOL.length ? base : `${base}-${(h % 900) + 100}`;
    const low = candidate.toLowerCase();
    if (reserved.has(low) && i < ASTRO_POOL.length) continue;
    if (used.has(low)) continue;
    return candidate;
  }
  return `Nakshatra-${(h % 9000) + 1000}`;
}

/** True when a full cell/title value looks like a provider or game brand. */
export function isAutoMapCandidate(value: string): boolean {
  const t = value.trim();
  if (t.length < 3 || t.length > 64) return false;
  if (AUTO_BLOCKLIST.has(t.toLowerCase())) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  if (/^[a-f0-9]{24}$/i.test(t)) return false; // mongo id
  if (/^\+?\d{8,15}$/.test(t)) return false; // mobile
  if (t.includes('@')) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false; // date

  // Hyphenated / en-dash brands: Evolution - Ezugi
  if (/[-–—]/.test(t) && /^[A-Za-z0-9][A-Za-z0-9 _.–—-]*$/.test(t)) {
    return true;
  }

  // Multi-word: only brand-like phrases
  if (/\s/.test(t)) {
    return /gaming|play|soft|tech|casino|live|slots|studio|games|provider|evolution|ezugi|jacktop|pragmatic|netent/i.test(
      t,
    );
  }

  // camelCase / PascalCase compound: JackTop, PragmaticPlay, NetEnt
  if (/[a-z][A-Z]/.test(t)) return true;

  // ALL CAPS studio codes: QTECH, WACS, EZUGI (not short app codes OS/SM)
  if (/^[A-Z]{4,16}$/.test(t)) return true;

  // Explicit brand keywords inside a single token
  if (
    /gaming|play|soft|tech|casino|slots|evolution|ezugi|jacktop|pragmatic|netent|spribe|bgaming|hacksaw/i.test(
      t,
    )
  ) {
    return true;
  }

  // Plain Title-case names (Rahul, Mumbai) — do NOT auto-map
  return false;
}

/**
 * Ensure `original` has a stable astro alias. Returns the jyotish name.
 * Idempotent — same original always maps to the same alias on this device.
 * Pass `force` for known domains (e.g. House Krida gameId) where plain
 * lowercase ids like "aviator" must still get an alias when unmapped.
 */
export function ensureAutoAstroAlias(original: string, opts?: { force?: boolean }): string {
  const trimmed = original.trim();
  if (!trimmed) return trimmed;
  if (!opts?.force && !isAutoMapCandidate(trimmed)) return trimmed;

  const key = trimmed.toLowerCase();
  const map = readStore();
  if (map[key]) return map[key];

  const used = new Set(Object.values(map).map((v) => v.toLowerCase()));
  const alias = pickAlias(key, used);
  map[key] = alias;
  writeStore(map);
  return alias;
}

export function lookupAutoAstroAlias(original: string): string | null {
  const key = original.trim().toLowerCase();
  if (!key) return null;
  return readStore()[key] ?? null;
}

/** Reverse auto alias → original (for Reveal codes). */
export function reverseAutoAstroAlias(text: string): string {
  const map = readStore();
  const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  let out = text;
  for (const [originalLower, jyotish] of entries) {
    if (!jyotish) continue;
    const re = new RegExp(jyotish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    // Restore original casing from first-seen key is lost — use stored key's
    // best-effort: prefer title-ish from lowercase key.
    const restored = originalLower.replace(/\b([a-z])/g, (c) => c.toUpperCase());
    out = out.replace(re, restored);
  }
  return out;
}

/** Apply auto alias to a full string when it is an unmapped provider/game name. */
export function applyAutoAstroIfNeeded(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const existing = lookupAutoAstroAlias(trimmed);
  if (existing) return text.replace(trimmed, existing);
  if (!isAutoMapCandidate(trimmed)) return text;
  // Only auto-map when the whole trimmed value is the candidate (not a sentence).
  if (trimmed !== text.trim()) return text;
  const alias = ensureAutoAstroAlias(trimmed);
  return alias;
}
