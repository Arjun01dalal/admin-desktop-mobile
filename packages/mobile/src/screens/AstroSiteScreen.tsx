/**
 * Customer Astro site after password login — desktop showSite SSO parity.
 * Loads https://astrotalk.vip/#external_login=1&access_token=…
 * Intercepts myastroapp://login?logged_out=1 → native Astro login.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { buildAstroSiteSsoUrl } from '../api/astroSiteAuth';
import { isAllowedAstroSiteUrl } from '../security/astroSiteNavigation';
import { colors, spacing } from '../theme';
import { parseAstroDeepLink } from '../utils/astroDeepLink';

type Props = {
  accessToken: string;
  onBackToNativeLogin: () => void;
  onLogoutDeepLink: () => void;
};

export function AstroSiteScreen({ accessToken, onBackToNativeLogin, onLogoutDeepLink }: Props) {
  const [loading, setLoading] = useState(true);
  const uri = useMemo(() => buildAstroSiteSsoUrl(accessToken), [accessToken]);

  const handleDeepLinkUrl = useCallback(
    (url: string): boolean => {
      const payload = parseAstroDeepLink(url);
      if (!payload) return false;
      onLogoutDeepLink();
      return true;
    },
    [onLogoutDeepLink],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (req: ShouldStartLoadRequest) => {
      const url = String(req.url || '');
      if (handleDeepLinkUrl(url)) return false;
      return isAllowedAstroSiteUrl(url);
    },
    [handleDeepLinkUrl],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.frame}>
        {loading ? (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loaderText}>Loading Astro Admin…</Text>
          </View>
        ) : null}
        <WebView
          source={{ uri }}
          style={styles.webview}
          originWhitelist={[
            'https://astrotalk.vip',
            'https://www.astrotalk.vip',
            'myastroapp://login',
          ]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={(e) => {
            const target = String(e.nativeEvent.targetUrl || '');
            if (handleDeepLinkUrl(target)) return;
          }}
          onLoadEnd={() => setLoading(false)}
          onLoadStart={() => setLoading(true)}
        />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={onBackToNativeLogin} hitSlop={8}>
          <Text style={styles.backText}>← Back to Sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  frame: { flex: 1, backgroundColor: '#0b0b0f' },
  webview: { flex: 1, backgroundColor: '#0b0b0f' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    zIndex: 2,
    backgroundColor: '#0b0b0f',
  },
  loaderText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: {
    height: 52,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#121218',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
