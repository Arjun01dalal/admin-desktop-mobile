/**
 * Device location via geoip-lite (MaxMind GeoLite data).
 * Runs in the Electron main process — no browser GPS / OS popup required.
 */
const axios = require('axios');
const geoip = require('geoip-lite');
const { attachHttpsOnlyInterceptor } = require('./httpsOnly.cjs');

const http = attachHttpsOnlyInterceptor(axios.create({ timeout: 8000 }));

async function resolvePublicIp() {
  const attempts = [
    async () => {
      const { data } = await http.get('https://api.ipify.org?format=json', {
        validateStatus: (s) => s === 200,
      });
      return data?.ip;
    },
    async () => {
      const { data } = await http.get('https://api64.ipify.org?format=json', {
        validateStatus: (s) => s === 200,
      });
      return data?.ip;
    },
    async () => {
      const { data } = await http.get('https://ifconfig.me/ip', {
        responseType: 'text',
        transformResponse: [(v) => v],
        validateStatus: (s) => s === 200,
      });
      return String(data || '').trim();
    },
  ];

  const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
  const IPV6_RE = /^[0-9a-fA-F:]+$/;

  let lastError;
  for (const attempt of attempts) {
    try {
      const ip = String((await attempt()) || '').trim();
      // geoip-lite supports both IPv4 and IPv6 lookups.
      if (ip && (IPV4_RE.test(ip) || (ip.includes(':') && IPV6_RE.test(ip)))) return ip;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not resolve public IP');
}

/**
 * @returns {Promise<{
 *   latitude: number,
 *   longitude: number,
 *   city: string,
 *   state: string,
 *   country: string,
 *   address: object,
 *   source: string
 * }>}
 */
async function getCurrentLocation() {
  const ip = await resolvePublicIp();
  const geo = geoip.lookup(ip);

  if (!geo || !Array.isArray(geo.ll) || geo.ll.length < 2) {
    throw new Error('geoip-lite could not resolve coordinates for this IP');
  }

  const [latitude, longitude] = geo.ll;
  const city = geo.city || '';
  const state = geo.region || '';
  const country = geo.country || '';

  const address = {
    city,
    state,
    country,
    ip,
    timezone: geo.timezone || '',
    source: 'geoip-lite',
  };

  return {
    latitude,
    longitude,
    city,
    state,
    country,
    address,
    source: 'geoip-lite',
  };
}

module.exports = {
  getCurrentLocation,
  resolvePublicIp,
};
