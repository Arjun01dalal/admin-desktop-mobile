const { app, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');
const { getGhUpdateToken } = require('./config.cjs');
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

/**
 * Use an app-modal dialog (no parent window). Parenting to `win` while a
 * BrowserView is/was attached often puts the box behind the site on Windows.
 */
async function showUpdateDialog(options) {
  prepareUpdateUi();
  return dialog.showMessageBox(options);
}

function setupAutoUpdate() {
  if (!app.isPackaged) {
    console.log('autoUpdater: skipped (dev / unpackaged)');
    return;
  }

  // Prefer baked app-update.yml (always present in NSIS/dmg). package.json
  // `build` is stripped from the packaged asar, so do not require it.
  // Only call setFeedURL when a private-repo token is available.
  const updateToken =
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    getGhUpdateToken() ||
    '';
  if (updateToken) {
    try {
      const ymlPath = path.join(process.resourcesPath, 'app-update.yml');
      const yml = fs.existsSync(ymlPath)
        ? fs.readFileSync(ymlPath, 'utf8')
        : '';
      const owner = (yml.match(/^owner:\s*(.+)$/m) || [])[1]?.trim();
      const repo = (yml.match(/^repo:\s*(.+)$/m) || [])[1]?.trim();
      if (owner && repo) {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner,
          repo,
          private: true,
          token: updateToken,
        });
      }
    } catch (err) {
      console.warn('autoUpdater setFeedURL skipped:', err?.message || err);
    }
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

  let availableDialogShown = false;
  let readyDialogShown = false;
  let errorDialogShown = false;

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
  });
  autoUpdater.on('update-available', (info) => {
    console.log('autoUpdater: update available', info.version);
    publishUpdate('update:available', { version: info.version });
    // Show immediately — do not wait for the ~100MB+ download to finish.
    if (!availableDialogShown) {
      availableDialogShown = true;
      void showUpdateDialog({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available.`,
        detail:
          'Downloading in the background. You will be asked to restart when it is ready (~1–3 minutes on typical connections).',
        buttons: ['OK'],
        noLink: true,
      }).catch((err) =>
        console.warn('autoUpdater available dialog failed:', err?.message || err),
      );
    }
  });
  autoUpdater.on('download-progress', (p) => {
    publishUpdate('update:progress', { percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    console.log('autoUpdater: downloaded', info.version);
    publishUpdate('update:ready', { version: info.version });
    if (readyDialogShown) return;
    readyDialogShown = true;
    try {
      const result = await showUpdateDialog({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} is ready to install.`,
        detail: 'Restart now to update, or choose Later.',
        buttons: ['Restart & Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      } else {
        // User deferred install — allow site view again; React toast still available.
        ctx.blockSiteForUpdate = false;
      }
    } catch (err) {
      console.warn('autoUpdater ready dialog failed:', err?.message || err);
      ctx.blockSiteForUpdate = false;
    }
  });
  autoUpdater.on('error', (err) => {
    const message = err?.message || String(err);
    console.warn('autoUpdater error:', message);
    const hint = /404|Not Found|Cannot find channel|latest-mac/i.test(message)
      ? ' Update feed not reachable for this platform. Windows needs latest.yml; Mac needs latest-mac.yml + .zip on the public GitHub release.'
      : '';
    const full = message + hint;
    publishUpdate('update:error', { message: full });
    if (!errorDialogShown) {
      errorDialogShown = true;
      void showUpdateDialog({
        type: 'error',
        title: 'Update Check Failed',
        message: full,
        buttons: ['OK'],
        noLink: true,
      })
        .catch(() => {})
        .finally(() => {
          ctx.blockSiteForUpdate = false;
        });
    }
  });

  let lastCheckAt = 0;
  const MIN_CHECK_GAP_MS = 10 * 60 * 1000; // don't hammer GitHub

  const runCheck = (force = false) => {
    // Don't re-check while a ready dialog is already up / install pending.
    if (readyDialogShown) return;
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = now;
    autoUpdater.checkForUpdates().catch((err) => {
      const message = err?.message || String(err);
      console.warn('autoUpdater checkForUpdates failed:', message);
      publishUpdate('update:error', { message });
    });
  };

  // Startup: wait for renderer, then check (+ one quick retry).
  setTimeout(() => runCheck(true), 3000);
  setTimeout(() => runCheck(true), 15000);
  // Keep checking while the app stays open (so a new release is noticed
  // without requiring a manual restart first). Install still needs restart.
  const PERIODIC_MS = 30 * 60 * 1000; // 30 minutes
  setInterval(() => runCheck(true), PERIODIC_MS);

  app.on('browser-window-focus', () => {
    if (readyDialogShown || availableDialogShown) return;
    runCheck(false); // throttled
  });
}


ctx.setupAutoUpdate = setupAutoUpdate;
ctx.prepareUpdateUi = prepareUpdateUi;
ctx.publishUpdate = publishUpdate;
ctx.showUpdateDialog = showUpdateDialog;
module.exports = { setupAutoUpdate };
