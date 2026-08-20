/**
 * Shared mutable runtime bag for Electron main modules.
 * Modules attach APIs at load; call sites resolve at runtime (avoids cycles).
 */
module.exports = {
  // process flags / monitors
  isQuitting: false,
  trayHintShown: false,
  tray: null,
  cachedAuthToken: null,
  sosMonitor: null,
  pushClient: null,
  blockSiteForUpdate: false,
  lastUpdateEvent: null,
  gotSingleInstanceLock: false,
  // filled by modules
};
