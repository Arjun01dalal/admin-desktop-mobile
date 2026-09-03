/**
 * OS deep links for Astro desktop (logout → native login).
 * Scheme: myastroapp://login?logged_out=1
 */
const { app } = require('electron');
const path = require('node:path');

const SCHEME = 'myastroapp';

/** @type {{ screen: string, loggedOut: boolean, raw: string } | null} */
let pendingPayload = null;

function registerProtocolClient() {
  try {
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(SCHEME);
    }
  } catch (err) {
    console.warn('[deep-link] setAsDefaultProtocolClient failed:', err?.message || err);
  }
}

/**
 * @param {string} url
 * @returns {{ screen: 'login', loggedOut: boolean, raw: string } | null}
 */
function parseDeepLink(url) {
  const raw = String(url || '').trim();
  if (!raw.toLowerCase().startsWith(`${SCHEME}://`)) return null;

  try {
    const parsed = new URL(raw);
    // myastroapp://login → hostname "login"
    // myastroapp:///login → pathname "/login"
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

function findDeepLinkInArgv(argv = process.argv) {
  return (
    (argv || []).map(String).find((item) => item.toLowerCase().startsWith(`${SCHEME}://`)) || null
  );
}

function setPending(payload) {
  pendingPayload = payload && typeof payload === 'object' ? payload : null;
}

function takePending() {
  const next = pendingPayload;
  pendingPayload = null;
  return next;
}

function peekPending() {
  return pendingPayload;
}

module.exports = {
  SCHEME,
  registerProtocolClient,
  parseDeepLink,
  findDeepLinkInArgv,
  setPending,
  takePending,
  peekPending,
};
