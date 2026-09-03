/**
 * Public Astro site auth (api.astrothirdeye.com) — login / forgot password.
 * Separate from panel SubAdmin APIs (no ENTK encryption, no cert pin).
 */
const axios = require('axios');
const { attachHttpsOnlyInterceptor } = require('./httpsOnly.cjs');

const SITE_API_BASE = 'https://api.astrothirdeye.com';

let sharedClient = null;

function client() {
  if (!sharedClient) {
    sharedClient = attachHttpsOnlyInterceptor(
      axios.create({
        baseURL: SITE_API_BASE,
        timeout: 30000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
  }
  return sharedClient;
}

function apiMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.msg === 'string' && data.msg.trim()) return data.msg;
  if (Array.isArray(data?.errors) && data.errors[0]) {
    const first = data.errors[0];
    if (typeof first === 'string') return first;
    if (typeof first?.msg === 'string') return first.msg;
    if (typeof first?.message === 'string') return first.message;
  }
  return error?.message || fallback;
}

function pickAccessToken(data) {
  if (!data || typeof data !== 'object') return '';

  const direct = String(
    data.accessToken ||
      data.access_token ||
      data.token ||
      data?.data?.accessToken ||
      data?.data?.access_token ||
      data?.data?.token ||
      data?.payload?.accessToken ||
      data?.payload?.token ||
      data?.result?.accessToken ||
      data?.result?.access_token ||
      data?.data?.result?.accessToken ||
      '',
  ).trim();
  if (direct && direct.length <= 8192) return direct;

  // Deep walk — API shapes vary; site SSO requires a single hash access_token.
  const stack = [data];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const [key, value] of Object.entries(cur)) {
      if (typeof value === 'string') {
        const s = value.trim();
        if (!s || s.length < 20 || s.length > 8192) continue;
        if (/^(fcm|device)/i.test(s)) continue;
        if (/^(access[_-]?token|token|jwt|authorization)$/i.test(key)) return s;
        if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(s)) return s;
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return '';
}

/** Same check astrotalk.vip uses for #external_login before opening TabLayout (home). */
async function assertAstrologerProfileToken(accessToken) {
  const token = String(accessToken || '').trim();
  if (
    !token ||
    token.length > 8192 ||
    token.trim() !== token ||
    /[\s\u0000-\u001F\u007F]/.test(token)
  ) {
    return {
      ok: false,
      message: 'External login token missing or malformed. Please sign in again.',
    };
  }
  try {
    const response = await client().get('/api/astrologer/profile', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      validateStatus: () => true,
    });
    if (response.status >= 200 && response.status < 300) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: 'External login link is invalid or expired. Please sign in again.',
      };
    }
    return { ok: false, message: 'External login could not be verified. Please try again.' };
  } catch (error) {
    return {
      ok: false,
      message: apiMessage(error, 'External login service is unavailable. Please try again.'),
    };
  }
}

async function loginViaPassword(payload = {}) {
  const deviceId = String(payload.deviceId || 'desktop').trim() || 'desktop';
  const fcmToken = String(payload.fcmToken || '').trim();
  if (!fcmToken) {
    return { ok: false, message: 'FCM token is required' };
  }
  const body = {
    email: String(payload.email || '').trim(),
    password: String(payload.password || ''),
    deviceId,
    os: String(payload.os || 'web'),
    modelNumber: String(payload.modelNumber || 'Electron'),
    longitude: String(payload.longitude ?? '0.0'),
    latitude: String(payload.latitude ?? '0.0'),
    fcmToken,
  };
  if (!body.email || !body.password) {
    return { ok: false, message: 'Email and password are required' };
  }
  try {
    const response = await client().post('/api/auth/login-via-password', body);
    const data = response?.data || {};
    const accessToken = pickAccessToken(data);
    if (!accessToken) {
      return {
        ok: false,
        message: 'Login response did not include an access token',
        data,
      };
    }
    // Fail here (not on website Signin) if token cannot open Astro home.
    const profile = await assertAstrologerProfileToken(accessToken);
    if (!profile.ok) {
      return { ok: false, message: profile.message, data };
    }
    return {
      ok: true,
      message: data.message || 'Login successful',
      accessToken,
      data,
    };
  } catch (error) {
    return { ok: false, message: apiMessage(error, 'Login failed') };
  }
}

async function sendEmailOtp(payload = {}) {
  const email = String(payload.email || '').trim();
  if (!email) return { ok: false, message: 'Email is required' };
  try {
    const response = await client().post('/api/auth/send-email-otp', { email });
    const data = response?.data || {};
    return {
      ok: true,
      message: data.message || 'OTP sent',
      data,
    };
  } catch (error) {
    return { ok: false, message: apiMessage(error, 'Failed to send OTP') };
  }
}

async function verifyEmailOtp(payload = {}) {
  const email = String(payload.email || '').trim();
  const otp = String(payload.otp || '').trim();
  const deviceId = String(payload.deviceId || 'desktop');
  if (!email || !otp) return { ok: false, message: 'Email and OTP are required' };
  try {
    const response = await client().post('/api/auth/verify-otp', {
      email,
      otp,
      deviceId,
    });
    const data = response?.data || {};
    const accessToken = pickAccessToken(data);
    if (!accessToken) {
      return { ok: false, message: 'OTP verified but reset token was missing' };
    }
    return {
      ok: true,
      message: data.message || 'OTP verified',
      accessToken,
      data,
    };
  } catch (error) {
    return { ok: false, message: apiMessage(error, 'Invalid OTP') };
  }
}

async function resetPassword(payload = {}) {
  const email = String(payload.email || '').trim();
  const newPassword = String(payload.newPassword || payload.password || '');
  const accessToken = String(payload.accessToken || payload.resetAccessToken || '').trim();
  if (!email || !newPassword) {
    return { ok: false, message: 'Email and new password are required' };
  }
  if (!accessToken) {
    return { ok: false, message: 'Reset token is required' };
  }
  try {
    const response = await client().post(
      '/api/auth/reset-password',
      { email, newPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = response?.data || {};
    return {
      ok: true,
      message: data.message || 'Password reset successful',
      data,
    };
  } catch (error) {
    return { ok: false, message: apiMessage(error, 'Password reset failed') };
  }
}

async function fetchTermsAndConditions() {
  try {
    const response = await client().get('/api/public/fetch-static-pages', {
      params: { type: 6100 }, // STATIC_PAGE.TYPE.TERMS_CONDITIONS
    });
    const data = response?.data?.data || {};
    const json = data.jsonContent || {};
    const heading = String(json.heading || 'Terms & Conditions').trim();
    const bodyHtml = String(json.body || '').trim();
    if (!bodyHtml) {
      return { ok: false, message: 'Terms content was empty' };
    }
    return {
      ok: true,
      heading,
      bodyHtml,
      updatedAt: data.updatedAt || null,
    };
  } catch (error) {
    return { ok: false, message: apiMessage(error, 'Failed to load Terms & Conditions') };
  }
}

module.exports = {
  loginViaPassword,
  sendEmailOtp,
  verifyEmailOtp,
  resetPassword,
  fetchTermsAndConditions,
};
