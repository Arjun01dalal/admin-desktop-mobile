export type AppScreen = 'calculator' | 'login' | 'welcome';

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
  block?: boolean;
  roles?: unknown;
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
  showLogin: () => void;
  showWelcome: () => void;
  showCalculator: () => void;
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
  installUpdate: () => void;
};

declare global {
  interface Window {
    gcalc?: GCalcApi;
  }
}

export {};
