/**
 * Parse Astro logout / login deep links — desktop deepLink.cjs parity.
 * Scheme: myastroapp://login?logged_out=1
 */
import { ASTRO_DEEP_LINK_SCHEME } from '../api/astroSiteAuth';

export type AstroDeepLinkPayload = {
  screen: 'login';
  loggedOut: boolean;
  raw: string;
};

export function parseAstroDeepLink(url: string | null | undefined): AstroDeepLinkPayload | null {
  const raw = String(url || '').trim();
  if (!raw.toLowerCase().startsWith(`${ASTRO_DEEP_LINK_SCHEME}://`)) return null;

  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || '').toLowerCase();
    const pathPart = String(parsed.pathname || '')
      .replace(/^\/+/, '')
      .split('/')[0]
      .toLowerCase();
    const screen = host || pathPart;
    if (screen !== 'login') return null;
    return {
      screen: 'login',
      loggedOut: parsed.searchParams.get('logged_out') === '1',
      raw,
    };
  } catch {
    if (!/^myastroapp:\/\/\/?login\b/i.test(raw)) return null;
    return {
      screen: 'login',
      loggedOut: /[?&]logged_out=1(?:&|$)/i.test(raw),
      raw,
    };
  }
}
