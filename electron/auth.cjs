const CryptoJS = require('crypto-js');
const axios = require('axios');
const { getApiBaseUrl, getEntkValue } = require('./config.cjs');
const { createPinnedAgent } = require('./certPin.cjs');

// Single shared agent so pinned connections can be keep-alive pooled.
const pinnedAgent = createPinnedAgent();

function encrypt(payload) {
  return CryptoJS.AES.encrypt(JSON.stringify(payload), getEntkValue()).toString();
}

function decrypt(cipherText) {
  const bytes = CryptoJS.AES.decrypt(cipherText, getEntkValue());
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

function client() {
  return axios.create({
    baseURL: getApiBaseUrl(),
    maxBodyLength: Infinity,
    timeout: 30000,
    httpsAgent: pinnedAgent,
  });
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sendOtp({ mobile, token }) {
  const response = await client().post(
    '/SubAdmin/send-otp',
    { token: encrypt({ mobile }) },
    { headers: authHeader(token) },
  );
  return { ok: true, message: response?.data?.message || 'OTP sent' };
}

async function getAddress({ lat, lng, token }) {
  const response = await client().post(
    '/transaction/getAddress',
    { token: encrypt({ lat, lng }) },
    { headers: authHeader(token) },
  );
  const decrypted = decrypt(response.data.data);
  return decrypted?.payload ?? decrypted ?? {};
}

async function verifyOtp(payload) {
  const {
    mobile,
    otp,
    state,
    city,
    lat,
    long,
    address,
    token,
  } = payload;

  const response = await client().post(
    '/SubAdmin/verify-otp',
    {
      token: encrypt({
        mobile,
        otp: typeof otp === 'string' ? parseInt(otp, 10) : otp,
        state,
        city,
        lat: lat?.toString(),
        long: long?.toString(),
        address,
      }),
    },
    { headers: authHeader(token) },
  );

  let data = response.data.data;
  if (typeof data === 'string') {
    data = decrypt(data);
  }
  const user = data?.payload ?? data;

  return {
    ok: true,
    token: response.data.token,
    user,
  };
}

async function getIpLocation() {
  // Prefer local geoip-lite library (stable for Electron).
  // Fall back to remote IP API if offline DB lookup fails.
  try {
    const { getCurrentLocation } = require('./location.cjs');
    return await getCurrentLocation();
  } catch (primaryError) {
    try {
      const response = await axios.get('https://ipapi.co/json/', { timeout: 12000 });
      const data = response.data || {};

      if (data.error) {
        throw new Error(data.reason || 'IP location lookup failed');
      }

      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('IP location returned invalid coordinates');
      }

      const address = {
        city: data.city || '',
        state: data.region || data.region_code || '',
        country: data.country_name || data.country || '',
        postal: data.postal || '',
        ip: data.ip || '',
        source: 'ipapi',
      };

      return {
        latitude,
        longitude,
        city: address.city,
        state: address.state,
        address,
        source: 'ipapi',
      };
    } catch {
      throw primaryError;
    }
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  getAddress,
  getIpLocation,
};
