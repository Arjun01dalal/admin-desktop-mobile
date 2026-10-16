/**
 * Sky Talk CRM WebView with remount-on-activate (matches desktop iframe key).
 * Unmounts while inactive to free native memory.
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SKYTALK_EMBED_URL } from '@astro/shared';
import { colors } from '../theme';
import { styles } from './SkyTalkEmbed.styles';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(null);
    setFrameKey(Date.now());
  }, [active, remountToken]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setFrameKey(Date.now());
  };

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
      ) : error ? (
        <View style={styles.loader}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
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
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent?.description || 'Failed to load Sky Talk');
            }}
            onHttpError={(e) => {
              const status = e.nativeEvent?.statusCode;
              if (status && status >= 400) {
                setLoading(false);
                setError(`Sky Talk failed to load (HTTP ${status})`);
              }
            }}
          />
        </>
      )}
    </View>
  );
}
