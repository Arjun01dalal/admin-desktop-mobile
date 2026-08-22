/** Pre-auth: splash → astro-login (+ forgot/terms). Panel: login (OTP) → welcome. */
export type AppScreen =
  | 'splash'
  | 'astro-login'
  | 'forgot'
  | 'terms'
  | 'login'
  | 'welcome'
  /** @deprecated Website BrowserView removed — treated as astro-login */
  | 'site';

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

export type PushNotificationPayload = {
  title?: string;
  body?: string;
  data?: Record<string, string>;
  fcmMessageId?: string;
  receivedAt?: string;
  /** Set when user clicks the native OS notification. */
  clicked?: boolean;
};

export type GCalcApi = {
  version: string;
  /** Packaged Electron app version (`app.getVersion()`). */
  getAppVersion?: () => Promise<string>;
  showLogin: () => void;
  showWelcome: () => void;
  /** @deprecated Use showSite */
  showCalculator: () => void;
  /** Opens Astro site BrowserView. With accessToken → SSO hash URL. */
  showSite: (payload?: { accessToken?: string }) => void;
  /** Landscape chrome without marketing site WebView. */
  showNativeAuth?: () => void;
  hideSite: () => void;
  /** Open another hardened panel window (same security / shared session). */
  openNewWindow: () => Promise<{ ok: boolean; message?: string }>;

  /** Public Astro customer auth (api.astrothirdeye.com). */
  siteLoginViaPassword?: (payload: {
    email: string;
    password: string;
    deviceId?: string;
    os?: string;
    modelNumber?: string;
    longitude?: string;
    latitude?: string;
    fcmToken?: string;
  }) => Promise<{ ok: boolean; message?: string; accessToken?: string; data?: unknown }>;
  siteSendEmailOtp?: (payload: {
    email: string;
  }) => Promise<{ ok: boolean; message?: string; data?: unknown }>;
  siteVerifyEmailOtp?: (payload: {
    email: string;
    otp: string;
    deviceId?: string;
  }) => Promise<{ ok: boolean; message?: string; accessToken?: string; data?: unknown }>;
  siteResetPassword?: (payload: {
    email: string;
    newPassword: string;
    accessToken: string;
  }) => Promise<{ ok: boolean; message?: string; data?: unknown }>;
  /** Real FCM device token from Electron main (Google FCM registration). */
  getFcmToken?: (payload?: {
    force?: boolean;
  }) => Promise<{ ok: boolean; fcmToken?: string; message?: string }>;
  fetchTermsAndConditions?: () => Promise<{
    ok: boolean;
    heading?: string;
    bodyHtml?: string;
    updatedAt?: string | null;
    message?: string;
  }>;

  onRequestLogin: (cb: (d?: { email?: string; mobile?: string }) => void) => () => void;
  /** OS custom protocol deep link (e.g. myastroapp://login?logged_out=1). */
  onDeepLink?: (
    cb: (d: { screen?: string; loggedOut?: boolean; raw?: string }) => void,
  ) => () => void;
  getPendingDeepLink?: () => Promise<{
    screen?: string;
    loggedOut?: boolean;
    raw?: string;
  } | null>;
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
  /** Save a generated sheet (base64 xlsx) via the OS Save dialog. */
  saveDownload?: (
    filename: string,
    base64: string,
  ) => Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }>;
  /** Convert an HTTPS recording into an authenticated in-app stream URL. */
  recordingUrl: (url: string) => string;
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
  /** FCM push from main — OS notification already shown; use for in-app toast / navigation. */
  onPushNotification: (cb: (d: PushNotificationPayload) => void) => () => void;
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
