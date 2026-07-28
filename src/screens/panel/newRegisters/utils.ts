import type { NestedCaller, UserRow } from './types';

export type { UserRow } from './types';

export function nestedName(value: unknown): string {
  return String((value as NestedCaller)?.name || '-');
}

export function nestedDpId(value: unknown): string {
  return String((value as NestedCaller)?.Dp_ID || '-');
}

export function formatAadharAddress(row: UserRow): string {
  const addr = (row.aadharAddress || {}) as Record<string, unknown>;
  if (!row.kyc || !Object.keys(addr).length) return '-';
  return [
    addr.country && `Country: ${addr.country}`,
    addr.dist && `Dist: ${addr.dist}`,
    addr.house && `House: ${addr.house}`,
    addr.landmark && `Landmark: ${addr.landmark}`,
    addr.loc && `Loc: ${addr.loc}`,
    addr.pin && `Pin: ${addr.pin}`,
    addr.state && `State: ${addr.state}`,
    addr.vtc && `Vtc: ${addr.vtc}`,
  ]
    .filter(Boolean)
    .join(' | ');
}
