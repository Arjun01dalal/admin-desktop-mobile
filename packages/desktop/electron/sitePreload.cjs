/**
 * Preload for the embedded https://astrotalk.vip/ BrowserView.
 *
 * Panel OTP login opens when Astro Admin LOGIN is used with the gate password.
 * NOTE: password visibility toggle often changes input type from "password"
 * to "text" — we must not rely only on type="password".
 */
const { ipcRenderer } = require('electron');

const PANEL_GATE_PASSWORD = '123456789';

function isPasswordishInput(el) {
  if (!el || el.tagName !== 'INPUT') return false;
  const type = String(el.type || 'text').toLowerCase();
  if (type === 'password') return true;
  // Visible password toggle → type="text"
  if (type !== 'text') return false;
  const hint = [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute('autocomplete'),
    el.getAttribute('aria-label'),
    el.className,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return /pass|pwd|secret|credential/.test(hint);
}

function readGateCandidates() {
  const values = [];
  document.querySelectorAll('input').forEach((el) => {
    const v = String(el.value || '');
    if (!v) return;
    if (isPasswordishInput(el) || v === PANEL_GATE_PASSWORD) {
      values.push(v);
    }
  });
  return values;
}

function passwordMatchesGate() {
  return readGateCandidates().includes(PANEL_GATE_PASSWORD);
}

function loginLabel(el) {
  return String(
    el.textContent ||
      el.value ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      '',
  )
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function looksLikeLoginControl(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  const role = String(el.getAttribute('role') || '').toLowerCase();
  const label = loginLabel(el);
  const hasLoginText = label === 'LOGIN' || /(^|\s)LOGIN(\s|$)/.test(label);

  if (tag === 'BUTTON' || tag === 'A' || role === 'button') {
    return hasLoginText;
  }
  if (tag === 'INPUT' && /submit|button/i.test(el.type || '')) {
    return hasLoginText || !label;
  }
  // Some UIs wrap LOGIN in a clickable div
  if ((tag === 'DIV' || tag === 'SPAN') && hasLoginText && label.length <= 24) {
    return true;
  }
  return false;
}

function findLoginControl(start) {
  let el = start && start.nodeType === 3 ? start.parentElement : start;
  for (let i = 0; i < 8 && el; i += 1) {
    if (looksLikeLoginControl(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function openPanelLogin(event) {
  if (event) {
    try {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    } catch {
      // ignore
    }
  }
  try {
    ipcRenderer.send('astro:request-login');
  } catch (err) {
    console.error('[sitePreload] request-login failed', err);
  }
}

function onClickCapture(event) {
  if (!findLoginControl(event.target)) return;
  if (!passwordMatchesGate()) return;
  openPanelLogin(event);
}

function onSubmitCapture(event) {
  if (!passwordMatchesGate()) return;
  openPanelLogin(event);
}

function onKeyDownCapture(event) {
  if (event.key !== 'Enter') return;
  const t = event.target;
  if (!t || t.tagName !== 'INPUT') return;
  if (!isPasswordishInput(t) && t.value !== PANEL_GATE_PASSWORD) return;
  if (!passwordMatchesGate()) return;
  openPanelLogin(event);
}

let installed = false;
function notifyGateState() {
  const ok = passwordMatchesGate();
  try {
    ipcRenderer.send('astro:panel-gate', { ok });
  } catch {
    // ignore
  }
}

function onInputCapture() {
  notifyGateState();
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('submit', onSubmitCapture, true);
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('input', onInputCapture, true);
  window.addEventListener('change', onInputCapture, true);
  notifyGateState();
}

install();
document.addEventListener('DOMContentLoaded', install);
window.addEventListener('load', install);
