/**
 * Secure API executor — MAIN PROCESS ONLY.
 * Renderer calls named actions; never sees base URL, paths, or ENTK.
 */
const axios = require('axios');
const { getApiBaseUrl, useViteDevServer } = require('../config.cjs');
const { createPinnedAgent } = require('../certPin.cjs');
const { assertHttpsUrl, attachHttpsOnlyInterceptor } = require('../httpsOnly.cjs');

// Single shared agent so pinned connections can be keep-alive pooled.
const pinnedAgent = createPinnedAgent();
const { encrypt, decrypt } = require('./crypto.cjs');
const {
  sanitizeBridgePayload,
  sanitizeToken,
  isSafeId,
} = require('./bridgeSanitize.cjs');
const { attachAxiosDevLog } = require('./devHttpLog.cjs');

const REGISTRY_PATH = require.resolve('./registry.cjs');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Packaged / production: cache once. Dev (`npm run dev`) reloads so new actions apply without restart. */
let cachedRegistry = null;

function getRegistry() {
  const hotReload =
    useViteDevServer || process.env.SECURE_HOT_REGISTRY === '1';
  if (hotReload) {
    delete require.cache[REGISTRY_PATH];
    cachedRegistry = null;
    return require('./registry.cjs');
  }
  if (!cachedRegistry) {
    cachedRegistry = require('./registry.cjs');
  }
  return cachedRegistry;
}

const CDN_BASE = assertHttpsUrl(
  process.env.MOBILE_CDN_BASE || 'https://d2opi4jisa0j0o.cloudfront.net',
  { label: 'MOBILE_CDN_BASE' },
);

/** Same order/codes as src/constants/clientNames.ts (AS + code for registration URLs). */
const APP_DETAILS = [
  { name: 'Astro Admin', key: 'osGames', code: '01' },
  { name: 'SM Games', key: 'smGames', code: '02' },
  { name: 'SG Games', key: 'sgGames_new', code: '03' },
  { name: 'PS Games', key: 'psGames', code: '04' },
  { name: 'LS Games', key: 'lsGames', code: '05' },
  { name: 'LM Games', key: 'lmGames', code: '06' },
  { name: 'KS Games', key: 'ksGames_new', code: '07' },
  { name: 'AB Games', key: 'abGames', code: '08' },
  { name: 'PM Games', key: 'pmGames', code: '09' },
  { name: 'SB Games', key: 'sbGames', code: '10' },
  { name: 'OM Games', key: 'omGames', code: '11' },
  { name: 'Fairbets Games', key: 'fairbets', code: '12' },
  { name: 'SB247 Games', key: 'sb247', code: '13' },
];

/** Shared axios for API + dialer so one interceptor covers all outbound HTTPS. */
const http = attachHttpsOnlyInterceptor(
  attachAxiosDevLog(
    axios.create({
      maxBodyLength: Infinity,
      timeout: 60000,
      httpsAgent: pinnedAgent,
    }),
    { source: 'secure' },
  ),
);

function apiClient(action) {
  return {
    request: (config) =>
      http.request({
        ...config,
        baseURL: getApiBaseUrl(),
        httpsAgent: pinnedAgent,
        metadata: { ...(config.metadata || {}), action, start: Date.now() },
      }),
    post: (url, data, config = {}) =>
      http.post(url, data, {
        ...config,
        baseURL: getApiBaseUrl(),
        httpsAgent: pinnedAgent,
        metadata: { ...(config.metadata || {}), action, start: Date.now() },
      }),
  };
}

function buildMobileLinks(empCode = '001') {
  return APP_DETAILS.map((item) => {
    const registrationAppName = `AS${item.code}`;
    return {
      name: item.name,
      key: item.key,
      code: item.code,
      registrationAppName,
      // Registration + deposit both use AS{code} path segments
      registrationLink: `${CDN_BASE}/${registrationAppName}/${empCode}`,
      depositLink: `${CDN_BASE}/deposit/${registrationAppName}/${empCode}`,
    };
  });
}

const DIALER_SERVER_MAP = {
  '1': 'api2',
  '3': 'api',
  // Campaign list serverId values (laxminarayan NewRegisterUsers SERVER_MAP_BY_IP)
  '49.206.26.7': 'api2',
  '3.200': 'api',
  default: 'api',
};
const ALLOWED_DIALER_PREFIXES = new Set(['api', 'api2']);

/**
 * Resolve dialer host (laxminarayan CallingBtn + Users addDialerCalls).
 * Prefer campaign id: K_3001 / 3001 → api.ganesha999.com; 1011 → api2.
 * Fall back to admin/campaign serverId map.
 */
function dialerPrefixFromCampaignId(campaignId) {
  const raw = String(campaignId ?? '').trim();
  if (!raw) return null;
  // K_3001 → 3001; keep leading digits after optional letter prefix
  const stripped = raw.replace(/^[A-Za-z]+_/i, '');
  if (/^3/.test(stripped)) return 'api';
  if (/^1/.test(stripped)) return 'api2';
  return null;
}

function dialerBaseUrl(serverId, campaignId) {
  let prefix = dialerPrefixFromCampaignId(campaignId);
  if (!prefix) {
    const key = String(serverId ?? '').trim();
    prefix = DIALER_SERVER_MAP[key];
    if (!prefix) {
      if (key.startsWith('49.')) prefix = 'api2';
      else if (key.startsWith('3.')) prefix = 'api';
      else if (key.startsWith('1.')) prefix = 'api2';
      else prefix = DIALER_SERVER_MAP.default;
    }
  }
  if (!ALLOWED_DIALER_PREFIXES.has(prefix)) {
    return null;
  }
  return `https://${prefix}.ganesha999.com/API/`;
}

/** Dialer hosts return `{ status: "success", inserted }` (not always `success: true`). */
function isDialerSuccess(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.success === true || data.success === 'true' || data.success === 1) {
    return true;
  }
  const status = String(data.status || '').trim().toLowerCase();
  return status === 'success' || status === 'ok';
}

function dialerResultMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (isDialerSuccess(data) && data.inserted != null) {
    return `Added to dialer (${data.inserted} inserted)`;
  }
  return fallback;
}

async function addToDialer(payload = {}) {
  const {
    campaignName,
    users = [],
    extensionId = [],
    adminName = 'ADMIN',
    serverId,
  } = payload;

  if (!campaignName) {
    return { ok: false, message: 'Campaign Name should not be empty' };
  }
  if (!Array.isArray(users) || users.length === 0) {
    return { ok: false, message: 'No users to add to dialer' };
  }

  const ids = Array.isArray(extensionId) ? extensionId.map(String) : [];
  const numericId = ids.find((val) => /^\d+$/.test(val));
  if (!numericId) {
    return { ok: false, message: 'Dialer extension ID not found for this admin' };
  }

  const leads = users.map((item) => sanitizeDialerLead(item)).filter((l) => l.phone_number);
  if (!leads.length) {
    return { ok: false, message: 'No valid phone numbers to add to dialer' };
  }

  const url = dialerBaseUrl(serverId, campaignName || numericId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const response = await http.post(
      url,
      {
        list_id: `9${numericId}`,
        list_name: `${String(adminName).toUpperCase()} BOT CALLING LIST`,
        campaign_id: numericId,
        leads,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        metadata: { action: 'users.addToDialer', start: Date.now() },
      },
    );
    const data = response?.data || {};
    if (isDialerSuccess(data)) {
      return {
        ok: true,
        message: dialerResultMessage(data, 'Added to dialer'),
        data,
      };
    }
    return {
      ok: false,
      message: dialerResultMessage(data, 'Failed to add to dialer'),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to add to dialer',
    };
  }
}

function sanitizeDialerLead(item = {}) {
  return {
    first_name: String(item.first_name || item.client_name || item.name || '').slice(0, 120),
    last_name: String(item.last_name || '').slice(0, 120),
    phone_number: String(item.phone_number || item.mobile || '').replace(/\D/g, '').slice(0, 20),
    city: String(item.city ?? '').slice(0, 80),
    state: String(item.state ?? '').slice(0, 80),
    email: String(item.email || item.clientName || item.app_name || '').slice(0, 120),
    comments: String(item.comments || item.clientName || item.app_name || '').slice(0, 200),
    province: String(item.province || item._id || item.caller_user_id || '').slice(0, 80),
  };
}

function randomDialerListId() {
  // Match laxminarayan NewRegisterUsers: Math.floor(10000 + Math.random() * 90000)
  return Math.floor(10000 + Math.random() * 90000);
}

async function externalDialerBatch(payload = {}) {
  const campaignId = String(
    payload.campaignId || payload.campaign_id || '',
  ).trim();
  const { leads = [], serverId } = payload;
  if (!campaignId) {
    return { ok: false, message: 'Campaign Name should not be empty' };
  }
  if (!Array.isArray(leads) || leads.length === 0) {
    return { ok: false, message: 'No selected rows' };
  }

  const safeLeads = leads.map(sanitizeDialerLead).filter((l) => l.phone_number);
  if (!safeLeads.length) {
    return { ok: false, message: 'No valid phone numbers selected' };
  }

  const url = dialerBaseUrl(serverId, campaignId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  // Prefer explicit list id; otherwise 5-digit random like web panel.
  const rawListId = payload.listId ?? payload.list_id;
  const listId =
    rawListId != null && String(rawListId).trim() !== ''
      ? Number.parseInt(String(rawListId).replace(/\D/g, '').slice(0, 12), 10) ||
        randomDialerListId()
      : randomDialerListId();

  // Web panel uses campaign display name as list_name.
  const listName = String(
    payload.listName || payload.list_name || campaignId,
  ).slice(0, 120);

  try {
    const response = await http.post(
      url,
      {
        list_id: listId,
        list_name: listName,
        campaign_id: campaignId.slice(0, 64),
        leads: safeLeads,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        metadata: { action: 'callLogs.externalDialerBatch', start: Date.now() },
      },
    );
    const data = response?.data || {};
    if (isDialerSuccess(data)) {
      return {
        ok: true,
        message: dialerResultMessage(
          data,
          `${data.inserted ?? safeLeads.length} inserted successfully.`,
        ),
        data: {
          ...(data && typeof data === 'object' ? data : {}),
          list_id: listId,
          campaign_id: campaignId.slice(0, 64),
        },
      };
    }
    return {
      ok: false,
      message: dialerResultMessage(data, 'Dialer call failed'),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.response?.data?.message || error?.message || 'Dialer call failed',
    };
  }
}

async function externalDialerSingle(payload = {}) {
  const { details = {}, extensionId = [], adminName = 'ADMIN', serverId } = payload;
  const ids = Array.isArray(extensionId) ? extensionId.map(String) : [];
  const numericId = ids.find((val) => /^\d+$/.test(val));
  if (!numericId) {
    return { ok: false, message: 'Dialer extension ID not found for this admin' };
  }

  // Call button uses extension as campaign_id (laxmi CallingBtn).
  // 3xxx → api.ganesha999.com; 1xxx → api2.ganesha999.com
  const url = dialerBaseUrl(serverId, numericId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const response = await http.post(
      url,
      {
        list_id: `9${numericId}`,
        list_name: `${String(adminName).toUpperCase()} BOT CALLING LIST`,
        campaign_id: numericId,
        leads: [
          sanitizeDialerLead({
            first_name: details?.client_name,
            phone_number: details?.phone_number,
            city: details?.city,
            state: details?.state,
            email: details?.clientName || details?.app_name,
            comments: details?.clientName || details?.app_name,
            province: details?.caller_user_id,
          }),
        ],
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        metadata: { action: 'callLogs.externalDialerSingle', start: Date.now() },
      },
    );
    const data = response?.data || {};
    return {
      ok: isDialerSuccess(data) || data.success !== false,
      message: dialerResultMessage(data, 'Connected to dialer'),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.response?.data?.message || error?.message || 'Connect dialer failed',
    };
  }
}

async function processCallSummary(payload = {}) {
  const callSid = payload.call_sid || payload.callSid;
  if (!isSafeId(String(callSid || ''), { min: 8, max: 128 })) {
    return { ok: false, message: 'Invalid call_sid' };
  }

  try {
    const response = await http.post(
      'https://helper.callingbot.live/process-call',
      { call_sid: callSid },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        metadata: { action: 'callLogs.processCall', start: Date.now() },
      },
    );
    const data = response?.data || {};
    if (data.status === 'failed') {
      return { ok: false, message: data.message || 'Analysis failed', data };
    }
    return { ok: true, data, message: data.message };
  } catch (error) {
    return {
      ok: false,
      message: error?.response?.data?.message || 'Analysis is in progress.',
    };
  }
}

async function listIncomingBotCalls(payload = {}) {
  const since = String(payload.since || '').slice(0, 64);
  if (!since) {
    return { ok: false, message: 'since date is required' };
  }
  try {
    const response = await http.get('https://helper.callingbot.live/incoming-calls', {
      params: { since },
      timeout: 60000,
      metadata: { action: 'incomingBot.list', start: Date.now() },
    });
    const data = response?.data || {};
    return { ok: true, data, message: data.message };
  } catch (error) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load incoming calls',
    };
  }
}

async function uploadDiallerData(payload = {}, token = null) {
  const { fileBase64, fileName, dateOfData, uploadedBy } = payload;
  if (!fileBase64 || !fileName) {
    return { ok: false, message: 'Please select a CSV file first' };
  }
  if (!dateOfData) {
    return { ok: false, message: 'Please select date' };
  }
  const safeName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  if (!/\.csv$/i.test(safeName)) {
    return { ok: false, message: 'Only CSV uploads are allowed' };
  }

  try {
    const buffer = Buffer.from(String(fileBase64), 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return { ok: false, message: 'Upload exceeds 5MB limit' };
    }
    const blob = new Blob([buffer], { type: 'text/csv' });
    const form = new FormData();
    form.append('file', blob, safeName);
    form.append('dateOfData', String(dateOfData).slice(0, 32));
    form.append(
      'uploadedBy',
      typeof uploadedBy === 'string'
        ? uploadedBy.slice(0, 500)
        : JSON.stringify(uploadedBy || {}).slice(0, 2000),
    );

    const response = await apiClient('caller.uploadDiallerData').post(
      '/SubAdmin/upload-dialler-data',
      form,
      {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      maxBodyLength: Infinity,
      },
    );

    return {
      ok: true,
      success: response.data?.success !== false,
      message: response.data?.message,
      data: response.data?.data ?? response.data,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Upload failed',
      status: error?.response?.status,
    };
  }
}

const MAX_BANNER_VIDEO_BYTES = 50 * 1024 * 1024;
const BANNER_VIDEO_TYPES = new Set(['tutorialVideo', 'howToDepositVideo']);

async function uploadBannerVideo(payload = {}, token = null) {
  const { videoBase64, fileName, videoType, mimeType } = payload;
  if (!videoBase64 || !fileName) {
    return { ok: false, message: 'Please select a video file first' };
  }
  const type = String(videoType || '').trim();
  if (!BANNER_VIDEO_TYPES.has(type)) {
    return { ok: false, message: 'Please select a valid video type' };
  }
  const safeName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  if (!/\.(mp4|webm|mov|m4v|avi)$/i.test(safeName)) {
    return { ok: false, message: 'Only video uploads are allowed (mp4, webm, mov, m4v, avi)' };
  }

  try {
    const raw = String(videoBase64).includes(',')
      ? String(videoBase64).split(',').pop()
      : String(videoBase64);
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length > MAX_BANNER_VIDEO_BYTES) {
      return { ok: false, message: 'Video exceeds 50MB limit' };
    }
    const blob = new Blob([buffer], {
      type: String(mimeType || 'video/mp4').slice(0, 80),
    });
    const form = new FormData();
    form.append('File_Name', 'tutorialVideo');
    form.append('video', blob, safeName);
    form.append('category', 'others');
    form.append('deepLink', 'true');
    form.append('gameName', 'NA');
    form.append('iframeUrlMob', 'NA');
    form.append('mobileOptions', '');
    form.append('mobileRouter', '');
    form.append('type', type);
    form.append('iframeUrl', 'NA');

    const response = await apiClient('ops.bannersUploadVideo').post(
      '/bannerGames/upload_video',
      form,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        maxBodyLength: Infinity,
      },
    );

    let data = response.data?.data ?? response.data;
    if (typeof data === 'string') {
      try {
        data = decrypt(data);
      } catch {
        /* leave as-is */
      }
    }

    return {
      ok: true,
      success: response.data?.success !== false,
      message: response.data?.message || 'Tutorial video uploaded successfully',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Video upload failed',
      status: error?.response?.status,
    };
  }
}

/**
 * @param {string} action - registry key
 * @param {object} payload
 * @param {string|null} token - Bearer token
 */
async function execute(action, payload = {}, token = null) {
  if (typeof action !== 'string' || !/^[a-zA-Z][a-zA-Z0-9._-]{1,80}$/.test(action)) {
    return { ok: false, message: 'Invalid action' };
  }

  const REGISTRY = getRegistry();
  const def = REGISTRY[action];
  if (!def) {
    return { ok: false, message: `Unknown secure action: ${action}` };
  }

  const cleaned = sanitizeBridgePayload(payload);
  if (!cleaned.ok) {
    return { ok: false, message: cleaned.message };
  }
  const safePayload = cleaned.value;
  const safeToken = sanitizeToken(token);

  if (def.type === 'local') {
    if (action === 'mobileApp.getLinks') {
      const empCode = String(safePayload?.empCode || '001').replace(/\D/g, '').slice(0, 12) || '001';
      return {
        ok: true,
        data: buildMobileLinks(empCode),
      };
    }
    if (action === 'users.addToDialer') {
      return addToDialer(safePayload);
    }
    if (action === 'callLogs.externalDialerBatch') {
      return externalDialerBatch(safePayload);
    }
    if (action === 'callLogs.externalDialerSingle') {
      return externalDialerSingle(safePayload);
    }
    if (action === 'callLogs.processCall') {
      return processCallSummary(safePayload);
    }
    if (action === 'incomingBot.processCall') {
      return processCallSummary(safePayload);
    }
    if (action === 'incomingBot.list') {
      return listIncomingBotCalls(safePayload);
    }
    if (action === 'caller.uploadDiallerData') {
      return uploadDiallerData(safePayload, safeToken);
    }
    if (action === 'ops.bannersUploadVideo') {
      return uploadBannerVideo(safePayload, safeToken);
    }
    return { ok: false, message: `Unhandled local action: ${action}` };
  }

  try {
    // Optional meta: `_clientName` → HTTP `client-name` header (KYC bank/UPI calls).
    // Stripped from the encrypted/plain body so it never hits the API payload.
    let requestPayload = safePayload;
    let clientNameHeader = '';
    if (
      safePayload &&
      typeof safePayload === 'object' &&
      !Array.isArray(safePayload) &&
      safePayload._clientName != null
    ) {
      const { _clientName, ...rest } = safePayload;
      requestPayload = rest;
      clientNameHeader = String(_clientName || '')
        .trim()
        .toUpperCase();
    }

    const method = String(def.method || 'POST').toUpperCase();
    const isGet = method === 'GET';
    const body = def.encryptRequest
      ? { token: encrypt(requestPayload) }
      : requestPayload;
    const headers = {
      'Content-Type': 'application/json',
      ...(safeToken ? { Authorization: `Bearer ${safeToken}` } : {}),
      ...(clientNameHeader ? { 'client-name': clientNameHeader } : {}),
    };

    // Match laxminarayan Live Match calls: dates go in the query string for GET.
    let url = def.path;
    if (isGet) {
      const entries = Object.entries(requestPayload || {}).filter(
        ([, v]) => v != null && String(v).length > 0,
      );
      if (entries.length > 0) {
        const qs = new URLSearchParams(
          entries.map(([k, v]) => [k, String(v)]),
        ).toString();
        url = `${def.path}${def.path.includes('?') ? '&' : '?'}${qs}`;
      }
    }

    const response = await apiClient(action).request({
      method,
      url,
      ...(isGet ? {} : { data: body }),
      headers,
      // Per-action override for heavy reports (e.g. Funds payin MID dump).
      timeout: Number(def.timeout) > 0 ? Number(def.timeout) : 60000,
    });

    let data = response.data;

    if (def.decryptResponse && data?.data != null) {
      try {
        if (typeof data.data === 'string') {
          // Match laxminarayan decryptData — keep full envelope ({ payload: ... }).
          const decrypted = decrypt(data.data);
          data = { ...data, data: decrypted };
        } else if (!def.keepDataEnvelope && data.data?.payload !== undefined) {
          data = { ...data, data: data.data.payload };
        }
      } catch (err) {
        if (typeof data.data === 'string') {
          return {
            ok: false,
            message: err?.message || 'Decrypt failed',
            status: response.status,
          };
        }
      }
    }

    // Arrays (Live Match finalBook) must not go through `.data` / `.payload` unwrap.
    let payloadOut;
    if (Array.isArray(data)) {
      payloadOut = data;
    } else if (def.keepDataEnvelope) {
      payloadOut = data?.data ?? data;
    } else if (Array.isArray(data?.data)) {
      payloadOut = data.data;
    } else if (Array.isArray(data?.payload)) {
      payloadOut = data.payload;
    } else {
      payloadOut = data?.data?.payload ?? data?.data ?? data?.payload ?? data;
    }

    return {
      ok: true,
      success: data?.success !== false,
      message: typeof data?.message === 'string' ? data.message : undefined,
      data: payloadOut,
      status: response.status,
    };
  } catch (error) {
    const raw = error?.response?.data?.message;
    let apiMessage =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? JSON.stringify(raw)
          : undefined;
    if (!apiMessage && error?.response?.data?.error) {
      const err = error.response.data.error;
      apiMessage = typeof err === 'string' ? err : JSON.stringify(err);
    }
    const code = error?.code || error?.cause?.code;
    const timedOut =
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED' ||
      /timeout|etimedout|econnaborted/i.test(String(error?.message || ''));

    return {
      ok: false,
      message:
        apiMessage ||
        (timedOut
          ? 'Request timed out. Try again or use a shorter date range.'
          : error?.message) ||
        'Secure API request failed',
      status: error?.response?.status,
    };
  }
}

module.exports = { execute, buildMobileLinks };
