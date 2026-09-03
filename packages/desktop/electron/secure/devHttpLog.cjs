/**
 * Dev-only HTTP request logging for main-process secure/dialer calls.
 * Visible in the Electron terminal and forwarded to the renderer DevTools console.
 */
const { BrowserWindow } = require('electron');

function isDevHttpLogEnabled() {
  // Off by default — only when explicitly forced via env.
  return process.env.SECURE_API_LOG === '1';
}

function redactHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (/^authorization$/i.test(key)) {
      out[key] = 'Bearer ***';
      continue;
    }
    out[key] = value;
  }
  return out;
}

function summarizeBody(body, max = 1200) {
  if (body == null) return undefined;
  try {
    const text = typeof body === 'string' ? body : JSON.stringify(body, null, 0);
    if (text.length <= max) return body;
    return `${text.slice(0, max)}…(+${text.length - max} chars)`;
  } catch {
    return '[unserializable]';
  }
}

function broadcastToRenderer(entry) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send('secure:dev-http-log', entry);
    }
  } catch {
    // ignore
  }
}

/**
 * @param {{
 *   source?: string,
 *   action?: string,
 *   method?: string,
 *   url?: string,
 *   status?: number,
 *   ok?: boolean,
 *   ms?: number,
 *   request?: unknown,
 *   response?: unknown,
 *   error?: string,
 * }} entry
 */
function logHttp(entry) {
  if (!isDevHttpLogEnabled()) return;

  const row = {
    at: new Date().toISOString(),
    source: entry.source || 'secure',
    action: entry.action || undefined,
    method: String(entry.method || 'POST').toUpperCase(),
    url: entry.url || '',
    status: entry.status,
    ok: entry.ok,
    ms: entry.ms,
    request: summarizeBody(entry.request),
    response: summarizeBody(entry.response),
    error: entry.error,
  };

  const label = `[dev-http] ${row.method} ${row.url || row.action || ''} → ${
    row.status ?? (row.error ? 'ERR' : '?')
  }${row.ms != null ? ` (${row.ms}ms)` : ''}`;

  if (row.ok === false || row.error) {
    console.warn(label, row);
  } else {
    console.log(label, row);
  }

  broadcastToRenderer(row);
}

/**
 * Attach request/response logging to an axios instance (main API client).
 * @param {import('axios').AxiosInstance} instance
 * @param {{ source?: string }} [opts]
 */
function attachAxiosDevLog(instance, opts = {}) {
  if (!isDevHttpLogEnabled()) return instance;

  instance.interceptors.request.use((config) => {
    config.metadata = { start: Date.now(), ...(config.metadata || {}) };
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const cfg = response.config || {};
      const start = cfg.metadata?.start;
      const base = String(cfg.baseURL || '').replace(/\/$/, '');
      const path = String(cfg.url || '');
      const url = path.startsWith('http')
        ? path
        : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

      logHttp({
        source: opts.source || 'api',
        action: cfg.metadata?.action,
        method: cfg.method,
        url,
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        ms: start ? Date.now() - start : undefined,
        request: {
          headers: redactHeaders(cfg.headers),
          data: cfg.data,
        },
        response: response.data,
      });
      return response;
    },
    (error) => {
      const cfg = error?.config || {};
      const start = cfg.metadata?.start;
      const base = String(cfg.baseURL || '').replace(/\/$/, '');
      const path = String(cfg.url || '');
      const url = path.startsWith('http')
        ? path
        : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

      logHttp({
        source: opts.source || 'api',
        action: cfg.metadata?.action,
        method: cfg.method,
        url,
        status: error?.response?.status,
        ok: false,
        ms: start ? Date.now() - start : undefined,
        request: {
          headers: redactHeaders(cfg.headers),
          data: cfg.data,
        },
        response: error?.response?.data,
        error: error?.message || 'request failed',
      });
      return Promise.reject(error);
    },
  );

  return instance;
}

module.exports = {
  isDevHttpLogEnabled,
  logHttp,
  attachAxiosDevLog,
  redactHeaders,
};
