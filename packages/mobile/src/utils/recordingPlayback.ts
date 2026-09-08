import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import { getApiBaseUrl, getRecordingAuthCredentials } from '../config';

const DOWNLOAD_TIMEOUT_MS = 120_000;
const MIN_BYTES = 64;

function recordingAllowedOrigins(): Set<string> {
  const configured = (process.env.EXPO_PUBLIC_RECORDING_ALLOWED_HOSTS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);
  const values = configured.length
    ? configured
    : (() => {
        try {
          return [getApiBaseUrl()];
        } catch {
          return [];
        }
      })();
  const origins = new Set<string>();
  for (const value of values) {
    try {
      const target = new URL(/^https:\/\//i.test(value) ? value : `https://${value}`);
      if (target.protocol === 'https:' && !target.username && !target.password && !target.port) {
        origins.add(target.origin);
      }
    } catch {
      // Ignore malformed allowlist entries.
    }
  }
  return origins;
}

function basicAuthHeader(username: string, password: string): string {
  const token = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(`${username}:${password}`));
  return `Basic ${token}`;
}

function getEnvAuthHeader(): string | undefined {
  const creds = getRecordingAuthCredentials();
  if (!creds) return undefined;
  return basicAuthHeader(creds.username, creds.password);
}

export function normalizeRecordingUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isAllowedRecordingUrl(rawUrl: string): boolean {
  const normalized = normalizeRecordingUrl(rawUrl);
  if (!normalized) return false;
  try {
    const target = new URL(normalized);
    return (
      target.protocol === 'https:' &&
      !target.username &&
      !target.password &&
      !target.port &&
      recordingAllowedOrigins().has(target.origin)
    );
  } catch {
    return false;
  }
}

function withPlayableMediaPath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (!/twilio\.com$/i.test(parsed.hostname)) return rawUrl;
    if (/\.(mp3|wav|ogg|m4a)$/i.test(parsed.pathname)) return rawUrl;
    parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}.mp3`;
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function sanitizeRecordingUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function authHeaders(authorization: string): Record<string, string> {
  return { Authorization: authorization, Accept: 'audio/*,*/*;q=0.8' };
}

async function downloadToFile(
  url: string,
  dest: string,
  headers?: Record<string, string>,
): Promise<string | null> {
  try {
    const result = await withTimeout(
      FileSystem.downloadAsync(url, dest, headers ? { headers } : undefined),
      DOWNLOAD_TIMEOUT_MS,
      'Recording download timed out.',
    );
    if (result.status < 200 || result.status >= 300) {
      if (result.status === 401 || result.status === 403) return null;
      throw new Error(`Recording could not be loaded (${result.status}).`);
    }
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (info.size ?? 0) < MIN_BYTES) {
      throw new Error('Recording file is empty or invalid.');
    }
    return result.uri;
  } catch (err) {
    if (err instanceof Error && err.message === 'Recording download timed out.') throw err;
    return null;
  }
}

/**
 * Native download (OkHttp / NSURLSession) — buffers the full stream like desktop Electron net.fetch.
 */
export async function prepareRecordingFile(remoteUrl: string): Promise<string> {
  const normalized = withPlayableMediaPath(normalizeRecordingUrl(remoteUrl));
  if (!normalized) throw new Error('Recording URL is not available.');
  if (!isAllowedRecordingUrl(normalized)) {
    throw new Error('Recording host is not approved.');
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('No cache directory available.');

  const url = sanitizeRecordingUrl(normalized);
  if (!url) throw new Error('Recording URL contains unsupported credentials.');
  const envAuth = getEnvAuthHeader();
  const dest = `${cacheDir}call-recording-${Date.now()}.mp3`;

  const attempts: Array<{ label: string; headers?: Record<string, string> }> = [];

  // Desktop Electron always sends env Basic Auth when configured.
  if (envAuth) attempts.push({ label: 'env', headers: authHeaders(envAuth) });
  // Signed / public URLs last — extra Authorization can break Twilio tokens.
  if (!envAuth) attempts.push({ label: 'plain' });

  for (const attempt of attempts) {
    const local = await downloadToFile(url, dest, attempt.headers);
    if (local) return local;
  }

  if (envAuth) {
    throw new Error('Recording server rejected the credentials.');
  }

  throw new Error(
    'Recording could not be downloaded. Set RECORDING_BASIC_AUTH in mobile .env or try Open in browser.',
  );
}
