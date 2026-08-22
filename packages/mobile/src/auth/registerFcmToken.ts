import { buildUpdateFcmTokenPayload } from '@astro/shared/subAdminFcm';
import { secureApi } from '../api/client';
import { getAstroSitePushToken } from '../utils/astroSiteDevice';
import type { AuthUser } from '../types/auth';

/** Best-effort FCM token sync after panel login. */
export async function registerSubAdminFcmToken(user: AuthUser | null | undefined): Promise<void> {
  const push = await getAstroSitePushToken();
  if (!push.ok) return;

  const payload = buildUpdateFcmTokenPayload(user, push.fcmToken);
  if (!payload) return;

  try {
    await secureApi('auth.updateFcmToken', payload);
  } catch {
    /* non-blocking */
  }
}
