import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PushNotificationPayload } from '@/types/gcalc';
import { showPushToast } from '@/utils/showPushToast';

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
      // Avoid duplicate toast when user clicked the OS banner (focus + navigate only).
      if (!payload?.clicked) {
        // OS/main already plays notify.mp3 — toast is visual only.
        showPushToast(payload, { playSound: false });
      }

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
