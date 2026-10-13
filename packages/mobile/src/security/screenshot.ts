/**
 * Screenshot / screen-recording helpers.
 *
 * Block is currently off — useSecurity only calls allowScreenCapture so
 * recording and screenshots work. enableScreenshotBlock remains for a
 * future toggle. No-ops on web preview.
 */
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';

export async function enableScreenshotBlock(): Promise<void> {
  if (!isNative) return;
  try {
    await ScreenCapture.preventScreenCaptureAsync('astro-session');
  } catch {
    /* best-effort — never crash the app over a hardening step */
  }
}

export async function disableScreenshotBlock(): Promise<void> {
  if (!isNative) return;
  try {
    await ScreenCapture.allowScreenCaptureAsync('astro-session');
  } catch {
    /* ignore */
  }
}
