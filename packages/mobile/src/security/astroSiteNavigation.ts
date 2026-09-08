const ALLOWED_ASTRO_SITE_ORIGINS = new Set(['https://astrotalk.vip', 'https://www.astrotalk.vip']);

/**
 * Only the customer Astro site and an inert blank document may load inside
 * this WebView. URL credentials and non-default ports are never accepted.
 */
export function isAllowedAstroSiteUrl(rawUrl: string): boolean {
  const url = String(rawUrl || '');
  if (url === 'about:blank') return true;

  try {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password || target.port) {
      return false;
    }
    return ALLOWED_ASTRO_SITE_ORIGINS.has(target.origin);
  } catch {
    return false;
  }
}
