/**
 * Sky Talk — mobile port of desktop SkyTalkPage.
 * Embeds https://skytalk.site in a WebView. Remounts on each visit (and Refresh)
 * so the site reloads, matching desktop iframe key remount.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { colors} from '../../../theme';
import { styles } from './SkyTalkScreen.styles';

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

