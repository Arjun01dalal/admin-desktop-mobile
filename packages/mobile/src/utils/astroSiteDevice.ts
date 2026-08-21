/**
 * Device id + push token helpers for Astro site (customer) password login.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';

const DEVICE_ID_KEY = 'astro_site_device_id_v1';

function randomId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getAstroSiteDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing?.trim()) return existing.trim();
  } catch {
    /* ignore */
  }
  let next = '';
  try {
    if (Platform.OS === 'android' && Device.osBuildId) {
      next = `android-${Device.osBuildId}`;
    } else if (Device.modelId) {
      next = `${Platform.OS}-${Device.modelId}`;
    }
  } catch {
    /* ignore */
  }
  if (!next) next = randomId();
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export async function getAstroSitePushToken(): Promise<
  { ok: true; fcmToken: string } | { ok: false; message: string }
> {
  try {
    const Notifications = await import('expo-notifications');
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      return {
        ok: false,
        message: 'Notification permission is required for Astro login.',
      };
    }
    // Prefer native FCM/APNs device token (matches desktop FCM usage).
    try {
      const device = await Notifications.getDevicePushTokenAsync();
      const data = String(device?.data || '').trim();
      if (data) return { ok: true, fcmToken: data };
    } catch {
      /* fall through to Expo token */
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      return { ok: false, message: 'Push project is not configured for this build.' };
    }
    const expo = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = String(expo?.data || '').trim();
    if (!token) {
      return { ok: false, message: 'Failed to get push token. Check network and try again.' };
    }
    return { ok: true, fcmToken: token };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to get push token. Check network and try again.',
    };
  }
}

export async function resolveAstroSiteGeo(): Promise<{
  latitude: string;
  longitude: string;
}> {
  let latitude = '0.0';
  let longitude = '0.0';
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { latitude, longitude };
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
      latitude = String(pos.coords.latitude);
      longitude = String(pos.coords.longitude);
    }
  } catch {
    /* keep defaults */
  }
  return { latitude, longitude };
}

export function astroSiteModelNumber(): string {
  const model = String(Device.modelName || Device.modelId || 'Mobile').trim();
  return model || 'Mobile';
}

export function astroSiteOs(): string {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}
