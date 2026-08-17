import { useInactivityTracker } from '@/hooks/useInactivityTracker';

type Props = {
  userId?: string;
};

/** Global panel activity heartbeat; renders no UI. */
export function ActivityTracker({ userId }: Props) {
  useInactivityTracker(userId);
  return null;
}
