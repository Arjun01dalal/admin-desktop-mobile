/**
 * HTTPS-only policy for outbound network traffic.
 * Cleartext HTTP is rejected except local Vite/dev hosts.
 */

function isLocalDevHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '[::1]' || h === '::1';
}

/**
 * @param {string} rawUrl
 * @param {{ allowLocalHttp?: boolean, label?: string }} [opts]
 * @returns {string} normalized URL (or relative path unchanged)
 */
function assertHttpsUrl(rawUrl, opts = {}) {
  const label = opts.label || 'URL';
  const allowLocalHttp = opts.allowLocalHttp === true;
  const s = String(rawUrl || '').trim();
  if (!s) throw new Error(`${label} is required`);

  // Relative API paths — resolved against an HTTPS baseURL elsewhere.
  if (s.startsWith('/') && !s.startsWith('//')) return s;

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw new Error(`Invalid ${label}`);
  }

  if (parsed.protocol === 'https:') return s;
  if (parsed.protocol === 'wss:') return s;

  if (
    allowLocalHttp &&
    parsed.protocol === 'http:' &&
    isLocalDevHost(parsed.hostname)
  ) {
    return s;
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'ws:') {
    throw new Error(`${label} must use HTTPS (got ${parsed.protocol}//${parsed.host})`);
  }

  // file:, app:, data: — not cleartext HTTP network; leave alone for callers that need them.
  return s;
}

/** True if this absolute URL is cleartext HTTP/WS and not a local-dev exception. */
function isBlockedCleartext(rawUrl, { allowLocalHttp = true } = {}) {
  try {
    const u = new URL(String(rawUrl || ''));
    if (u.protocol === 'https:' || u.protocol === 'wss:') return false;
    if (u.protocol !== 'http:' && u.protocol !== 'ws:') return false;
    if (allowLocalHttp && isLocalDevHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Attach an axios request interceptor that rejects cleartext HTTP.
 * @param {import('axios').AxiosInstance} instance
 */
function attachHttpsOnlyInterceptor(instance) {
  instance.interceptors.request.use((config) => {
    const base = String(config.baseURL || '');
    const path = String(config.url || '');
    if (base) assertHttpsUrl(base, { label: 'baseURL' });
    if (/^https?:\/\//i.test(path) || /^wss?:\/\//i.test(path)) {
      assertHttpsUrl(path, { label: 'request URL' });
    }
    return config;
  });
  return instance;
}

/**
 * Cancel cleartext HTTP(S) navigations/XHR in Chromium sessions (except local Vite).
 * @param {Electron.Session} ses
 */
function enforceSessionHttpsOnly(ses) {
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (isBlockedCleartext(details.url, { allowLocalHttp: true })) {
      console.warn('[https-only] blocked cleartext request:', details.url);
      callback({ cancel: true });
      return;
    }
    callback({});
  });
}

module.exports = {
  assertHttpsUrl,
  isBlockedCleartext,
  isLocalDevHost,
  attachHttpsOnlyInterceptor,
  enforceSessionHttpsOnly,
};
