/**
 * One native location request at a time.
 *
 * Hermes throws an uncaught "Exception in HostFunction: Array already consumed"
 * when a second expo-location call starts before the previous native request
 * has released its result array (timeout + watch, or last-known + current).
 * The lock stays held until the native promise settles, even if the caller
 * already moved on because of a timeout.
 */
import * as Location from 'expo-location';

let idle: Promise<void> = Promise.resolve();

export function isArrayConsumedError(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === 'string') {
      parts.push(current);
      break;
    }
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return /array already consumed/i.test(parts.join(' '));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const id = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out`));
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

/**
 * Start a location call only after every previous native call has finished.
 * `timeoutMs` rejects the returned promise early, but the next caller still
 * waits until this native call actually settles.
 */
export function runWhenLocationIdle<T>(
  start: () => Promise<T>,
  timeoutMs?: number,
  label = 'location',
): Promise<T> {
  const prev = idle;
  let release!: () => void;
  const lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  idle = prev.then(() => lock);

  return prev.then(
    () => {
      let native: Promise<T>;
      try {
        native = start();
      } catch (err) {
        release();
        throw err;
      }

      const guarded = native.then(
        (value) => value,
        (err: unknown) => {
          if (isArrayConsumedError(err)) {
            throw new Error('Could not get device location. Checking again…');
          }
          throw err;
        },
      );
      guarded.then(
        () => release(),
        () => release(),
      );

      if (!timeoutMs) return guarded;
      return withTimeout(guarded, timeoutMs, label);
    },
    (err) => {
      release();
      throw err;
    },
  );
}

export function readLastKnownPosition(
  options?: Location.LocationLastKnownOptions,
): Promise<Location.LocationObject | null> {
  return runWhenLocationIdle(() => Location.getLastKnownPositionAsync(options));
}

export function readCurrentPosition(
  options: Location.LocationOptions,
  timeoutMs: number,
  label: string,
): Promise<Location.LocationObject> {
  return runWhenLocationIdle(() => Location.getCurrentPositionAsync(options), timeoutMs, label);
}
