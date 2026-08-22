/** POST /SubAdmin/update-fcm-token — register device push token after login. */

export type UpdateFcmTokenPayload = {
  _id: string;
  fcmToken: string;
};

export function resolveSubAdminUserId(user: unknown): string {
  if (!user || typeof user !== 'object') return '';
  const row = user as Record<string, unknown>;
  return String(row._id ?? row.id ?? '').trim();
}

export function buildUpdateFcmTokenPayload(
  user: unknown,
  fcmToken: unknown,
): UpdateFcmTokenPayload | null {
  const _id = resolveSubAdminUserId(user);
  const token = String(fcmToken || '').trim();
  if (!_id || !token) return null;
  return { _id, fcmToken: token };
}
