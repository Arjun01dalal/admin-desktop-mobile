/**
 * Sky Talk CRM WebView with remount-on-activate (matches desktop iframe key).
 * Unmounts while inactive to free native memory.
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { SKYTALK_EMBED_URL } from '@astro/shared';
import { colors } from '../theme';

type Props = {
  /** When false, WebView is unmounted (paused). Remounts when becoming true. */
  active: boolean;
  /** Bump to force a remount while active (e.g. Refresh). */
  remountToken?: number;
  style?: StyleProp<ViewStyle>;
  webViewStyle?: StyleProp<ViewStyle>;
  pausedContent?: ReactNode;
};

export function SkyTalkEmbed({
  active,
  remountToken = 0,
  style,
  webViewStyle,
  pausedContent,
}: Props) {
  const [frameKey, setFrameKey] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setFrameKey(Date.now());
  }, [active, remountToken]);

  return (
    <View style={[styles.frame, style]}>
      {!active ? (
        <View style={styles.loader}>
          {pausedContent !== undefined ? (
            pausedContent
          ) : (
            <Text style={styles.pausedText}>Paused</Text>
          )}
        </View>
      ) : (
        <>
          {loading ? (
            <View style={styles.loader} pointerEvents="none">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
          <WebView
            key={frameKey}
            source={{ uri: SKYTALK_EMBED_URL }}
            style={[styles.webview, webViewStyle]}
            originWhitelist={['https://*', 'http://*']}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            onLoadEnd={() => setLoading(false)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pausedText: {
    color: colors.muted,
    textAlign: 'center',
  },
});
