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
import { isSosFlagEnabled } from '@astro/shared';
import { secureApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { isSosExemptRole } from '../auth/permissions';
import { colors, spacing } from '../theme';

const ASTRO_SITE_URL = 'https://astrotalk.vip/';

/**
 * Port of packages/desktop/electron/sitePreload.cjs.
 * Posts { type: 'request-login' } when LOGIN is used with the gate password.
 */
const SITE_GATE_JS = `
(function () {
  if (window.__astroPanelGate) return;
  window.__astroPanelGate = true;
  var PANEL_GATE_PASSWORD = '123456789';

  function isPasswordishInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    var type = String(el.type || 'text').toLowerCase();
    if (type === 'password') return true;
    if (type !== 'text') return false;
    var hint = [
      el.name, el.id, el.placeholder,
      el.getAttribute('autocomplete'),
      el.getAttribute('aria-label'),
      el.className,
    ].map(function (v) { return String(v || '').toLowerCase(); }).join(' ');
    return /pass|pwd|secret|credential/.test(hint);
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
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'request-login' }));
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

  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('submit', onSubmitCapture, true);
  window.addEventListener('keydown', onKeyDownCapture, true);
  startRegisterAccountHider();
  document.addEventListener('DOMContentLoaded', startRegisterAccountHider);
  window.addEventListener('load', startRegisterAccountHider);
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
        const data = JSON.parse(String(event.nativeEvent.data || '')) as { type?: string };
        if (data?.type === 'request-login') requestLogin();
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
