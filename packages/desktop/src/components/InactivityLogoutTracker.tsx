import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import type { AuthUser } from '@/types/gcalc';

type Props = {
  user: AuthUser | null | undefined;
  onLogout: () => void;
};

/** Panel-wide 45m inactivity logout; renders no UI. */
export function InactivityLogoutTracker({ user, onLogout }: Props) {
  useInactivityLogout({ user, onLogout });
  return null;
}
