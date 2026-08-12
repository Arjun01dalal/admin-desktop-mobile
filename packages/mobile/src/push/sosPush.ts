/**
 * SOS push notifications for the standalone APK build.
 *
 * How it works end-to-end:
 * 1. On login the app creates an Android "sos" channel (max importance,
 *    custom siren sound, bypasses Do Not Disturb) and asks for notification
 *    permission.
 * 2. It fetches the Expo push token and publishes it to the shared ntfy
 *    topic (`EXPO_TOKEN=<token>`), where the always-on sos-push relay
 *    collects it.
 * 3. When SOS flips on, the relay sends an Expo push to every collected
 *    token with channelId "sos" → the phone sirens even if the app is
 *    closed or the phone is locked.
 *
 * In Expo Go remote push is unsupported (SDK 53+) — everything here
 * degrades silently; the in-app poll/siren keeps working.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Baked into the APK at build time (EXPO_PUBLIC_* are public by design —
// the topic is a shared secret only in the "hard to guess" sense).
const TOPIC = String(process.env.EXPO_PUBLIC_SOS_PUSH_TOPIC || '').trim();
const SERVER = String(process.env.EXPO_PUBLIC_SOS_PUSH_SERVER || 'https://ntfy.sh')
  .trim()
  .replace(/\/$/, '');

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

let registered = false;

/** Call once after login. Safe to call multiple times / in Expo Go. */
export async function registerSosPush(): Promise<void> {
  if (registered || isExpoGo || Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');

    // Heads-up + sound even when the app is foregrounded.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sos', {
        name: 'SOS Alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'siren.mp3',
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return; // Not an EAS build yet.

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token || !TOPIC) return;

    // Register the token with the relay via the shared ntfy topic.
    // Only mark as registered once the publish actually succeeded, so a
    // transient failure can be retried on the next login/session restore.
    const res = await fetch(`${SERVER}/${encodeURIComponent(TOPIC)}`, {
      method: 'POST',
      headers: { Title: 'EXPO_TOKEN', Priority: 'min', Tags: 'mobile' },
      body: `EXPO_TOKEN=${token}`,
    });
    if (res.ok) registered = true;
  } catch {
    // Push is best-effort — in-app siren/poll remains the fallback.
  }
}
