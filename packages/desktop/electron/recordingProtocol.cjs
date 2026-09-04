/**
 * Authenticated recording proxy for <audio> (astro-recording://).
 *
 * Upstream often omits Content-Length; Chromium then shows duration 00:00.
 * We download once to a disk cache (streamed, not held fully in RAM), then
 * serve with Content-Length + Range so seek/duration work.
 */
const { app, net, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { getApiBaseUrl, optionalEnv } = require('./config.cjs');
const { report: reportError } = require('./errorMonitor.cjs');
const ctx = require('./ctx.cjs');

const DIST_DIR = path.join(__dirname, '..', 'dist');
/** Must match BrowserWindow webPreferences.partition in main.cjs */
const PANEL_PARTITION = 'persist:skytalk';

const DIST_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
const RECORDING_CACHE_MAX_ENTRIES = 6;
const RECORDING_CACHE_TTL_MS = 5 * 60 * 1000;
const RECORDING_MAX_BYTES = 80 * 1024 * 1024;

const RECORDING_AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
};

/** @type {Map<string, { filePath: string, type: string, size: number, at: number }>} */
const recordingCache = new Map();
/** @type {Map<string, Promise<{ filePath: string, type: string, size: number, at: number } | { error: string, status: number }>>} */
const inflightLoads = new Map();

function recordingAllowedOrigins() {
  const configured = optionalEnv('RECORDING_ALLOWED_HOSTS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const values = configured.length ? configured : [getApiBaseUrl()];
  const origins = new Set();
  for (const value of values) {
    try {
      const url = new URL(/^https:\/\//i.test(value) ? value : `https://${value}`);
      if (url.protocol === 'https:') origins.add(url.origin);
    } catch {
      // Ignore malformed allowlist entries.
    }
  }
  return origins;
}

function isAllowedRecordingTarget(targetUrl) {
  return recordingAllowedOrigins().has(targetUrl.origin);
}

function cacheDir() {
  return path.join(app.getPath('userData'), 'recording-cache');
}

function ensureCacheDir() {
  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheKey(targetUrl) {
  return crypto.createHash('sha256').update(String(targetUrl)).digest('hex').slice(0, 40);
}

function recordingContentType(targetUrl, upstreamType) {
  const upstream = String(upstreamType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (upstream.startsWith('audio/') || upstream.startsWith('video/')) return upstream;
  try {
    const ext = path.extname(new URL(targetUrl).pathname).toLowerCase();
    if (RECORDING_AUDIO_TYPES[ext]) return RECORDING_AUDIO_TYPES[ext];
  } catch {
    // fall through
  }
  return 'audio/mpeg';
}

function authHeaders() {
  const headers = new Headers({ Accept: 'audio/*,*/*;q=0.8' });
  // Credentials are runtime-only. They must come from the host environment or
  // a server-side proxy, never from env.generated.cjs in a packaged installer.
  const username = process.env.RECORDING_BASIC_AUTH_USERNAME || '';
  const password = process.env.RECORDING_BASIC_AUTH_PASSWORD || '';
  if (username && password) {
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
    );
  }
  return headers;
}

function touchCacheEntry(targetUrl, entry) {
  recordingCache.delete(targetUrl);
  recordingCache.set(targetUrl, entry);
  while (recordingCache.size > RECORDING_CACHE_MAX_ENTRIES) {
    const oldestKey = recordingCache.keys().next().value;
    const oldest = recordingCache.get(oldestKey);
    recordingCache.delete(oldestKey);
    if (oldest?.filePath) {
      try {
        fs.unlinkSync(oldest.filePath);
      } catch {
        // ignore
      }
    }
  }
}

function purgeExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of [...recordingCache.entries()]) {
    if (now - entry.at < RECORDING_CACHE_TTL_MS && fs.existsSync(entry.filePath)) continue;
    recordingCache.delete(key);
    try {
      if (entry.filePath) fs.unlinkSync(entry.filePath);
    } catch {
      // ignore
    }
  }
}

/**
 * Stream upstream body to disk (chunked) so peak RAM stays near chunk size.
 */
async function downloadRecordingToDisk(targetUrl) {
  const res = await net.fetch(targetUrl, {
    headers: authHeaders(),
    redirect: 'error',
  });
  if (!res.ok) {
    return {
      error:
        res.status === 401 || res.status === 403
          ? 'Recording server rejected the credentials'
          : `Recording server returned ${res.status}`,
      status: res.status,
    };
  }

  const type = recordingContentType(targetUrl, res.headers.get('content-type'));
  const dir = ensureCacheDir();
  const finalPath = path.join(dir, `${cacheKey(targetUrl)}.bin`);
  const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;

  let size = 0;
  try {
    const body = res.body;
    if (!body || typeof body.getReader !== 'function') {
      const buf = Buffer.from(await res.arrayBuffer());
      size = buf.length;
      if (!size) return { error: 'Recording is empty', status: 502 };
      if (size > RECORDING_MAX_BYTES) {
        return { error: 'Recording is too large to play in-app', status: 413 };
      }
      fs.writeFileSync(tmpPath, buf);
    } else {
      const reader = body.getReader();
      const fh = fs.openSync(tmpPath, 'w');
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.length) continue;
          size += value.length;
          if (size > RECORDING_MAX_BYTES) {
            throw Object.assign(new Error('Recording is too large to play in-app'), {
              status: 413,
            });
          }
          fs.writeSync(fh, Buffer.from(value));
        }
      } finally {
        try {
          fs.closeSync(fh);
        } catch {
          // ignore
        }
      }
      if (!size) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // ignore
        }
        return { error: 'Recording is empty', status: 502 };
      }
    }

    try {
      fs.unlinkSync(finalPath);
    } catch {
      // first write
    }
    fs.renameSync(tmpPath, finalPath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
    if (err?.status === 413 || /too large/i.test(String(err?.message || ''))) {
      return { error: 'Recording is too large to play in-app', status: 413 };
    }
    throw err;
  }

  const entry = { filePath: finalPath, type, size, at: Date.now() };
  touchCacheEntry(targetUrl, entry);
  return entry;
}

async function ensureRecordingCached(targetUrl) {
  purgeExpiredCache();
  const cached = recordingCache.get(targetUrl);
  if (
    cached &&
    Date.now() - cached.at < RECORDING_CACHE_TTL_MS &&
    cached.size > 0 &&
    fs.existsSync(cached.filePath)
  ) {
    cached.at = Date.now();
    touchCacheEntry(targetUrl, cached);
    return cached;
  }
  if (cached?.filePath) {
    try {
      fs.unlinkSync(cached.filePath);
    } catch {
      // ignore
    }
  }
  recordingCache.delete(targetUrl);

  const existing = inflightLoads.get(targetUrl);
  if (existing) return existing;

  const pending = downloadRecordingToDisk(targetUrl).finally(() => {
    inflightLoads.delete(targetUrl);
  });
  inflightLoads.set(targetUrl, pending);
  return pending;
}

/** Serve from disk; only the requested byte range is loaded into the Response. */
function buildRecordingResponse(entry, rangeHeader) {
  const total = entry.size;
  const baseHeaders = {
    'Content-Type': entry.type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };

  let start = 0;
  let end = total - 1;
  let status = 200;

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || '').trim());
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (!Number.isFinite(start) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
      });
    }
    status = 206;
  }

  const length = end - start + 1;
  const chunk = Buffer.allocUnsafe(length);
  const fd = fs.openSync(entry.filePath, 'r');
  try {
    fs.readSync(fd, chunk, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }

  const headers = {
    ...baseHeaders,
    'Content-Length': String(length),
  };
  if (status === 206) {
    headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
  }

  return new Response(chunk, { status, headers });
}

function isPathInsideDist(candidatePath) {
  const distRoot = path.resolve(DIST_DIR);
  const resolved = path.resolve(candidatePath);
  const prefix = distRoot.endsWith(path.sep) ? distRoot : `${distRoot}${path.sep}`;
  if (process.platform === 'win32') {
    const lowerResolved = resolved.toLowerCase();
    const lowerRoot = distRoot.toLowerCase();
    const lowerPrefix = prefix.toLowerCase();
    return lowerResolved === lowerRoot || lowerResolved.startsWith(lowerPrefix);
  }
  return resolved === distRoot || resolved.startsWith(prefix);
}

function resolveDistFile(relPath) {
  const rel = String(relPath || '').replace(/^\/+/, '') || 'index.html';
  const fullPath = path.normalize(path.join(DIST_DIR, rel));
  if (!isPathInsideDist(fullPath)) return null;
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
  return fullPath;
}

/** Explicit MIME — net.fetch(file://) often returns octet-stream on Windows and ESM won't run. */
function serveDistFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = DIST_MIME_TYPES[ext] || 'application/octet-stream';
  return new Response(fs.readFileSync(filePath), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}

function registerAppProtocol() {
  // Panel windows use a persistent partition — protocol.handle on the default
  // session does not apply there (Windows then prompts to open app:// externally).
  const panelSession = session.fromPartition(PANEL_PARTITION);

  panelSession.protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname);
    const filePath = resolveDistFile(!rel || rel === '/' ? 'index.html' : rel);
    if (filePath) return serveDistFile(filePath);

    // SPA fallback only for navigation requests — missing hashed chunks must 404.
    const accept = request.headers.get('Accept') || '';
    if (accept.includes('text/html')) {
      const indexPath = resolveDistFile('index.html');
      if (indexPath) return serveDistFile(indexPath);
    }

    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  });

  panelSession.protocol.handle('astro-recording', async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const encodedTarget = requestUrl.pathname.replace(/^\/+/, '');
      const targetUrl = new URL(decodeURIComponent(encodedTarget));
      if (targetUrl.protocol !== 'https:') {
        return new Response('Only HTTPS recordings are allowed', { status: 400 });
      }
      if (!isAllowedRecordingTarget(targetUrl)) {
        return new Response('Recording host is not allowlisted', { status: 403 });
      }

      const loaded = await ensureRecordingCached(targetUrl.toString());
      if (loaded.error) {
        return new Response(loaded.error, { status: loaded.status || 502 });
      }
      return buildRecordingResponse(loaded, request.headers.get('range'));
    } catch (error) {
      reportError('recording:proxy', error);
      return new Response('Recording could not be loaded', { status: 502 });
    }
  });
}

ctx.registerAppProtocol = registerAppProtocol;
ctx.DIST_DIR = DIST_DIR;
module.exports = { registerAppProtocol, DIST_DIR, PANEL_PARTITION };
