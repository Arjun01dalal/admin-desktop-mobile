const projectId = String(process.env.STALLION_PROJECT_ID || '').trim();
const appToken = String(process.env.STALLION_APP_TOKEN || '').trim();

if (process.env.EAS_BUILD === '1') {
  const profile = String(process.env.EAS_BUILD_PROFILE || '').toLowerCase();
  const needsStallion = profile !== 'development' && profile !== 'development-simulator';
  if (needsStallion && (!projectId || !appToken)) {
    throw new Error(
      'STALLION_PROJECT_ID and STALLION_APP_TOKEN are required for preview/production EAS builds',
    );
  }
}

if (appToken && !appToken.startsWith('spb_')) {
  throw new Error('STALLION_APP_TOKEN must start with spb_');
}

console.log(
  projectId
    ? `Stallion OTA configured (project ${projectId.slice(0, 8)}…)`
    : 'Stallion OTA credentials not set (ok for local Metro / Expo Go)',
);
