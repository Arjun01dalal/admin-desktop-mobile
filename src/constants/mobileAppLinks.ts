import { CLIENT_APP_CODES, type ClientName } from './clientNames';

/** CDN used for Mobile App registration / deposit links. */
export const MOBILE_CDN_BASE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_MOBILE_CDN_BASE?: string } }).env
      ?.VITE_MOBILE_CDN_BASE) ||
  'https://d2opi4jisa0j0o.cloudfront.net';

export type MobileAppDef = {
  name: string;
  /** Legacy deposit path key (kept for reference / fallbacks). */
  depositKey: string;
  clientName: ClientName;
};

/**
 * Mobile App rows — order matches CLIENT_NAMES / app codes.
 * Registration + deposit URLs use AS{code} (e.g. AS01, AS08).
 */
export const MOBILE_APP_DETAILS: MobileAppDef[] = [
  { name: 'Third Eye Astro', depositKey: 'osGames', clientName: 'OS' },
  { name: 'SM Games', depositKey: 'smGames', clientName: 'SM' },
  { name: 'SG Games', depositKey: 'sgGames_new', clientName: 'SG' },
  { name: 'PS Games', depositKey: 'psGames', clientName: 'PS' },
  { name: 'LS Games', depositKey: 'lsGames', clientName: 'LS' },
  { name: 'LM Games', depositKey: 'lmGames', clientName: 'LM' },
  { name: 'KS Games', depositKey: 'ksGames_new', clientName: 'KS' },
  { name: 'AB Games', depositKey: 'abGames', clientName: 'AB' },
  { name: 'PM Games', depositKey: 'pmGames', clientName: 'PM' },
  { name: 'SB Games', depositKey: 'sbGames', clientName: 'SB' },
  { name: 'OM Games', depositKey: 'omGames', clientName: 'OM' },
  { name: 'Fairbets Games', depositKey: 'fairbets', clientName: 'FAIRBETS' },
  { name: 'SB247 Games', depositKey: 'sb247', clientName: 'SB247' },
];

export type MobileAppLink = {
  name: string;
  key: string;
  code: string;
  registrationAppName: string;
  registrationLink: string;
  depositLink: string;
};

/** Build Mobile App table rows with AS{code} registration + deposit paths. */
export function buildMobileAppLinks(empCode = '001'): MobileAppLink[] {
  const code = String(empCode || '001').replace(/\D/g, '').slice(0, 12) || '001';
  return MOBILE_APP_DETAILS.map((item) => {
    const appCode = CLIENT_APP_CODES[item.clientName];
    const asPath = `AS${appCode}`;
    return {
      name: item.name,
      key: item.depositKey,
      code: appCode,
      registrationAppName: asPath,
      registrationLink: `${MOBILE_CDN_BASE}/${asPath}/${code}`,
      depositLink: `${MOBILE_CDN_BASE}/deposit/${asPath}/${code}`,
    };
  });
}
