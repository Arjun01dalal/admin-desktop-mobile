import { describe, expect, it } from 'vitest';
import {
  inactivityLogoutRemainingMs,
  isInactivityLogoutDue,
  isInactivityLogoutExempt,
  INACTIVITY_LOGOUT_MS,
} from './inactivityLogout';

describe('inactivityLogout', () => {
  it('exempts the hard-coded mobile', () => {
    expect(isInactivityLogoutExempt({ mobile: '9373114572' })).toBe(true);
    expect(isInactivityLogoutExempt({ mobile: '9999999999' })).toBe(false);
  });

  it('exempts dev_full_access by role id / name', () => {
    expect(
      isInactivityLogoutExempt({
        mobile: '9999999999',
        Role_ID: '6a33c137a6558491e0d20464',
      }),
    ).toBe(true);
    expect(
      isInactivityLogoutExempt({
        mobile: '9999999999',
        Role_Name: 'dev_full_access',
      }),
    ).toBe(true);
  });

  it('does not exempt generic full_access by itself', () => {
    expect(
      isInactivityLogoutExempt({
        mobile: '9999999999',
        Role_ID: '64f710d9a2ab78980020c5fb',
        Role_Name: 'full_access',
      }),
    ).toBe(false);
  });

  it('computes remaining / due from last activity', () => {
    const now = 1_000_000;
    expect(inactivityLogoutRemainingMs(now - 60_000, now)).toBe(INACTIVITY_LOGOUT_MS - 60_000);
    expect(isInactivityLogoutDue(now - INACTIVITY_LOGOUT_MS, now)).toBe(true);
    expect(isInactivityLogoutDue(now - 1_000, now)).toBe(false);
  });
});
