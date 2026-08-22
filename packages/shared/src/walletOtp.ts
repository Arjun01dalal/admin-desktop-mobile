/** Wallet-transfer OTP helpers — sendOtp-walletToWallet + verifyOtp-walletToWallet. */
import { BLOCK_OTP_DEFAULT_MOBILE, resolveBlockOtpMobile } from './userTypes';

export { resolveBlockOtpMobile, BLOCK_OTP_DEFAULT_MOBILE } from './userTypes';

export function apiOtpFailed(res: { ok: boolean; success?: boolean }): boolean {
  return !res.ok || res.success === false;
}

export function resolveWalletOtpMobile(loginMobile?: string | null): string {
  return resolveBlockOtpMobile(loginMobile ?? undefined);
}

/** Update RTP OTP always goes to SuperAdmin (9373114572), not logged-in user. */
export const LUDO_RTP_OTP_MOBILE = BLOCK_OTP_DEFAULT_MOBILE;

export function resolveLudoRtpOtpMobile(): string {
  return LUDO_RTP_OTP_MOBILE;
}

export function maskOtpMobile(mobile: string): string {
  const m = String(mobile || '').trim();
  return m.length >= 4 ? `xxxxxx${m.slice(-4)}` : m;
}
