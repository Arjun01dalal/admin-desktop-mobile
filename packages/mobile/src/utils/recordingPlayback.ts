import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import { getRecordingAuthCredentials } from '../config';

const DOWNLOAD_TIMEOUT_MS = 120_000;
const MIN_BYTES = 64;

function basicAuthHeader(username: string, password: string): string {
  const token = CryptoJS.enc.Base64.stringify(
    CryptoJS.enc.Utf8.parse(`${username}:${password}`),
  );
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

function splitUrlAuth(rawUrl: string): { url: string; authorization?: string } {
  try {
    const parsed = new URL(rawUrl);
    const username = decodeURIComponent(parsed.username || '');
    const password = decodeURIComponent(parsed.password || '');
    parsed.username = '';
    parsed.password = '';
    if (username || password) {
      return { url: parsed.toString(), authorization: basicAuthHeader(username, password) };
    }
    return { url: parsed.toString() };
  } catch {
    return { url: rawUrl };
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
  if (!/^https:/i.test(normalized)) throw new Error('Only HTTPS recordings are supported.');

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('No cache directory available.');

  const { url, authorization: urlAuth } = splitUrlAuth(normalized);
  const envAuth = getEnvAuthHeader();
  const dest = `${cacheDir}call-recording-${Date.now()}.mp3`;

  const attempts: Array<{ label: string; headers?: Record<string, string> }> = [];

  // Desktop Electron always sends env Basic Auth when configured.
  if (envAuth) attempts.push({ label: 'env', headers: authHeaders(envAuth) });
  if (urlAuth && urlAuth !== envAuth) {
    attempts.push({ label: 'url', headers: authHeaders(urlAuth) });
  }
  // Signed / public URLs last — extra Authorization can break Twilio tokens.
  if (!envAuth && !urlAuth) attempts.push({ label: 'plain' });

  for (const attempt of attempts) {
    const local = await downloadToFile(url, dest, attempt.headers);
    if (local) return local;
  }

  if (envAuth || urlAuth) {
    throw new Error('Recording server rejected the credentials.');
  }

  throw new Error(
    'Recording could not be downloaded. Set RECORDING_BASIC_AUTH in mobile .env or try Open in browser.',
  );
}
