import {
  clearAuthStorage,
  isJwtExpired,
} from '@/utils/session';
import { getAuthToken } from '@/utils/authToken';
import type { AuthUser } from '@/types/gcalc';

export function readStoredSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    const token = getAuthToken();
    if (!raw || !token || isJwtExpired(token)) {
      if (raw || token) clearAuthStorage();
      return null;
    }
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearAuthStorage();
    return null;
  }
}

