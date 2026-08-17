export type AppScreen = 'site' | 'login' | 'welcome';

export type AddressInfo = {
  state?: string;
  city?: string;
  [key: string]: unknown;
};

export type AuthUser = {
  _id?: string;
  mobile?: string;
  name?: string;
  Role_ID?: string;
  Role_Name?: string;
  Responsibilities?: string[];
  block?: boolean;
  roles?: Record<string, string> | unknown;
  empCode?: string;
  [key: string]: unknown;
};

export type SendOtpResult = {
  ok: boolean;
  message?: string;
};

export type VerifyOtpResult = {
  ok: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
};

export type GetAddressResult = {
  ok: boolean;
  message?: string;
  address?: AddressInfo;
};

export type IpLocationResult = {
  ok: boolean;
  message?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  source?: string;
  address?: AddressInfo;
};

export type GCalcApi = {
  version: string;
  /** Packaged Electron app version (`app.getVersion()`). */
  getAppVersion?: () => Promise<string>;
  showLogin: () => void;
  showWelcome: () => void;
  /** @deprecated Use showSite */
  showCalculator: () => void;
  showSite: () => void;
  hideSite: () => void;
  /** Open another hardened panel window (same security / shared session). */
  openNewWindow: () => Promise<{ ok: boolean; message?: string }>;
  onRequestLogin: (cb: (d?: { email?: string; mobile?: string }) => void) => () => void;
  /** Fired when password gate is used while SOS is active. */
  onLoginBlockedSos: (cb: () => void) => () => void;
  /** Site password gate unlocked (Astro Admin password matches). */
  onPanelGate: (cb: (d: { ok?: boolean }) => void) => () => void;
  sendOtp: (payload: { mobile: string; token?: string | null }) => Promise<SendOtpResult>;
  verifyOtp: (payload: {
    mobile: string;
    otp: string | number;
    state: string;
    city: string;
    lat: string | number;
    long: string | number;
    address: AddressInfo;
    token?: string | null;
  }) => Promise<VerifyOtpResult>;
  getAddress: (payload: {
    lat: number;
    lng: number;
    token?: string | null;
  }) => Promise<GetAddressResult>;
  getIpLocation: () => Promise<IpLocationResult>;
  openLocationSettings: () => Promise<{ ok: boolean }>;
  copyText: (text: string) => Promise<{ ok: boolean }>;
  /** OS-encrypted session token vault (main process safeStorage). */
  getSessionToken: () => Promise<{
    ok: boolean;
    token?: string | null;
    encrypted?: boolean;
  }>;
  setSessionToken: (token: string) => Promise<{ ok: boolean; encrypted?: boolean }>;
  clearSessionToken: () => Promise<{ ok: boolean }>;
  /** Report renderer error to main (log + optional webhook). */
  reportError: (payload: {
    source?: string;
    message?: string;
    name?: string;
    stack?: string;
    url?: string;
  }) => Promise<{ ok: boolean }>;
  /** Named secure API — action names only; URLs/secrets stay in main process */
  secureApi: (
    action: string,
    payload?: Record<string, unknown>,
    token?: string | null,
  ) => Promise<{
    ok: boolean;
    success?: boolean;
    message?: string;
    data?: unknown;
    status?: number;
  }>;
  onUpdateAvailable: (cb: (d: { version: string }) => void) => void;
  onUpdateProgress: (cb: (d: { percent: number }) => void) => void;
  onUpdateReady: (cb: (d: { version: string }) => void) => void;
  onUpdateError: (cb: (d: { message: string }) => void) => void;
  getUpdateStatus: () => Promise<{
    channel: string;
    payload?: { version?: string; percent?: number; message?: string };
    at?: number;
  } | null>;
  installUpdate: () => void;
  /** Immediate local SOS alert (main process). Pass `{ silent: true }` for originator. */
  sosActivated: (meta?: {
    silent?: boolean;
    self?: boolean;
    type?: string;
    location?: string;
    blockedByName?: string;
  }) => void;
  /** Clear local SOS alert (main process). */
  sosCleared: () => void;
  /** Tell main this panel's office location (office-based SOS suppress). */
  setSosLocalContext: (ctx: { officeLocation?: string; userId?: string }) => void;
  /** SOS state known by main (no renderer token required). */
  getSosState: () => Promise<{ active?: boolean }>;
  /** Subscribe to main-process SOS state changes. Returns unsubscribe. */
  onSosState: (cb: (d: { active?: boolean }) => void) => () => void;
  /**
   * Dev: main-process HTTP request logs (secure API / dialer).
   * Shows in DevTools Console — Network tab cannot see main-process traffic.
   */
  onSecureHttpLog: (
    cb: (d: {
      at?: string;
      source?: string;
      action?: string;
      method?: string;
      url?: string;
      status?: number;
      ok?: boolean;
      ms?: number;
      request?: unknown;
      response?: unknown;
      error?: string;
    }) => void,
  ) => () => void;
};

declare global {
  interface Window {
    gcalc?: GCalcApi;
  }
}

export {};
