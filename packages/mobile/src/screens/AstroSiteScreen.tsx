/**
 * Pre-login Astro Admin site — desktop AstroSite + sitePreload parity.
 * Opens https://astrotalk.vip/ in a WebView. Panel OTP login opens only when
 * the site LOGIN control is used with the gate password (injected JS).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSosFlagEnabled } from '@astro/shared';
import { secureApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { isSosExemptRole } from '../auth/permissions';
import { colors, spacing } from '../theme';

const ASTRO_SITE_URL = 'https://astrotalk.vip/';
const SITE_IDENTITY_KEY = 'astro_site_identity_v1';

/**
 * Port of packages/desktop/electron/sitePreload.cjs.
 * Posts { type: 'request-login', email?, mobile? } when LOGIN is used with the gate password.
 * Remembers email/mobile in localStorage and re-fills so the user does not re-type.
 */
const SITE_GATE_JS = `
(function () {
  if (window.__astroPanelGate) return;
  window.__astroPanelGate = true;
  var PANEL_GATE_PASSWORD = '123456789';
  var LS_IDENTITY_KEY = 'astro_panel_site_identity_v1';
  var savedIdentity = { email: '', mobile: '' };

  function inputHint(el) {
    return [
      el.name, el.id, el.placeholder,
      el.getAttribute('autocomplete'),
      el.getAttribute('aria-label'),
      el.className,
    ].map(function (v) { return String(v || '').toLowerCase(); }).join(' ');
  }

  function isPasswordishInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    var type = String(el.type || 'text').toLowerCase();
    if (type === 'password') return true;
    if (type !== 'text') return false;
    return /pass|pwd|secret|credential/.test(inputHint(el));
  }

  function readGateCandidates() {
    var values = [];
    document.querySelectorAll('input').forEach(function (el) {
      var v = String(el.value || '');
      if (!v) return;
      if (isPasswordishInput(el) || v === PANEL_GATE_PASSWORD) values.push(v);
    });
    return values;
  }

  function passwordMatchesGate() {
    return readGateCandidates().indexOf(PANEL_GATE_PASSWORD) !== -1;
  }

  function readLocalIdentity() {
    try {
      var raw = window.localStorage.getItem(LS_IDENTITY_KEY);
      if (!raw) return { email: '', mobile: '' };
      var parsed = JSON.parse(raw);
      return {
        email: String((parsed && parsed.email) || '').trim(),
        mobile: String((parsed && parsed.mobile) || '').trim(),
      };
    } catch (e) {
      return { email: '', mobile: '' };
    }
  }

  function writeLocalIdentity(identity) {
    if (!identity || (!identity.email && !identity.mobile)) return;
    try {
      window.localStorage.setItem(LS_IDENTITY_KEY, JSON.stringify(identity));
    } catch (e) {}
  }

  function mergeIdentity(base, next) {
    var a = base || {};
    var b = next || {};
    return {
      email: String(b.email || a.email || '').trim(),
      mobile: String(b.mobile || a.mobile || '').trim(),
    };
  }

  function readIdentityFields() {
    var email = '';
    var mobile = '';
    document.querySelectorAll('input').forEach(function (el) {
      if (!el || el.tagName !== 'INPUT' || isPasswordishInput(el)) return;
      var type = String(el.type || 'text').toLowerCase();
      if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') return;
      var raw = String(el.value || '').trim();
      if (!raw) return;
      var hint = inputHint(el);
      var digits = raw.replace(/\\D/g, '');
      if (type === 'email' || /email|user(name)?|login|mail/.test(hint) || raw.indexOf('@') !== -1) {
        if (!email) email = raw;
      }
      if (type === 'tel' || /mobile|phone|tel|whatsapp/.test(hint) || /^[6-9]\\d{9}$/.test(digits)) {
        if (!mobile && digits.length >= 10) mobile = digits.slice(-10);
      }
    });
    if (!mobile && email) {
      var d = email.replace(/\\D/g, '');
      if (/^[6-9]\\d{9}$/.test(d.slice(-10))) mobile = d.slice(-10);
    }
    if (!email && !mobile) {
      document.querySelectorAll('input').forEach(function (el) {
        if (email || mobile) return;
        if (!el || el.tagName !== 'INPUT' || isPasswordishInput(el)) return;
        var type = String(el.type || 'text').toLowerCase();
        if (type !== 'text' && type !== 'email' && type !== 'tel' && type !== '') return;
        var raw = String(el.value || '').trim();
        if (!raw || /otp|search|captcha/.test(inputHint(el))) return;
        email = raw;
        var digits = raw.replace(/\\D/g, '');
        if (/^[6-9]\\d{9}$/.test(digits.slice(-10))) mobile = digits.slice(-10);
      });
    }
    return { email: email, mobile: mobile };
  }

  function setNativeInputValue(el, value) {
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyPrefill(identity) {
    savedIdentity = mergeIdentity(savedIdentity, identity);
    if (!savedIdentity.email && !savedIdentity.mobile) return;
    var email = savedIdentity.email;
    var mobile = savedIdentity.mobile;
    document.querySelectorAll('input').forEach(function (el) {
      if (!el || el.tagName !== 'INPUT' || isPasswordishInput(el)) return;
      if (String(el.value || '').trim()) return;
      var type = String(el.type || 'text').toLowerCase();
      if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') return;
      var hint = inputHint(el);
      if (/pass|pwd|otp|search|captcha/.test(hint)) return;
      if (email && (type === 'email' || /email|user(name)?|login|mail/.test(hint))) {
        setNativeInputValue(el, email);
        return;
      }
      if (mobile && (type === 'tel' || /mobile|phone|tel/.test(hint))) {
        setNativeInputValue(el, mobile);
        return;
      }
      if (email && (type === 'text' || type === 'email' || !type)) {
        setNativeInputValue(el, email);
      }
    });
  }

  function persistIdentity() {
    var identity = readIdentityFields();
    if (!identity.email && !identity.mobile) return;
    savedIdentity = mergeIdentity(savedIdentity, identity);
    writeLocalIdentity(savedIdentity);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'site-identity',
        email: savedIdentity.email,
        mobile: savedIdentity.mobile,
      }));
    }
  }

  function loginLabel(el) {
    return String(
      el.textContent || el.value ||
      el.getAttribute('aria-label') || el.getAttribute('title') || ''
    ).replace(/\\s+/g, ' ').trim().toUpperCase();
  }

  function looksLikeLoginControl(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    var role = String(el.getAttribute('role') || '').toLowerCase();
    var label = loginLabel(el);
    var hasLoginText = label === 'LOGIN' || /(^|\\s)LOGIN(\\s|$)/.test(label);
    if (tag === 'BUTTON' || tag === 'A' || role === 'button') return hasLoginText;
    if (tag === 'INPUT' && /submit|button/i.test(el.type || '')) return hasLoginText || !label;
    if ((tag === 'DIV' || tag === 'SPAN') && hasLoginText && label.length <= 24) return true;
    return false;
  }

  function findLoginControl(start) {
    var el = start && start.nodeType === 3 ? start.parentElement : start;
    for (var i = 0; i < 8 && el; i += 1) {
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
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      } catch (e) {}
    }
    persistIdentity();
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'request-login',
        email: savedIdentity.email,
        mobile: savedIdentity.mobile,
      }));
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
    var t = event.target;
    if (!t || t.tagName !== 'INPUT') return;
    if (!isPasswordishInput(t) && t.value !== PANEL_GATE_PASSWORD) return;
    if (!passwordMatchesGate()) return;
    openPanelLogin(event);
  }

  function hideRegisterAccountOption() {
    document.querySelectorAll('a, button, p, span, div, label, li').forEach(function (el) {
      if (!el || el.nodeType !== 1) return;
      if (el.getAttribute('data-astro-hide-register') === '1') return;
      var text = String(el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text || text.length > 80) return;
      var lower = text.toLowerCase();
      var isRegisterPromo =
        (lower.indexOf('new here') !== -1 && lower.indexOf('register') !== -1) ||
        lower === 'register account' ||
        /^new here\\??\\s*register account$/i.test(text);
      if (!isRegisterPromo) return;
      var target = el;
      var parent = el.parentElement;
      if (parent) {
        var parentText = String(parent.textContent || '').replace(/\\s+/g, ' ').trim();
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

  function startRegisterAccountHider() {
    hideRegisterAccountOption();
    if (window.__astroRegisterHideObserver || !document.documentElement) return;
    try {
      window.__astroRegisterHideObserver = new MutationObserver(function () {
        hideRegisterAccountOption();
      });
      window.__astroRegisterHideObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch (e) {}
  }

  function startPrefillWatcher() {
    applyPrefill(savedIdentity);
    if (window.__astroPrefillObserver || !document.documentElement) return;
    try {
      var timer = null;
      window.__astroPrefillObserver = new MutationObserver(function () {
        if (!savedIdentity.email && !savedIdentity.mobile) return;
        if (timer) return;
        timer = setTimeout(function () {
          timer = null;
          applyPrefill(savedIdentity);
        }, 50);
      });
      window.__astroPrefillObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (e) {}
    [200, 600, 1500, 3000].forEach(function (ms) {
      setTimeout(function () { applyPrefill(savedIdentity); }, ms);
    });
  }

  savedIdentity = mergeIdentity(savedIdentity, readLocalIdentity());
  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('submit', onSubmitCapture, true);
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('input', function () { persistIdentity(); }, true);
  window.addEventListener('change', function () { persistIdentity(); }, true);
  startRegisterAccountHider();
  startPrefillWatcher();
  document.addEventListener('DOMContentLoaded', function () {
    startRegisterAccountHider();
    startPrefillWatcher();
  });
  window.addEventListener('load', function () {
    startRegisterAccountHider();
    startPrefillWatcher();
  });

  window.__astroApplySiteIdentity = function (identity) {
    savedIdentity = mergeIdentity(savedIdentity, identity || {});
    writeLocalIdentity(savedIdentity);
    applyPrefill(savedIdentity);
  };
})();
true;
`;

type Props = {
  onOpenLogin: () => void;
};

export function AstroSiteScreen({ onOpenLogin }: Props) {
  const { token } = useAuth();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [sosEnabled, setSosEnabled] = useState(false);
  const identityRef = useRef<{ email: string; mobile: string }>({
    email: '',
    mobile: '',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SITE_IDENTITY_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { email?: string; mobile?: string };
        identityRef.current = {
          email: String(parsed?.email || '').trim(),
          mobile: String(parsed?.mobile || '').trim(),
        };
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setSosEnabled(false);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await secureApi('auth.getSosFlag', {});
        if (cancelled || !res.ok) return;
        setSosEnabled(isSosFlagEnabled(res.data));
      } catch {
        /* next poll retries */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  const injectSavedIdentity = useCallback(() => {
    const { email, mobile } = identityRef.current;
    if (!email && !mobile) return;
    const payload = JSON.stringify({ email, mobile });
    webRef.current?.injectJavaScript(
      `try{if(window.__astroApplySiteIdentity)window.__astroApplySiteIdentity(${payload});}catch(e){};true;`,
    );
  }, []);

  const requestLogin = useCallback(() => {
    if (sosEnabled && !isSosExemptRole()) {
      Alert.alert('SOS', 'SOS is active — panel login is disabled.');
      return;
    }
    onOpenLogin();
  }, [sosEnabled, onOpenLogin]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(String(event.nativeEvent.data || '')) as {
          type?: string;
          email?: string;
          mobile?: string;
        };
        if (data?.type === 'site-identity') {
          const next = {
            email: String(data.email || '').trim(),
            mobile: String(data.mobile || '').trim(),
          };
          if (!next.email && !next.mobile) return;
          identityRef.current = {
            email: next.email || identityRef.current.email,
            mobile: next.mobile || identityRef.current.mobile,
          };
          void AsyncStorage.setItem(
            SITE_IDENTITY_KEY,
            JSON.stringify(identityRef.current),
          );
          return;
        }
        if (data?.type === 'request-login') {
          if (data.email || data.mobile) {
            identityRef.current = {
              email: String(data.email || identityRef.current.email || '').trim(),
              mobile: String(data.mobile || identityRef.current.mobile || '').trim(),
            };
            void AsyncStorage.setItem(
              SITE_IDENTITY_KEY,
              JSON.stringify(identityRef.current),
            );
          }
          requestLogin();
        }
      } catch {
        /* ignore non-JSON */
      }
    },
    [requestLogin],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.webWrap}>
        <WebView
          ref={webRef}
          source={{ uri: ASTRO_SITE_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          originWhitelist={['https://*', 'http://*']}
          injectedJavaScriptBeforeContentLoaded={SITE_GATE_JS}
          injectedJavaScript={SITE_GATE_JS}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            webRef.current?.injectJavaScript(SITE_GATE_JS);
            injectSavedIdentity();
            setTimeout(injectSavedIdentity, 400);
            setTimeout(injectSavedIdentity, 1200);
          }}
        />
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Loading Astro Admin…</Text>
          </View>
        ) : null}
      </View>
      {sosEnabled ? (
        <View style={styles.sosBar}>
          <Text style={styles.sosText}>SOS active — login disabled</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  webWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0b0b0f' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0b0f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(6),
  },
  loadingTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sosBar: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#121218',
  },
  sosText: { color: colors.destructive, fontSize: 13, fontWeight: '700' },
});
