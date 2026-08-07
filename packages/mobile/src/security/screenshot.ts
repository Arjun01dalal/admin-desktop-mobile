/**
 * Screenshot / screen-recording block.
 *
 * On Android this sets FLAG_SECURE (screenshots produce a black frame and
 * recording is blocked); on iOS it detects capture and can blur. We keep it
 * enabled for the entire authenticated session. No-ops on web preview.
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
