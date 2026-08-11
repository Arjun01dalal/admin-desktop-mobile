import { getSessionUser } from '@/auth/permissions';

export function updatedByPayload() {
  const user = getSessionUser();
  return { _id: user?._id, name: user?.name };
}
