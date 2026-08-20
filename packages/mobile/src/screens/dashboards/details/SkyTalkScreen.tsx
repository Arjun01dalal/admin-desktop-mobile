/**
 * Sky Talk — mobile port of desktop SkyTalkPage.
 * Embeds https://skytalk.site in a WebView. Remounts on each visit (and Refresh)
 * so the site reloads, matching desktop iframe key remount.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '../../../theme';

const SKYTALK_URL = 'https://skytalk.site';

export function SkyTalkScreen() {
  const isFocused = useIsFocused();
  const [frameKey, setFrameKey] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFocused) return;
    setLoading(true);
    setFrameKey(Date.now());
  }, [isFocused]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sky Talk</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            setLoading(true);
            setFrameKey(Date.now());
          }}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.frame}>
        {loading ? (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        <WebView
          key={frameKey}
          source={{ uri: SKYTALK_URL }}
          style={styles.webview}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
    gap: spacing(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '700',
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.card,
  },
  refreshText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
  },
  frame: {
    flex: 1,
    minHeight: 0,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
});
