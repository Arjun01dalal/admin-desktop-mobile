/**
 * Live TV / score viewer — port of desktop LiveStreamModal for React Native.
 * Renders the live-score and live-stream pages in WebViews (iframes on web).
 */
import React from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { styles } from './LiveStreamModal.styles';

type Props = {
  open: boolean;
  onClose: () => void;
  streamId: string;
};

function StreamFrame({ uri, title }: { uri: string; title: string }) {
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={uri}
        width="100%"
        height="100%"
        allow="autoplay; encrypted-media"
        allowFullScreen
        style={{ border: 'none' }}
        title={title}
      />
    );
  }
  return (
    <WebView
      source={{ uri }}
      style={styles.webview}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}

export function LiveStreamModal({ open, onClose, streamId }: Props) {
  const id = String(streamId || '').trim();
  const streamUrl = `https://aaa.aaryapaar.exchange/sports/exchange/live-stream/${id}`;
  const scoreUrl = `https://aaa.aaryapaar.exchange/sports/exchange/live-score/${id}`;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Live Match</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scoreBox}>
            {id ? <StreamFrame uri={scoreUrl} title="Live Score" /> : null}
          </View>
          <View style={styles.streamBox}>
            {id ? (
              <StreamFrame uri={streamUrl} title="Live Stream" />
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No stream available for this match.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

