/** Renderer-side payload hardening before IPC (mirrors main bridge rules). */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;
const MAX_KEYS = 200;
const MAX_ARRAY = 5000;
const MAX_STRING = 100_000;
/** Banner image / video / dialler uploads travel as base64 on the bridge. */
const MAX_LONG_STRING = 16_000_000;
const MAX_JSON_CHARS = 20_000_000;
const LONG_STRING_KEYS = new Set(['Image', 'fileBase64', 'videoBase64']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null || proto === undefined;
}

function sanitizeValue(value: unknown, depth = 0, fieldKey = ''): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return null;

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const max = LONG_STRING_KEYS.has(fieldKey) ? MAX_LONG_STRING : MAX_STRING;
    return value.length > max ? value.slice(0, max) : value;
  }
  if (typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  }

  if (!isPlainObject(value)) return null;

  const out: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (let i = 0; i < Math.min(keys.length, MAX_KEYS); i += 1) {
    const key = keys[i];
    if (key.length > 128 || FORBIDDEN_KEYS.has(key)) continue;
    out[key] = sanitizeValue(value[key], depth + 1, key);
  }
  return out;
}

export function sanitizeBridgePayload(
  payload: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const size = JSON.stringify(payload)?.length ?? 0;
    if (size > MAX_JSON_CHARS) {
      return { ok: false, message: 'Payload too large' };
    }
  } catch {
    return { ok: false, message: 'Payload not serializable' };
  }

  const value = sanitizeValue(payload, 0);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Invalid payload' };
  }
  return { ok: true, value: value as Record<string, unknown> };
}
