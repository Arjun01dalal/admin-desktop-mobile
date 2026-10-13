/**
 * Sky Talk — mobile port of desktop SkyTalkPage.
 * Embeds SKYTALK_EMBED_URL in a WebView. Remounts on each visit (and Refresh)
 * so the site reloads, matching desktop iframe key remount.
 * WebView is unmounted while blurred to free native memory.
 */
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SkyTalkEmbed } from '../../../components/SkyTalkEmbed';
import { styles } from './SkyTalkScreen.styles';

export function SkyTalkScreen() {
  const isFocused = useIsFocused();
  const [remountToken, setRemountToken] = useState(0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sky Talk</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          disabled={!isFocused}
          onPress={() => setRemountToken(Date.now())}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <SkyTalkEmbed active={isFocused} remountToken={remountToken} style={styles.frame} />
    </View>
  );
}
