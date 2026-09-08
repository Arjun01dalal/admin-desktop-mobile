const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');
const { getGhUpdateToken, getUpdateFeedOwner, getUpdateFeedRepo } = require('./config.cjs');
const panelWindows = require('./panelWindows.cjs');
const ctx = require('./ctx.cjs');

/** Last update event — replayed when renderer mounts (avoids missed IPC under site view). */
function prepareUpdateUi() {
  ctx.blockSiteForUpdate = true;
  try {
    ctx.hideAllSiteViews();
  } catch {
    // ignore
  }
  ctx.focusWindow(panelWindows.getPrimaryWindow());
}

function publishUpdate(channel, payload) {
  ctx.lastUpdateEvent = { channel, payload, at: Date.now() };
  prepareUpdateUi();
  ctx.sendToRenderer(channel, payload);
}

/** Resolve GitHub update feed: env override (test) wins over baked app-update.yml (prod). */
function resolveUpdateFeed() {
  const overrideOwner = String(getUpdateFeedOwner() || '').trim();
  const overrideRepo = String(getUpdateFeedRepo() || '').trim();
  if (overrideOwner && overrideRepo) {
    return { owner: overrideOwner, repo: overrideRepo, source: 'env' };
  }

  try {
    const ymlPath = path.join(process.resourcesPath, 'app-update.yml');
    const yml = fs.existsSync(ymlPath) ? fs.readFileSync(ymlPath, 'utf8') : '';
    const owner = (yml.match(/^owner:\s*(.+)$/m) || [])[1]?.trim();
    const repo = (yml.match(/^repo:\s*(.+)$/m) || [])[1]?.trim();
    if (owner && repo) return { owner, repo, source: 'app-update.yml' };
  } catch {
    // ignore
  }
  return null;
}

/**
 * Mandatory desktop auto-update (electron-updater).
 * - Custom in-app popup only (no native dialogs that can be dismissed to keep working).
 * - Hard block from first "update available" until quitAndInstall.
 * - Background retries on network/check/download failures; resumes when online.
 */
function setupAutoUpdate() {
  if (!app.isPackaged) {
    console.log('autoUpdater: skipped (dev / unpackaged)');
    return;
  }

  // Prefer baked app-update.yml (always present in NSIS/dmg). package.json
  // `build` is stripped from the packaged asar, so do not require it.
  // Only call setFeedURL when a private-repo token is available.
  // UPDATE_FEED_OWNER + UPDATE_FEED_REPO (test builds) override the yml feed.
  const updateToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || getGhUpdateToken() || '';
  const feed = resolveUpdateFeed();
  if (updateToken && feed) {
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: feed.owner,
        repo: feed.repo,
        private: true,
        token: updateToken,
      });
      console.log(
        `autoUpdater: feed ${feed.owner}/${feed.repo} (source=${feed.source})`,
      );
    } catch (err) {
      console.warn('autoUpdater setFeedURL skipped:', err?.message || err);
    }
  } else if (feed) {
    console.log(
      `autoUpdater: feed ${feed.owner}/${feed.repo} (source=${feed.source}, no token — using default yml auth if public)`,
    );
  }

  autoUpdater.logger = {
    info: (...a) => console.log('[autoUpdater]', ...a),
    warn: (...a) => console.warn('[autoUpdater]', ...a),
    error: (...a) => console.error('[autoUpdater]', ...a),
    debug: (...a) => console.log('[autoUpdater:debug]', ...a),
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  /** Mandatory install — user cannot continue on the old build. */
  let updateAvailable = false;
  let updateReady = false;
  let installing = false;
  let pendingVersion = '';
  let checkInFlight = false;
  let retryTimer = null;
  let retryAttempt = 0;
  let lastCheckAt = 0;

  const MIN_CHECK_GAP_MS = 60 * 1000;
  const PERIODIC_MS = 15 * 60 * 1000;
  const RETRY_BASE_MS = 8 * 1000;
  const RETRY_MAX_MS = 2 * 60 * 1000;
  const AUTO_INSTALL_DELAY_MS = 2500;

  const isOnline = () => {
    try {
      return net.isOnline();
    } catch {
      return true;
    }
  };

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const forceInstall = () => {
    if (installing) return;
    installing = true;
    prepareUpdateUi();
    publishUpdate('update:installing', { version: pendingVersion });
    try {
      // isSilent=false, isForceRunAfter=true — relaunch after install.
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      installing = false;
      console.warn('autoUpdater quitAndInstall failed:', err?.message || err);
      scheduleRetry('Install failed — retrying…');
    }
  };

  const scheduleRetry = (reason) => {
    if (updateReady || installing) return;
    clearRetry();
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.min(retryAttempt, 5)));
    retryAttempt += 1;
    const message = reason || 'Network issue — retrying update automatically…';
    publishUpdate('update:retrying', {
      version: pendingVersion,
      message,
      attempt: retryAttempt,
      nextRetryMs: delay,
      online: isOnline(),
    });
    console.warn(`autoUpdater: retry #${retryAttempt} in ${delay}ms — ${message}`);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (updateReady || installing) return;
      if (!isOnline()) {
        scheduleRetry('Waiting for network connection…');
        return;
      }
      runCheck(true);
    }, delay);
  };

  const runCheck = (force = false) => {
    if (updateReady || installing) return;
    if (checkInFlight) return;
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    if (!isOnline()) {
      if (updateAvailable) scheduleRetry('Waiting for network connection…');
      return;
    }
    lastCheckAt = now;
    checkInFlight = true;
    autoUpdater
      .checkForUpdates()
      .catch((err) => {
        const message = err?.message || String(err);
        console.warn('autoUpdater checkForUpdates failed:', message);
        if (updateAvailable) {
          scheduleRetry(message);
        } else {
          // Soft notice only when no mandatory update is pending yet.
          publishUpdate('update:error', { message, soft: true });
        }
      })
      .finally(() => {
        checkInFlight = false;
      });
  };

  autoUpdater.on('checking-for-update', () => {
    console.log(
      'autoUpdater: checking for update… current=',
      app.getVersion(),
      'platform=',
      process.platform,
    );
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('autoUpdater: up to date', info?.version || app.getVersion());
    if (!updateAvailable) {
      clearRetry();
      retryAttempt = 0;
    }
  });

  autoUpdater.on('update-available', (info) => {
    pendingVersion = String(info?.version || pendingVersion || '');
    console.log('autoUpdater: update available', pendingVersion);
    updateAvailable = true;
    retryAttempt = 0;
    clearRetry();
    // Hard block immediately — custom popup + hide site BrowserView.
    publishUpdate('update:available', { version: pendingVersion });
  });

  autoUpdater.on('download-progress', (p) => {
    updateAvailable = true;
    clearRetry();
    publishUpdate('update:progress', {
      percent: Math.round(Number(p?.percent) || 0),
      version: pendingVersion,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingVersion = String(info?.version || pendingVersion || '');
    console.log('autoUpdater: downloaded', pendingVersion);
    updateAvailable = true;
    updateReady = true;
    clearRetry();
    retryAttempt = 0;
    publishUpdate('update:ready', {
      version: pendingVersion,
      autoInstallMs: AUTO_INSTALL_DELAY_MS,
    });
    // Seamless install — no need for the user to close/reopen manually.
    setTimeout(() => {
      if (!installing) forceInstall();
    }, AUTO_INSTALL_DELAY_MS);
  });

  autoUpdater.on('error', (err) => {
    const message = err?.message || String(err);
    console.warn('autoUpdater error:', message);
    const hint = /404|Not Found|Cannot find channel|latest-mac/i.test(message)
      ? ' Update feed not reachable for this platform. Windows needs latest.yml; Mac needs latest-mac.yml + .zip on the public GitHub release.'
      : '';
    const full = message + hint;

    if (updateReady) {
      // Package is on disk — keep forcing install; do not unblock.
      publishUpdate('update:ready', { version: pendingVersion, autoInstallMs: AUTO_INSTALL_DELAY_MS });
      setTimeout(() => {
        if (!installing) forceInstall();
      }, AUTO_INSTALL_DELAY_MS);
      return;
    }

    if (updateAvailable) {
      // Stay blocked and keep retrying in the background until download succeeds.
      scheduleRetry(full);
      return;
    }

    // Pre-update check noise — soft, dismissible in UI.
    publishUpdate('update:error', { message: full, soft: true });
  });

  // Startup: wait for renderer, then check (+ one quick retry).
  setTimeout(() => runCheck(true), 3000);
  setTimeout(() => runCheck(true), 15000);
  setInterval(() => runCheck(true), PERIODIC_MS);

  // When the user focuses the window, re-check (or re-force install if ready).
  app.on('browser-window-focus', () => {
    if (installing) return;
    if (updateReady) {
      forceInstall();
      return;
    }
    if (updateAvailable) {
      if (!isOnline()) {
        scheduleRetry('Waiting for network connection…');
        return;
      }
      runCheck(true);
      return;
    }
    runCheck(false);
  });

  // Closing / quitting with a downloaded update must install — no skip path.
  app.on('before-quit', () => {
    if (updateReady) forceInstall();
  });

  // Expose install trigger for the custom popup "Restart now" button.
  ctx.forceUpdateInstall = forceInstall;
}

ctx.setupAutoUpdate = setupAutoUpdate;
ctx.prepareUpdateUi = prepareUpdateUi;
ctx.publishUpdate = publishUpdate;
module.exports = { setupAutoUpdate };
