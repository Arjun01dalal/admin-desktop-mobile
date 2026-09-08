const fs = require('node:fs');
const path = require('node:path');

const appConfig = require('../app.json').expo;
const updates = appConfig?.updates || {};
const certificatePath = updates.codeSigningCertificate;
const metadata = updates.codeSigningMetadata;

if (typeof certificatePath !== 'string' || !certificatePath.trim()) {
  throw new Error('Expo Updates codeSigningCertificate is not configured');
}
if (metadata?.keyid !== 'main' || metadata?.alg !== 'rsa-v1_5-sha256') {
  throw new Error('Expo Updates codeSigningMetadata must use keyid=main and rsa-v1_5-sha256');
}

const absoluteCertificatePath = path.resolve(__dirname, '..', certificatePath);
const certificate = fs.readFileSync(absoluteCertificatePath, 'utf8');
if (
  !certificate.includes('-----BEGIN CERTIFICATE-----') ||
  !certificate.includes('-----END CERTIFICATE-----')
) {
  throw new Error(`Invalid Expo Updates certificate: ${certificatePath}`);
}

console.log(`Expo Updates code signing configured: ${certificatePath} (${metadata.keyid})`);
