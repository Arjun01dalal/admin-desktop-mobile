/**
 * Secure API executor — MAIN PROCESS ONLY.
 * Renderer calls named actions; never sees base URL, paths, or ENTK.
 */
const axios = require('axios');
const { getApiBaseUrl } = require('../config.cjs');
const { createPinnedAgent } = require('../certPin.cjs');

// Single shared agent so pinned connections can be keep-alive pooled.
const pinnedAgent = createPinnedAgent();
const { encrypt, unwrap } = require('./crypto.cjs');
const {
  sanitizeBridgePayload,
  sanitizeToken,
  isSafeId,
} = require('./bridgeSanitize.cjs');

const REGISTRY_PATH = require.resolve('./registry.cjs');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function getRegistry() {
  // Vite only reloads the renderer — main-process require() stays cached.
  // In ELECTRON_DEV, re-read registry.cjs so new actions work without a full restart.
  if (process.env.ELECTRON_DEV === '1') {
    delete require.cache[REGISTRY_PATH];
  }
  return require('./registry.cjs');
}

const CDN_BASE = process.env.MOBILE_CDN_BASE || 'https://d2opi4jisa0j0o.cloudfront.net';

/** Same order/codes as src/constants/clientNames.ts (AS + code for registration URLs). */
const APP_DETAILS = [
  { name: 'Third Eye Astro', key: 'osGames', code: '01' },
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

function client() {
  return axios.create({
    baseURL: getApiBaseUrl(),
    maxBodyLength: Infinity,
    timeout: 60000,
    httpsAgent: pinnedAgent,
  });
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
  default: 'api',
};
const ALLOWED_DIALER_PREFIXES = new Set(Object.values(DIALER_SERVER_MAP));

function dialerBaseUrl(serverId) {
  const prefix = DIALER_SERVER_MAP[String(serverId)] || DIALER_SERVER_MAP.default;
  if (!ALLOWED_DIALER_PREFIXES.has(prefix)) {
    return null;
  }
  return `https://${prefix}.ganesha999.com/API/`;
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

  const url = dialerBaseUrl(serverId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const response = await axios.post(
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
      },
    );
    const data = response?.data || {};
    if (data.success) {
      return { ok: true, message: data.message || 'Added to dialer', data };
    }
    return { ok: false, message: data.message || 'Failed to add to dialer', data };
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

async function externalDialerBatch(payload = {}) {
  const { campaignId, leads = [], serverId } = payload;
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

  const url = dialerBaseUrl(serverId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const response = await axios.post(
      url,
      {
        list_id: '50999',
        list_name: 'MULTIPLE BOT DATA',
        campaign_id: String(campaignId).slice(0, 64),
        leads: safeLeads,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
    );
    const data = response?.data || {};
    if (data.success) {
      return { ok: true, message: data.message || 'Dialer call queued', data };
    }
    return { ok: false, message: data.message || 'Dialer call failed', data };
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

  const url = dialerBaseUrl(serverId);
  if (!url) return { ok: false, message: 'Invalid dialer server' };

  try {
    const response = await axios.post(
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
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
    );
    const data = response?.data || {};
    return {
      ok: data.success !== false,
      message: data.message || 'Connected to dialer',
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
    const response = await axios.post(
      'https://helper.callingbot.live/process-call',
      { call_sid: callSid },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
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

    const response = await client().post('/SubAdmin/upload-dialler-data', form, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      maxBodyLength: Infinity,
    });

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
    if (action === 'caller.uploadDiallerData') {
      return uploadDiallerData(safePayload, safeToken);
    }
    return { ok: false, message: `Unhandled local action: ${action}` };
  }

  try {
    const body = def.encryptRequest ? { token: encrypt(safePayload) } : safePayload;
    const headers = {
      'Content-Type': 'application/json',
      ...(safeToken ? { Authorization: `Bearer ${safeToken}` } : {}),
    };

    const response = await client().request({
      method: def.method || 'POST',
      url: def.path,
      data: body,
      headers,
    });

    let data = response.data;

    if (def.decryptResponse && data?.data != null) {
      try {
        data = {
          ...data,
          data: unwrap(data.data),
        };
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

    // Normalize payload for renderer — never return full raw response envelope.
    const payloadOut = data?.data?.payload ?? data?.data ?? data?.payload ?? data;

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
    return {
      ok: false,
      message:
        apiMessage ||
        error?.message ||
        'Secure API request failed',
      status: error?.response?.status,
    };
  }
}

module.exports = { execute, buildMobileLinks };
