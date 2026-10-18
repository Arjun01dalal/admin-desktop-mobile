/**
 * Crash / error reporting. No-ops until EXPO_PUBLIC_SENTRY_DSN is set
 * (avoids breaking local/EAS builds without a Sentry project).
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: false,
    enabled: !__DEV__,
    environment:
      process.env.EAS_BUILD_PROFILE ||
      process.env.APP_ENV ||
      (__DEV__ ? 'development' : 'production'),
    release: Constants.expoConfig?.version
      ? `astro-mobile@${Constants.expoConfig.version}`
      : undefined,
    tracesSampleRate: 0.15,
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    if (__DEV__) console.warn('[observability]', error, context);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
    return;
  }
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!initialized) {
    if (__DEV__) console.log(`[observability:${level}]`, message);
    return;
  }
  Sentry.captureMessage(message, level);
}

export { Sentry };
