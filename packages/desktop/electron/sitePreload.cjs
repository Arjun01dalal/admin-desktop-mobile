/**
 * Preload for the embedded https://astrotalk.vip/ BrowserView.
 *
 * Panel OTP login opens when Astro Admin LOGIN is used with the gate password.
 * NOTE: password visibility toggle often changes input type from "password"
 * to "text" — we must not rely only on type="password".
 *
 * Email / mobile typed on the site are remembered and re-filled after reload,
 * and forwarded to the panel OTP login as a mobile prefill when applicable.
 */
const { ipcRenderer } = require('electron');

const PANEL_GATE_PASSWORD = '123456789';

function inputHint(el) {
  return [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute('autocomplete'),
    el.getAttribute('aria-label'),
    el.className,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
}

function isPasswordishInput(el) {
  if (!el || el.tagName !== 'INPUT') return false;
  const type = String(el.type || 'text').toLowerCase();
  if (type === 'password') return true;
  // Visible password toggle → type="text"
  if (type !== 'text') return false;
  return /pass|pwd|secret|credential/.test(inputHint(el));
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

/** Non-password identity fields from the Astro site form. */
function readIdentityFields() {
  let email = '';
  let mobile = '';
  document.querySelectorAll('input').forEach((el) => {
    if (!el || el.tagName !== 'INPUT') return;
    if (isPasswordishInput(el)) return;
    const type = String(el.type || 'text').toLowerCase();
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') {
      return;
    }
    const raw = String(el.value || '').trim();
    if (!raw) return;
    const hint = inputHint(el);
    const digits = raw.replace(/\D/g, '');

    if (type === 'email' || /email|user(name)?|login|mail/.test(hint) || raw.includes('@')) {
      if (!email) email = raw;
    }
    if (
      type === 'tel' ||
      /mobile|phone|tel|whatsapp/.test(hint) ||
      /^[6-9]\d{9}$/.test(digits)
    ) {
      if (!mobile && digits.length >= 10) mobile = digits.slice(-10);
    }
  });

  // Site often uses a single "email" box that actually holds a mobile number.
  if (!mobile && email) {
    const digits = email.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits.slice(-10))) {
      mobile = digits.slice(-10);
    }
  }

  return { email, mobile };
}

function setNativeInputValue(el, value) {
  const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
  const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyPrefill(identity) {
  if (!identity || typeof identity !== 'object') return;
  const email = String(identity.email || '').trim();
  const mobile = String(identity.mobile || '').trim();
  if (!email && !mobile) return;

  document.querySelectorAll('input').forEach((el) => {
    if (!el || el.tagName !== 'INPUT') return;
    if (isPasswordishInput(el)) return;
    if (String(el.value || '').trim()) return; // don't overwrite user typing
    const type = String(el.type || 'text').toLowerCase();
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') {
      return;
    }
    const hint = inputHint(el);
    if (email && (type === 'email' || /email|user(name)?|login|mail/.test(hint))) {
      setNativeInputValue(el, email);
      return;
    }
    if (mobile && (type === 'tel' || /mobile|phone|tel/.test(hint))) {
      setNativeInputValue(el, mobile);
      return;
    }
    // Generic first empty text field → prefer email (site "email" box).
    if (email && (type === 'text' || type === 'email' || !type)) {
      if (/pass|pwd|otp|search/.test(hint)) return;
      setNativeInputValue(el, email);
    }
  });
}

function persistIdentity() {
  const identity = readIdentityFields();
  if (!identity.email && !identity.mobile) return;
  try {
    ipcRenderer.send('astro:site-identity', identity);
  } catch {
    // ignore
  }
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

/** Hide site "New Here? Register Account" promo (panel users must not self-register). */
function hideRegisterAccountOption() {
  const nodes = document.querySelectorAll('a, button, p, span, div, label, li');
  nodes.forEach((el) => {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute('data-astro-hide-register') === '1') return;
    const text = String(el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length > 80) return;
    const lower = text.toLowerCase();
    const isRegisterPromo =
      (lower.includes('new here') && lower.includes('register')) ||
      lower === 'register account' ||
      /^new here\??\s*register account$/i.test(text);
    if (!isRegisterPromo) return;

    let target = el;
    const parent = el.parentElement;
    if (parent) {
      const parentText = String(parent.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        parentText.length <= 80 &&
        /new here/i.test(parentText) &&
        /register/i.test(parentText)
      ) {
        target = parent;
      }
    }
    target.style.setProperty('display', 'none', 'important');
    target.setAttribute('aria-hidden', 'true');
    target.setAttribute('data-astro-hide-register', '1');
  });
}

let registerHideObserver = null;
function startRegisterAccountHider() {
  hideRegisterAccountOption();
  if (registerHideObserver || !document.documentElement) return;
  registerHideObserver = new MutationObserver(() => {
    hideRegisterAccountOption();
  });
  try {
    registerHideObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  } catch {
    // ignore
  }
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
  const identity = readIdentityFields();
  persistIdentity();
  try {
    ipcRenderer.send('astro:request-login', identity);
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
  persistIdentity();
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('submit', onSubmitCapture, true);
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('input', onInputCapture, true);
  window.addEventListener('change', onInputCapture, true);
  startRegisterAccountHider();
  try {
    ipcRenderer.on('astro:prefill-site', (_e, identity) => {
      applyPrefill(identity || {});
    });
  } catch {
    // ignore
  }
  notifyGateState();
  // Ask main for last saved identity (survives BrowserView recreate).
  try {
    ipcRenderer.send('astro:site-identity-request');
  } catch {
    // ignore
  }
}

install();
document.addEventListener('DOMContentLoaded', () => {
  install();
  startRegisterAccountHider();
});
window.addEventListener('load', () => {
  install();
  startRegisterAccountHider();
});
