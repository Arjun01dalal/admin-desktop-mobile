/**
 * Bridge payload hardening — MAIN PROCESS ONLY.
 * Blocks prototype pollution, bounds depth/size, strips unsafe types.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;
const MAX_KEYS = 200;
const MAX_ARRAY = 5000;
const MAX_STRING = 100_000;
/** Banner image / video / dialler uploads travel as base64 on the bridge. */
const MAX_LONG_STRING = 16_000_000;
const MAX_JSON_CHARS = 20_000_000;
const LONG_STRING_KEYS = new Set(['Image', 'fileBase64', 'videoBase64']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  // Permissive for IPC-deserialized objects (prototype can vary by Chromium).
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null || proto === undefined;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {string} [fieldKey]
 * @returns {unknown}
 */
function sanitizeBridgeValue(value, depth = 0, fieldKey = '') {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return null;

  const t = typeof value;
  if (t === 'boolean' || t === 'number') {
    if (t === 'number' && !Number.isFinite(value)) return null;
    return value;
  }
  if (t === 'string') {
    const max = LONG_STRING_KEYS.has(fieldKey) ? MAX_LONG_STRING : MAX_STRING;
    return value.length > max ? value.slice(0, max) : value;
  }
  if (t !== 'object') return null;

  if (Array.isArray(value)) {
    const out = [];
    const len = Math.min(value.length, MAX_ARRAY);
    for (let i = 0; i < len; i += 1) {
      out.push(sanitizeBridgeValue(value[i], depth + 1));
    }
    return out;
  }

  if (!isPlainObject(value)) return null;

  const out = Object.create(null);
  const keys = Object.keys(value);
  const limit = Math.min(keys.length, MAX_KEYS);
  for (let i = 0; i < limit; i += 1) {
    const key = keys[i];
    if (typeof key !== 'string' || key.length > 128) continue;
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = sanitizeBridgeValue(value[key], depth + 1, key);
  }
  return { ...out };
}

function estimatePayloadSize(value) {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, value: Record<string, unknown> } | { ok: false, message: string }}
 */
function sanitizeBridgePayload(payload) {
  if (payload == null) return { ok: true, value: {} };
  if (!isPlainObject(payload)) {
    return { ok: false, message: 'Invalid payload' };
  }
  if (estimatePayloadSize(payload) > MAX_JSON_CHARS) {
    return { ok: false, message: 'Payload too large' };
  }
  const value = sanitizeBridgeValue(payload, 0);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Invalid payload' };
  }
  return { ok: true, value };
}

/** Accept session tokens — only reject clearly malformed values. */
function sanitizeToken(token) {
  if (token == null || token === '') return null;
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  // Keep permissive: real JWTs are long, but some envs use shorter session ids.
  if (trimmed.length < 8 || trimmed.length > 16_384) return null;
  if (/[\r\n\0]/.test(trimmed)) return null;
  return trimmed;
}

/** Dialer/call_sid-like identifiers. */
function isSafeId(value, { min = 6, max = 128 } = {}) {
  if (typeof value !== 'string') return false;
  return new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`).test(value);
}

module.exports = {
  sanitizeBridgePayload,
  sanitizeToken,
  isSafeId,
  MAX_JSON_CHARS,
};
