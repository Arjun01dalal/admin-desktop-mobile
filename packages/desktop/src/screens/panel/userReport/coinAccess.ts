import { getSessionUser } from '@/auth/permissions';

/** Laxmi allowlist also used for Add Bonus Coins tab. */
const ADD_BONUS_MOBILES = new Set(['7276267494']);

export type CoinUserFlags = {
  showCoinButton?: unknown;
  showRemoveCoin?: unknown;
  showCoins?: unknown;
  mobile?: unknown;
};

function flag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Read coin flags from the logged-in user (Laxmi `User.data.*`).
 * Supports flat storage and nested `data` (web panel shape).
 */
export function readCoinUserFlags(
  user: Record<string, unknown> | null | undefined = getSessionUser() as Record<
    string,
    unknown
  > | null,
): CoinUserFlags {
  if (!user || typeof user !== 'object') return {};
  const nested =
    user.data && typeof user.data === 'object' && !Array.isArray(user.data)
      ? (user.data as Record<string, unknown>)
      : null;
  const src = nested ? { ...user, ...nested } : user;
  return {
    showCoinButton: src.showCoinButton ?? src.ShowCoinButton,
    showRemoveCoin: src.showRemoveCoin ?? src.ShowRemoveCoin,
    showCoins: src.showCoins ?? src.ShowCoins,
    mobile: src.mobile,
  };
}

/**
 * Laxmi User_Report.tsx:
 * `(User?.data?.showCoinButton || User?.data?.showRemoveCoin) && <Coins />`
 */
export function canShowCoinsTab(
  user?: Record<string, unknown> | null,
): boolean {
  const u = readCoinUserFlags(user);
  return flag(u.showCoinButton) || flag(u.showRemoveCoin);
}

/**
 * Laxmi User_Report.tsx: `User.data.showCoinButton && <Add Bonus Coins />`
 * (+ legacy mobile allowlist used in this port).
 */
export function canShowAddBonusCoinsTab(
  user?: Record<string, unknown> | null,
): boolean {
  const u = readCoinUserFlags(user);
  const mobile = String(u.mobile || '');
  return ADD_BONUS_MOBILES.has(mobile) || flag(u.showCoinButton);
}

/**
 * Laxmi Coin.tsx: `showCoins` → Add Coins button.
 */
export function canAddCoinsAction(user?: Record<string, unknown> | null): boolean {
  return flag(readCoinUserFlags(user).showCoins);
}

/** Laxmi SideNav: Show My Coin History — `User.data.showCoins` only. */
export function canShowMyCoinHistoryNav(
  user?: Record<string, unknown> | null,
): boolean {
  return flag(readCoinUserFlags(user).showCoins);
}

/**
 * Laxmi Coin.tsx:
 * - showCoins → Remove (with Add)
 * - !showCoins && showRemoveCoin → Remove only
 */
export function canRemoveCoinsAction(user?: Record<string, unknown> | null): boolean {
  const u = readCoinUserFlags(user);
  if (flag(u.showCoins)) return true;
  return flag(u.showRemoveCoin);
}

/**
 * Merge coin-role flags from `/SubAdmin/get-subadmin` into local session
 * (OTP payload sometimes omits them).
 */
export function mergeCoinFlagsIntoSession(flags: CoinUserFlags): void {
  const session = (getSessionUser() || {}) as Record<string, unknown>;
  const next = { ...session };
  if (flags.showCoinButton !== undefined) next.showCoinButton = flags.showCoinButton;
  if (flags.showRemoveCoin !== undefined) next.showRemoveCoin = flags.showRemoveCoin;
  if (flags.showCoins !== undefined) next.showCoins = flags.showCoins;
  try {
    localStorage.setItem('user', JSON.stringify(next));
    window.dispatchEvent(new Event('gcalc:user-updated'));
  } catch {
    // ignore
  }
}
