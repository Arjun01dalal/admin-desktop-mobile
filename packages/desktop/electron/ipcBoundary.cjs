/**
 * Resolve a renderer event to the registered panel only when both the
 * document origin and BrowserWindow identity are trusted.
 */
function getTrustedPanelSender(event, { BrowserWindow, panelWindows, isTrustedPanelOrigin }) {
  const sender = event?.sender;
  if (!sender || sender.isDestroyed()) return null;
  if (typeof isTrustedPanelOrigin !== 'function' || !isTrustedPanelOrigin(sender.getURL())) {
    return null;
  }

  const win = BrowserWindow.fromWebContents(sender);
  const panel = panelWindows.getPanelByWindow(win);
  if (!panel || panel.win.webContents.id !== sender.id) {
    return null;
  }
  return panel;
}

module.exports = { getTrustedPanelSender };
