import { useBlockedUserCheck } from '@/hooks/useBlockedUserCheck';

/** Mount inside the panel router — mirrors laxminarayan `<BlockedUserCheck />`. */
export function BlockedUserCheck() {
  useBlockedUserCheck();
  return null;
}
