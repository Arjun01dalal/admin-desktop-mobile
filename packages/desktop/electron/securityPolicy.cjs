/**
 * Security policy helpers shared by the Electron main process and tests.
 *
 * The panel renderer is the only renderer allowed to use the privileged
 * preload bridge. Keep this policy exact: no ports, credentials, or alternate
 * hosts are accepted for the packaged app origin.
 */
function isTrustedPanelOrigin(rawUrl, { allowDevServer = false } = {}) {
  try {
    const url = new URL(String(rawUrl || ''));
    const hasNoCredentials = !url.username && !url.password;

    if (url.protocol === 'app:' && url.hostname === 'localhost' && !url.port && hasNoCredentials) {
      return true;
    }

    return (
      allowDevServer &&
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port === '5173' &&
      hasNoCredentials
    );
  } catch {
    return false;
  }
}

function getPanelNavigationAction(rawUrl, { allowDevServer = false, isDeepLink } = {}) {
  if (typeof isDeepLink === 'function' && isDeepLink(rawUrl)) {
    return 'deep-link';
  }
  return isTrustedPanelOrigin(rawUrl, { allowDevServer }) ? 'allow' : 'block';
}

module.exports = { getPanelNavigationAction, isTrustedPanelOrigin };
