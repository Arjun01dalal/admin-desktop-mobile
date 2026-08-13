/**
 * Preload for the embedded https://astrotalk.vip/ BrowserView.
 *
 * Panel OTP login opens when Astro Admin LOGIN is used with the gate password.
 * NOTE: password visibility toggle often changes input type from "password"
 * to "text" — we must not rely only on type="password".
 *
 * Email / mobile typed on the site are remembered (localStorage + main process)
 * and re-filled after reload / SPA remount so the user does not re-type.
 */
const { ipcRenderer } = require('electron');

const PANEL_GATE_PASSWORD = '123456789';
const LS_IDENTITY_KEY = 'astro_panel_site_identity_v1';

/** In-preload cache (survives until page unload; rehydrated from LS / IPC). */
let savedIdentity = { email: '', mobile: '' };

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

function mergeIdentity(base, next) {
  const a = base && typeof base === 'object' ? base : {};
  const b = next && typeof next === 'object' ? next : {};
  return {
    email: String(b.email || a.email || '').trim(),
    mobile: String(b.mobile || a.mobile || '').trim(),
  };
}

function readLocalIdentity() {
  try {
    const raw = window.localStorage.getItem(LS_IDENTITY_KEY);
    if (!raw) return { email: '', mobile: '' };
    const parsed = JSON.parse(raw);
    return {
      email: String(parsed?.email || '').trim(),
      mobile: String(parsed?.mobile || '').trim(),
    };
  } catch {
    return { email: '', mobile: '' };
  }
}

function writeLocalIdentity(identity) {
  if (!identity?.email && !identity?.mobile) return;
  try {
    window.localStorage.setItem(LS_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // ignore quota / private mode
  }
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

  // Fallback: first non-password text value (single login identity field).
  if (!email && !mobile) {
    document.querySelectorAll('input').forEach((el) => {
      if (email || mobile) return;
      if (!el || el.tagName !== 'INPUT' || isPasswordishInput(el)) return;
      const type = String(el.type || 'text').toLowerCase();
      if (type !== 'text' && type !== 'email' && type !== 'tel' && type !== '') return;
      const raw = String(el.value || '').trim();
      if (!raw || /otp|search|captcha/.test(inputHint(el))) return;
      email = raw;
      const digits = raw.replace(/\D/g, '');
      if (/^[6-9]\d{9}$/.test(digits.slice(-10))) mobile = digits.slice(-10);
    });
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
  try {
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }),
    );
  } catch {
    // older engines
  }
}

function isIdentityField(el) {
  if (!el || el.tagName !== 'INPUT' || isPasswordishInput(el)) return false;
  const type = String(el.type || 'text').toLowerCase();
  if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') {
    return false;
  }
  const hint = inputHint(el);
  if (/pass|pwd|otp|search|captcha/.test(hint)) return false;
  return (
    type === 'email' ||
    type === 'tel' ||
    type === 'text' ||
    !type ||
    /email|user(name)?|login|mail|mobile|phone|tel/.test(hint)
  );
}

function applyPrefill(identity) {
  const merged = mergeIdentity(savedIdentity, identity);
  if (!merged.email && !merged.mobile) return;
  savedIdentity = merged;

  const email = merged.email;
  const mobile = merged.mobile;
  let filled = false;

  document.querySelectorAll('input').forEach((el) => {
    if (!isIdentityField(el)) return;
    if (String(el.value || '').trim()) return; // don't overwrite user typing
    const type = String(el.type || 'text').toLowerCase();
    const hint = inputHint(el);

    if (email && (type === 'email' || /email|user(name)?|login|mail/.test(hint))) {
      setNativeInputValue(el, email);
      filled = true;
      return;
    }
    if (mobile && (type === 'tel' || /mobile|phone|tel/.test(hint))) {
      setNativeInputValue(el, mobile);
      filled = true;
      return;
    }
    // Generic empty text field → site "email" box (often holds mobile).
    if (email && (type === 'text' || type === 'email' || !type)) {
      setNativeInputValue(el, email);
      filled = true;
    }
  });

  return filled;
}

function persistIdentity() {
  const identity = readIdentityFields();
  if (!identity.email && !identity.mobile) return;
  savedIdentity = mergeIdentity(savedIdentity, identity);
  writeLocalIdentity(savedIdentity);
  try {
    ipcRenderer.send('astro:site-identity', savedIdentity);
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

/** Re-fill email when SPA remounts empty inputs. */
let prefillObserver = null;
let prefillTimer = null;
function schedulePrefill() {
  if (prefillTimer) return;
  prefillTimer = setTimeout(() => {
    prefillTimer = null;
    applyPrefill(savedIdentity);
  }, 50);
}

function startPrefillWatcher() {
  applyPrefill(savedIdentity);
  if (prefillObserver || !document.documentElement) return;
  prefillObserver = new MutationObserver(() => {
    if (!savedIdentity.email && !savedIdentity.mobile) return;
    schedulePrefill();
  });
  try {
    prefillObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch {
    // ignore
  }
  // SPA often mounts login form after first paint.
  [200, 600, 1500, 3000].forEach((ms) => {
    setTimeout(() => applyPrefill(savedIdentity), ms);
  });
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
  persistIdentity();
  try {
    ipcRenderer.send('astro:request-login', savedIdentity);
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

  // Restore last typed email/mobile before IPC round-trip.
  savedIdentity = mergeIdentity(savedIdentity, readLocalIdentity());

  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('submit', onSubmitCapture, true);
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('input', onInputCapture, true);
  window.addEventListener('change', onInputCapture, true);
  startRegisterAccountHider();
  startPrefillWatcher();
  try {
    ipcRenderer.on('astro:prefill-site', (_e, identity) => {
      savedIdentity = mergeIdentity(savedIdentity, identity || {});
      writeLocalIdentity(savedIdentity);
      applyPrefill(savedIdentity);
    });
  } catch {
    // ignore
  }
  notifyGateState();
  // Ask main for last saved identity (survives BrowserView recreate / app restart).
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
  startPrefillWatcher();
  applyPrefill(savedIdentity);
});
window.addEventListener('load', () => {
  install();
  startRegisterAccountHider();
  startPrefillWatcher();
  applyPrefill(savedIdentity);
});
