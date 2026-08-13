/**
 * Multi-window registry for Astro CS Panel.
 *
 * Every panel window uses the same hardened webPreferences + preload.
 * Site BrowserView is per-window (Electron attaches a BrowserView to one window).
 * SOS / secure API stay in main — callers broadcast to all panel renderers.
 */
const { BrowserWindow } = require('electron');

const MAX_PANEL_WINDOWS = 5;

/** @typedef {{ win: import('electron').BrowserWindow, siteView: import('electron').BrowserView | null }} PanelRecord */

/** @type {Map<number, PanelRecord>} */
const panels = new Map();

function listPanels() {
  for (const [id, rec] of panels) {
    if (!rec?.win || rec.win.isDestroyed()) panels.delete(id);
  }
  return [...panels.values()];
}

function getPanelByWindow(win) {
  if (!win || win.isDestroyed()) return null;
  return panels.get(win.id) || null;
}

function getPanelByWebContents(wc) {
  if (!wc || wc.isDestroyed()) return null;
  const win = BrowserWindow.fromWebContents(wc);
  return getPanelByWindow(win);
}

/** Resolve panel that owns a site BrowserView webContents. */
function getPanelBySiteContents(wc) {
  if (!wc || wc.isDestroyed()) return null;
  for (const rec of listPanels()) {
    if (
      rec.siteView &&
      !rec.siteView.webContents.isDestroyed() &&
      rec.siteView.webContents.id === wc.id
    ) {
      return rec;
    }
  }
  return null;
}

function getPrimaryWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && panels.has(focused.id) && !focused.isDestroyed()) {
    return focused;
  }
  return listPanels()[0]?.win || null;
}

function registerPanel(win) {
  if (!win || win.isDestroyed()) return null;
  const rec = { win, siteView: null };
  panels.set(win.id, rec);
  return rec;
}

function unregisterPanel(win) {
  if (!win) return;
  panels.delete(win.id);
}

function canOpenAnotherWindow() {
  return listPanels().length < MAX_PANEL_WINDOWS;
}

function panelCount() {
  return listPanels().length;
}

/**
 * Send IPC to every panel renderer (not SOS alert / arbitrary windows).
 * @returns {number} windows notified
 */
function broadcastToPanels(channel, payload) {
  let n = 0;
  for (const { win } of listPanels()) {
    try {
      if (!win.webContents.isDestroyed()) {
        win.webContents.send(channel, payload);
        n += 1;
      }
    } catch {
      // ignore
    }
  }
  return n;
}

function isPanelWindow(win) {
  return Boolean(win && !win.isDestroyed() && panels.has(win.id));
}

module.exports = {
  MAX_PANEL_WINDOWS,
  listPanels,
  getPanelByWindow,
  getPanelByWebContents,
  getPanelBySiteContents,
  getPrimaryWindow,
  registerPanel,
  unregisterPanel,
  canOpenAnotherWindow,
  panelCount,
  broadcastToPanels,
  isPanelWindow,
};
