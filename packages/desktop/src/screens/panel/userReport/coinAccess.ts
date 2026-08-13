import { getSessionUser, hasPermission } from '@/auth/permissions';

/** Laxmi allowlist also used for Add Bonus Coins tab. */
const ADD_BONUS_MOBILES = new Set(['7276267494']);

type CoinUserFlags = {
  showCoinButton?: unknown;
  showRemoveCoin?: unknown;
  showCoins?: unknown;
  mobile?: unknown;
};

function flag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function sessionFlags(): CoinUserFlags {
  return (getSessionUser() || {}) as CoinUserFlags;
}

/** Laxmi: showCoinButton || showRemoveCoin → Coins tab. */
export function canShowCoinsTab(): boolean {
  const u = sessionFlags();
  return (
    flag(u.showCoinButton) ||
    flag(u.showRemoveCoin) ||
    hasPermission('showCoinButton') ||
    hasPermission('showRemoveCoin')
  );
}

/**
 * Laxmi: mobile allowlist || showCoinButton → Add Bonus Coins tab.
 */
export function canShowAddBonusCoinsTab(): boolean {
  const u = sessionFlags();
  const mobile = String(u.mobile || '');
  return (
    ADD_BONUS_MOBILES.has(mobile) ||
    flag(u.showCoinButton) ||
    hasPermission('showCoinButton')
  );
}

/**
 * Laxmi Coins form: `showCoins` → Add + Remove.
 * Also allow responsibility `showCoinButton` when user flag missing.
 */
export function canAddCoinsAction(): boolean {
  const u = sessionFlags();
  return flag(u.showCoins) || hasPermission('showCoinButton');
}

/**
 * Laxmi Coins form:
 * - showCoins → Remove (with Add)
 * - !showCoins && showRemoveCoin → Remove only
 */
export function canRemoveCoinsAction(): boolean {
  const u = sessionFlags();
  if (flag(u.showCoins) || hasPermission('showCoinButton')) return true;
  return flag(u.showRemoveCoin) || hasPermission('showRemoveCoin');
}
