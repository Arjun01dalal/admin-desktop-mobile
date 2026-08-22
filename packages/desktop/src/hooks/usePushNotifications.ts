import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { PushNotificationPayload } from '@/types/gcalc';

function isPanelPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/**
 * In-app handling for FCM pushes relayed from the Electron main process.
 * OS notifications are already shown in main; this adds toasts + optional navigation.
 */
export function usePushNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = window.gcalc?.onPushNotification?.((payload: PushNotificationPayload) => {
      const title = String(payload?.title || 'Notification').trim();
      const body = String(payload?.body || '').trim();
      const message = body ? `${title}: ${body}` : title;

      toast.info(message, { autoClose: 9000 });

      if (!payload?.clicked) return;

      const path = String(payload.data?.path || payload.data?.route || '').trim();
      if (isPanelPath(path)) {
        navigate(path);
      }
    });

    return () => {
      unsub?.();
    };
  }, [navigate]);
}
