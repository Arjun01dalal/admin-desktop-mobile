const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { getTrustedPanelSender } = require('../electron/ipcBoundary.cjs');
const {
  getPanelNavigationAction,
  isTrustedPanelOrigin,
} = require('../electron/securityPolicy.cjs');

test('packaged panel origin accepts only the exact app origin', () => {
  assert.equal(isTrustedPanelOrigin('app://localhost/index.html'), true);
  assert.equal(isTrustedPanelOrigin('app://localhost:443/index.html'), false);
  assert.equal(isTrustedPanelOrigin('app://localhost@example.com/index.html'), false);
  assert.equal(isTrustedPanelOrigin('http://localhost/index.html'), false);
  assert.equal(isTrustedPanelOrigin('app://evil.example/index.html'), false);
});

test('development panel origin is opt-in and exact', () => {
  assert.equal(
    isTrustedPanelOrigin('http://127.0.0.1:5173/index.html', { allowDevServer: true }),
    true,
  );
  assert.equal(
    isTrustedPanelOrigin('http://127.0.0.1:5174/index.html', { allowDevServer: true }),
    false,
  );
  assert.equal(
    isTrustedPanelOrigin('http://127.0.0.1:5173/index.html', { allowDevServer: false }),
    false,
  );
  assert.equal(
    isTrustedPanelOrigin('http://user:password@127.0.0.1:5173/index.html', {
      allowDevServer: true,
    }),
    false,
  );
});

test('panel navigation policy handles startup, redirects, and deep links', () => {
  const isDeepLink = (url) => String(url).startsWith('myastroapp://');
  assert.equal(getPanelNavigationAction('app://localhost/index.html', { isDeepLink }), 'allow');
  assert.equal(
    getPanelNavigationAction('http://127.0.0.1:5173/index.html', {
      allowDevServer: true,
      isDeepLink,
    }),
    'allow',
  );
  assert.equal(getPanelNavigationAction('https://evil.example/redirect', { isDeepLink }), 'block');
  assert.equal(
    getPanelNavigationAction('myastroapp://login?logged_out=1', { isDeepLink }),
    'deep-link',
  );
});

function makeSender(url, id = 7, destroyed = false) {
  return {
    id,
    isDestroyed: () => destroyed,
    getURL: () => url,
  };
}

test('IPC boundary rejects untrusted and unregistered senders', () => {
  const panelWindow = { webContents: { id: 7 } };
  const panel = { win: panelWindow };
  const sender = makeSender('https://evil.example/', 7);
  const dependencies = {
    BrowserWindow: { fromWebContents: () => panelWindow },
    panelWindows: { getPanelByWindow: () => panel },
    isTrustedPanelOrigin: (url) => url === 'app://localhost/index.html',
  };

  assert.equal(getTrustedPanelSender({ sender }, dependencies), null);

  const trustedSender = makeSender('app://localhost/index.html', 8);
  assert.equal(getTrustedPanelSender({ sender: trustedSender }, dependencies), null);
});

test('IPC boundary returns only the matching trusted panel', () => {
  const sender = makeSender('app://localhost/index.html', 7);
  const panel = { win: { webContents: { id: 7 } } };
  const result = getTrustedPanelSender(
    { sender },
    {
      BrowserWindow: { fromWebContents: () => panel.win },
      panelWindows: { getPanelByWindow: () => panel },
      isTrustedPanelOrigin: () => true,
    },
  );

  assert.equal(result, panel);
});

test('IPC boundary fails closed when trust policy is unavailable', () => {
  const sender = makeSender('app://localhost/index.html');
  assert.equal(
    getTrustedPanelSender(
      { sender },
      {
        BrowserWindow: { fromWebContents: () => ({}) },
        panelWindows: { getPanelByWindow: () => ({}) },
        isTrustedPanelOrigin: undefined,
      },
    ),
    null,
  );
});

function runPreload(href, electronDev = false) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  let exposedBridge = null;
  const ipcRenderer = {
    invoke: () => Promise.resolve(),
    send: () => {},
    on: () => {},
    removeListener: () => {},
  };
  const contextBridge = {
    exposeInMainWorld: (_name, bridge) => {
      exposedBridge = bridge;
    },
  };
  const mockRequire = (request) => {
    if (request === 'electron') return { contextBridge, ipcRenderer };
    if (request === '../package.json') return { version: 'test' };
    throw new Error(`Unexpected preload dependency: ${request}`);
  };
  const module = { exports: {} };
  const wrapper = vm.runInNewContext(
    `(function (require, module, exports, __filename, __dirname) { ${source}\n })`,
    {
      URL,
      process: { env: electronDev ? { ELECTRON_DEV: '1' } : {} },
      window: { location: { href } },
    },
  );
  wrapper(
    mockRequire,
    module,
    module.exports,
    path.join(__dirname, '..', 'electron', 'preload.cjs'),
    path.join(__dirname, '..', 'electron'),
  );
  return exposedBridge;
}

test('preload does not expose the bridge to an off-origin document', () => {
  assert.equal(runPreload('https://evil.example/'), null);
  assert.equal(runPreload('http://127.0.0.1:5174/', true), null);
});

test('preload exposes the bridge only to packaged/dev panel origins', () => {
  assert.equal(typeof runPreload('app://localhost/index.html').secureApi, 'function');
  assert.equal(typeof runPreload('http://127.0.0.1:5173/', true).secureApi, 'function');
});
