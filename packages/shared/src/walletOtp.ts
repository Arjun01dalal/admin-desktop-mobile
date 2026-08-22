/** Wallet-transfer OTP helpers — sendOtp-walletToWallet + verifyOtp-walletToWallet. */
import { resolveBlockOtpMobile } from './userTypes';

export { resolveBlockOtpMobile, BLOCK_OTP_DEFAULT_MOBILE } from './userTypes';

export function apiOtpFailed(res: { ok: boolean; success?: boolean }): boolean {
  return !res.ok || res.success === false;
}

export function resolveWalletOtpMobile(loginMobile?: string | null): string {
  return resolveBlockOtpMobile(loginMobile ?? undefined);
}

export function maskOtpMobile(mobile: string): string {
  const m = String(mobile || '').trim();
  return m.length >= 4 ? `xxxxxx${m.slice(-4)}` : m;
}
