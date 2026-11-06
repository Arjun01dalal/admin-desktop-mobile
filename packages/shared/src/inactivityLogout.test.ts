import { describe, expect, it } from 'vitest';
import {
  inactivityLogoutRemainingMs,
  inactivitySessionOwnerKey,
  isInactivityLogoutDue,
  isInactivityLogoutExempt,
  readInactivityLastAt,
  startInactivitySession,
  stopInactivitySession,
  touchInactivitySession,
  INACTIVITY_LAST_AT_KEY,
  INACTIVITY_LOGOUT_MS,
  INACTIVITY_OWNER_KEY,
  type InactivityStorage,
} from './inactivityLogout';

function memoryStorage(seed: Record<string, string> = {}): InactivityStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

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

  it('starts / stops / owner-scopes the inactivity session', () => {
    const storage = memoryStorage();
    const owner = inactivitySessionOwnerKey({ _id: 'u1', mobile: '9999999999' });
    const started = startInactivitySession(storage, owner, 1_000);
    expect(started).toBe(1_000);
    expect(storage.getItem(INACTIVITY_LAST_AT_KEY)).toBe('1000');
    expect(storage.getItem(INACTIVITY_OWNER_KEY)).toBe(owner);
    expect(readInactivityLastAt(storage, owner)).toBe(1_000);
    expect(readInactivityLastAt(storage, 'other:999')).toBe(null);
    expect(storage.getItem(INACTIVITY_LAST_AT_KEY)).toBe(null);

    startInactivitySession(storage, owner, 2_000);
    expect(touchInactivitySession(storage, owner, 3_000)).toBe(3_000);
    expect(readInactivityLastAt(storage, owner)).toBe(3_000);

    stopInactivitySession(storage);
    expect(storage.getItem(INACTIVITY_LAST_AT_KEY)).toBe(null);
    expect(storage.getItem(INACTIVITY_OWNER_KEY)).toBe(null);
    expect(readInactivityLastAt(storage, owner)).toBe(null);
  });
});
