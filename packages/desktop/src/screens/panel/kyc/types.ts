export type CheckStamp = { name?: string; date?: string } | undefined;

export type KycRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  aadhaarNumber?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  kyc?: boolean;
  createdOn?: string;
  kycRejectCheckBy?: CheckStamp;
  kycRejectCrossCheckBy?: CheckStamp;
  kycManualCheckBy?: CheckStamp;
  kycManualCrossCheckBy?: CheckStamp;
  [key: string]: unknown;
};

export type KycFilters = {
  name: string;
  dpId: string;
  mobile: string;
  aadhaarNumber: string;
  accountNumber: string;
};

export const EMPTY_KYC_FILTERS: KycFilters = {
  name: '',
  dpId: '',
  mobile: '',
  aadhaarNumber: '',
  accountNumber: '',
};

export const NIGHT_LOCK_KEY = 'nightLockUntil';
export const NIGHT_UNLOCK_MS = 60_000;

export function apiFailed(res: {
  ok: boolean;
  success?: boolean;
  message?: string;
}): boolean {
  return !res.ok || res.success === false;
}

export function hourInIST(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')?.value || 0);
}

export function isKycNightHours(now = new Date()): boolean {
  const hour = hourInIST(now);
  return hour >= 20 || hour < 10;
}
