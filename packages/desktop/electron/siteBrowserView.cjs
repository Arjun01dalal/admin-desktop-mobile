const { app, BrowserView } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { isBlockedCleartext } = require('./httpsOnly.cjs');
const panelWindows = require('./panelWindows.cjs');
const deepLink = require('./deepLink.cjs');
const ctx = require('./ctx.cjs');

const ASTRO_SITE_URL = 'https://astrotalk.vip/';
const SITE_LOGIN_BAR_HEIGHT = 56;

function buildExternalLoginUrl(accessToken) {
  const token = String(accessToken || '').trim();
  const base = ASTRO_SITE_URL.replace(/\/?$/, '/');
  if (!token) return base;
  // Site SSO parser: token must be in the hash only (`#external_login=1&access_token=…`).
  // Query-string tokens are ignored by astrotalk.vip.
  return `${base}#external_login=1&access_token=${encodeURIComponent(token)}`;
}

function reinforceExternalLoginHash(webContents, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token || !webContents || webContents.isDestroyed()) return;
  // Only ensure hash is present before the SPA's boot timeout reads it.
  // Do NOT reload — after a successful SSO the site strips the hash on purpose.
  const script = `
    (function (token) {
      try {
        var raw = String(location.hash || '').replace(/^#/, '');
        var params = new URLSearchParams(raw);
        if (params.get('external_login') === '1' && params.get('access_token')) {
          return 'ok';
        }
        location.hash = 'external_login=1&access_token=' + encodeURIComponent(token);
        return 'set';
      } catch (e) {
        return 'err';
      }
    })(${JSON.stringify(token)});
  `;
  webContents.executeJavaScript(script, true).catch(() => {});
}


function applyLoginSize(rec) {
  if (!rec) return;
  hideSiteView(rec);
  ctx.applyPortraitSize(rec);
}

function applyWelcomeSize(rec) {
  if (!rec) return;
  hideSiteView(rec);
  ctx.applyBrowserSize(rec);
}

function applySiteSize(rec, opts = {}) {
  if (!rec) return;
  // Customer Astro site session — attach marketing BrowserView.
  ctx.applyBrowserSize(rec);
  showSiteView(rec, opts);
}

/** Landscape chrome without marketing site (native splash / Astro login). */
function applyNativeAuthSize(rec) {
  if (!rec) return;
  hideSiteView(rec);
  ctx.applyBrowserSize(rec);
}

function layoutSiteView(rec) {
  const win = rec?.win;
  const siteView = rec?.siteView;
  if (!win || !siteView || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const bar = SITE_LOGIN_BAR_HEIGHT;
  siteView.setBounds({
    x: 0,
    y: 0,
    width,
    height: Math.max(0, height - bar),
  });
  siteView.setAutoResize({ width: true, height: false });
}

function destroySiteView(rec) {
  if (!rec) return;
  clearSitePrefillTimers(rec);
  rec._pendingSsoToken = '';
  rec._ssoHashReady = false;
  const win = rec.win;
  const siteView = rec.siteView;
  if (!siteView) {
    rec.siteView = null;
    return;
  }
  try {
    if (win && !win.isDestroyed()) win.removeBrowserView(siteView);
  } catch {
    // ignore
  }
  try {
    if (!siteView.webContents.isDestroyed()) {
      siteView.webContents.destroy();
    }
  } catch {
    // ignore
  }
  rec.siteView = null;
}

/** Last email/mobile typed on the Astro marketing site (for prefill). */
let cachedSiteIdentity = { email: '', mobile: '' };

function siteIdentityPath() {
  return path.join(app.getPath('userData'), 'astro-site-identity.json');
}

function loadPersistedSiteIdentity() {
  try {
    const raw = fs.readFileSync(siteIdentityPath(), 'utf8');
    const parsed = JSON.parse(raw);
    cachedSiteIdentity = normalizeSiteIdentity(parsed);
  } catch {
    // first run / corrupt — keep empty
  }
}

function persistSiteIdentityToDisk() {
  if (!cachedSiteIdentity.email && !cachedSiteIdentity.mobile) return;
  try {
    fs.writeFileSync(
      siteIdentityPath(),
      JSON.stringify(cachedSiteIdentity),
      'utf8',
    );
  } catch {
    // ignore disk errors
  }
}

function normalizeSiteIdentity(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const email = String(src.email || '').trim().slice(0, 200);
  let mobile = String(src.mobile || '').replace(/\D/g, '');
  if (mobile.length > 10) mobile = mobile.slice(-10);
  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) mobile = '';
  // Email box often holds a 10-digit mobile on this site.
  if (!mobile && email) {
    const digits = email.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits.slice(-10))) mobile = digits.slice(-10);
  }
  return { email, mobile };
}

function rememberSiteIdentity(payload) {
  const next = normalizeSiteIdentity(payload);
  if (!next.email && !next.mobile) return cachedSiteIdentity;
  cachedSiteIdentity = {
    email: next.email || cachedSiteIdentity.email || '',
    mobile: next.mobile || cachedSiteIdentity.mobile || '',
  };
  persistSiteIdentityToDisk();
  return cachedSiteIdentity;
}

function prefillSiteView(rec) {
  if (!rec?.siteView || rec.siteView.webContents.isDestroyed()) return;
  if (!cachedSiteIdentity.email && !cachedSiteIdentity.mobile) return;
  try {
    rec.siteView.webContents.send('astro:prefill-site', cachedSiteIdentity);
  } catch {
    // ignore
  }
}

/** Same delays as before — SPA mounts email/password inputs late. */
const SITE_PREFILL_DELAYS_MS = [0, 400, 1200, 2500];

function clearSitePrefillTimers(rec) {
  if (!rec?.prefillTimers?.length) return;
  for (const timer of rec.prefillTimers) {
    try {
      clearTimeout(timer);
    } catch {
      // ignore
    }
  }
  rec.prefillTimers = [];
}

function scheduleSitePrefills(rec) {
  if (!rec) return;
  clearSitePrefillTimers(rec);
  rec.prefillTimers = [];
  for (const ms of SITE_PREFILL_DELAYS_MS) {
    if (ms === 0) {
      prefillSiteView(rec);
      continue;
    }
    rec.prefillTimers.push(setTimeout(() => prefillSiteView(rec), ms));
  }
}

/** When true, site BrowserView must stay hidden so update dialogs are visible. */
function hideSiteView(rec) {
  if (!rec?.win || !rec.siteView) return;
  try {
    rec.win.removeBrowserView(rec.siteView);
  } catch {
    // ignore
  }
}

function hideAllSiteViews() {
  for (const rec of panelWindows.listPanels()) {
    hideSiteView(rec);
  }
}

function showSiteView(rec, opts = {}) {
  const win = rec?.win;
  if (!win || win.isDestroyed()) return;
  // BrowserView sits above the React UI and also above modal dialogs attached
  // to the window — never re-show it while an update prompt is active.
  if (ctx.blockSiteForUpdate) return;

  const accessToken = String(opts?.accessToken || '').trim();
  // SSO hash ONLY when caller passed accessToken (customer API login success).
  // Bare showSite / remount / calculator → plain ASTRO_SITE_URL (no external_login).
  const sso = Boolean(accessToken);
  const targetUrl = sso ? buildExternalLoginUrl(accessToken) : ASTRO_SITE_URL;

  // Fresh BrowserView for SSO so the SPA boots with hash present (not a stale login page).
  if (sso && rec.siteView && !rec.siteView.webContents.isDestroyed()) {
    destroySiteView(rec);
  }

  // sitePreload reads this sync before SPA Splash (~400ms) for hash + LOGIN_TOKEN.
  rec._pendingSsoToken = sso ? accessToken : '';
  rec._ssoHashReady = false;

  const attachWhenReady = (view) => {
    if (!view || view.webContents.isDestroyed() || win.isDestroyed()) return;
    if (ctx.blockSiteForUpdate) return;
    // Avoid detach/reattach churn (StrictMode remount / duplicate showSite).
    try {
      const current = win.getBrowserView();
      if (current === view) {
        layoutSiteView(rec);
        return;
      }
    } catch {
      // ignore
    }
    win.setBrowserView(view);
    layoutSiteView(rec);
    // Never prefill login fields during SSO — site should land on home.
    if (!sso) prefillSiteView(rec);
  };

  if (!rec.siteView || rec.siteView.webContents.isDestroyed()) {
    rec.siteView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'sitePreload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        // Preload must reliably access ipcRenderer for panel gate.
        sandbox: false,
        webSecurity: true,
        devTools: ctx.allowDevTools(),
      },
    });

    ctx.hardenWebContents(rec.siteView.webContents);
    rec.siteView.webContents.setWindowOpenHandler(({ url }) => {
      if (deepLink.parseDeepLink(url)) {
        ctx.handleDeepLink(url);
      }
      // No popups — panel login is gated by site password in sitePreload.
      return { action: 'deny' };
    });

    // SPA navigations: ensure preload listeners stay (preload reloads with page).
    rec.siteView.webContents.on('dom-ready', () => {
      console.log('[site] dom-ready — panel gate preload active');
      // Attach only after first paint so users don't see an empty black BrowserView.
      attachWhenReady(rec.siteView);
      if (sso && !rec._ssoHashReady) {
        rec._ssoHashReady = true;
        reinforceExternalLoginHash(rec.siteView.webContents, accessToken);
      } else if (!sso) {
        prefillSiteView(rec);
      }
    });

    // Prefill after first paint as well (some SPAs mount inputs late).
    rec.siteView.webContents.on('did-finish-load', () => {
      attachWhenReady(rec.siteView);
      if (!sso) scheduleSitePrefills(rec);
    });

    rec.siteView.webContents.on('will-navigate', (event, url) => {
      try {
        if (deepLink.parseDeepLink(url)) {
          event.preventDefault();
          ctx.handleDeepLink(url);
          return;
        }
        if (isBlockedCleartext(url, { allowLocalHttp: false })) {
          event.preventDefault();
          return;
        }
        const target = new URL(url);
        const home = new URL(ASTRO_SITE_URL);
        // Keep browsing on the marketing site; off-origin stays blocked.
        if (target.origin !== home.origin) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    console.log(
      '[site] loadURL',
      sso ? `SSO external_login (tokenLen=${accessToken.length})` : 'plain home',
    );
    rec.siteView.webContents.loadURL(targetUrl);
    // Keep React "Loading Astro Admin…" visible until dom-ready / finish-load.
    return;
  }

  // Existing view (non-SSO): just attach.
  attachWhenReady(rec.siteView);
}



ctx.applyLoginSize = applyLoginSize;
ctx.applyWelcomeSize = applyWelcomeSize;
ctx.applySiteSize = applySiteSize;
ctx.applyNativeAuthSize = applyNativeAuthSize;
ctx.layoutSiteView = layoutSiteView;
ctx.destroySiteView = destroySiteView;
ctx.hideSiteView = hideSiteView;
ctx.hideAllSiteViews = hideAllSiteViews;
ctx.showSiteView = showSiteView;
ctx.loadPersistedSiteIdentity = loadPersistedSiteIdentity;
ctx.rememberSiteIdentity = rememberSiteIdentity;
ctx.getCachedSiteIdentity = () => cachedSiteIdentity;

module.exports = {
  applyLoginSize,
  applyWelcomeSize,
  applySiteSize,
  applyNativeAuthSize,
  layoutSiteView,
  destroySiteView,
  hideSiteView,
  hideAllSiteViews,
  showSiteView,
  loadPersistedSiteIdentity,
  rememberSiteIdentity,
};
