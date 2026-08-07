/**
 * Same payload crypto as electron/secure/crypto.cjs:
 * CryptoJS passphrase-based AES (OpenSSL-compatible salted format, EVP_BytesToKey/MD5, CBC + PKCS7).
 */
import CryptoJS from 'crypto-js';
import { getEntkValue } from '../config';

export function encryptPayload(payload: unknown): string {
  return CryptoJS.AES.encrypt(JSON.stringify(payload), getEntkValue()).toString();
}

export function decryptPayload<T = unknown>(cipherText: string): T {
  const bytes = CryptoJS.AES.decrypt(cipherText, getEntkValue());
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8)) as T;
}

/** Return `.payload` when present (mirrors desktop `unwrap`). */
export function unwrap<T = unknown>(data: unknown): T {
  if (data && typeof data === 'object' && 'payload' in (data as Record<string, unknown>)) {
    return (data as { payload: T }).payload;
  }
  return data as T;
}
