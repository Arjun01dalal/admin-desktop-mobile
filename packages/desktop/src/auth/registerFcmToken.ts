import { buildUpdateFcmTokenPayload } from '@astro/shared/subAdminFcm';
import { secureApi } from '@/api/secureClient';
import type { AuthUser } from '@/types/gcalc';

/** Best-effort FCM token sync after panel login. */
export async function registerSubAdminFcmToken(user: AuthUser | null | undefined): Promise<void> {
  const fcmRes = await window.gcalc?.getFcmToken?.({});
  if (!fcmRes?.ok || !fcmRes.fcmToken) return;

  const payload = buildUpdateFcmTokenPayload(user, fcmRes.fcmToken);
  if (!payload) return;

  try {
    await secureApi('auth.updateFcmToken', payload);
  } catch {
    /* non-blocking */
  }
}
