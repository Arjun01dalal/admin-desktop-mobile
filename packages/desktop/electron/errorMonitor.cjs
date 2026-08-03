/**
 * Main-process error monitor — logs + optional webhook.
 * Set ERROR_WEBHOOK_URL in .env to POST JSON error events (HTTPS only).
 */
const { assertHttpsUrl } = require('./httpsOnly.cjs');

function getWebhookUrl() {
  const raw = String(process.env.ERROR_WEBHOOK_URL || '').trim();
  if (!raw) return '';
  try {
    return assertHttpsUrl(raw, { label: 'ERROR_WEBHOOK_URL' });
  } catch (err) {
    console.warn('[errorMonitor]', err.message);
    return '';
  }
}

function serializeError(err) {
  if (!err) return { message: 'Unknown error' };
  if (typeof err === 'string') return { message: err };
  return {
    message: err.message || String(err),
    name: err.name,
    stack: typeof err.stack === 'string' ? err.stack.slice(0, 4000) : undefined,
  };
}

async function postWebhook(event) {
  const url = getWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn('[errorMonitor] webhook failed:', err?.message || err);
  }
}

function report(source, err, extra = {}) {
  const event = {
    at: new Date().toISOString(),
    source,
    app: 'astro-desktop',
    ...serializeError(err),
    ...extra,
  };
  console.error('[errorMonitor]', source, event.message, event.stack || '');
  void postWebhook(event);
  return event;
}

function installMainErrorMonitor() {
  process.on('uncaughtException', (err) => {
    report('main:uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    report('main:unhandledRejection', reason);
  });
}

module.exports = {
  installMainErrorMonitor,
  report,
};
