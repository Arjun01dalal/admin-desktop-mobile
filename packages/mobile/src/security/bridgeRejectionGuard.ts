/**
 * expo-location on Android can reject an internal promise with
 * "Exception in HostFunction: Array already consumed" after the caller has
 * already moved on. That rejection is not fatal — the panel keeps a fallback
 * fix — but React Native turns the first unhandled one into a redbox on launch.
 */
import { isArrayConsumedError } from './safeLocation';

type HandleException = (error: unknown, isFatal: boolean) => void;

try {
  const ExceptionsManagerModule = require('react-native/Libraries/Core/ExceptionsManager');
  const ExceptionsManager = (ExceptionsManagerModule.default ?? ExceptionsManagerModule) as {
    handleException?: HandleException;
  };

  if (typeof ExceptionsManager?.handleException === 'function') {
    const original = ExceptionsManager.handleException;
    ExceptionsManager.handleException = (error: unknown, isFatal: boolean) => {
      if (!isFatal && isArrayConsumedError(error)) {
        console.warn('[bridge] ignored non-fatal HostFunction rejection (Array already consumed)');
        return;
      }
      original(error, isFatal);
    };
  }
} catch (err) {
  console.warn('[bridge] rejection guard skipped:', err instanceof Error ? err.message : err);
}
