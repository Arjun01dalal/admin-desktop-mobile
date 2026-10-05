/**
 * WhatsApp inbox — native mobile port of desktop WhatsappPage.
 * Chat list and the open thread load separately (admin-panel-domains WhatsappView).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  WHATSAPP_NEAR_BOTTOM_PX,
  WHATSAPP_NEAR_TOP_PX,
  buildExotelWhatsappSend,
  formatListTime,
  getInitials,
  getWhatsappMessageId,
  isIncoming,
  presentMessage,
  toApiMobile,
} from '@astro/shared/whatsappInbox';
import { colors, spacing} from '../../../theme';
import { secureApi } from '../../../api/client';
import { useWhatsappInbox } from './whatsapp/useWhatsappInbox';
import { styles } from './WhatsappScreen.styles';

function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{getInitials(name)}</Text>
    </View>
  );
}

export function WhatsappScreen() {
  const inbox = useWhatsappInbox();
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<ScrollView>(null);
  const { selectedUser: openChat, activeMessages, stickToBottomRef } = inbox;

  useEffect(() => {
    if (!openChat || !stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      messagesRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [openChat, activeMessages.length, stickToBottomRef]);
  const contentHeightRef = useRef(0);
  const pendingPrependHeightRef = useRef<number | null>(null);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to send an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.75,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert('Image error', 'Unable to read the selected image.');
      return;
    }
    const mimeType = asset.mimeType || 'image/jpeg';
    setImage(`data:${mimeType};base64,${asset.base64}`);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = message.trim();
    const recipient =
      inbox.selectedMobileRef.current ||
      (inbox.selectedUser ? toApiMobile(inbox.selectedUser) : '');
    if ((!text && !image) || !recipient || !inbox.selectedUser || sending) return;

    const plan = buildExotelWhatsappSend({ recipient, text, image });
    if (!plan.ok) {
      Alert.alert('Send failed', plan.error);
      return;
    }

    setSending(true);
    try {
      const res = await secureApi<unknown>('whatsapp.sendExotel', { ...plan.body });
      if (!res.ok) {
        Alert.alert('Send failed', res.message || 'Failed to send message');
        return;
      }
      inbox.stickToBottomRef.current = true;
      inbox.appendOptimisticMessage(plan.optimistic);
      setMessage('');
      setImage(null);
      requestAnimationFrame(() => messagesRef.current?.scrollToEnd({ animated: true }));
    } finally {
      setSending(false);
    }
  }, [image, inbox, message, sending]);

  const onChatListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (nearBottom) inbox.loadMoreChats();
  };

  const onMessagesScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    inbox.stickToBottomRef.current = distanceFromBottom < WHATSAPP_NEAR_BOTTOM_PX;
    const nearTop = contentOffset.y <= WHATSAPP_NEAR_TOP_PX;
    if (nearTop !== inbox.showLoadPrevious) inbox.setShowLoadPrevious(nearTop);
  };

  const onMessagesContentSizeChange = (_width: number, height: number) => {
    const previous = pendingPrependHeightRef.current;
    contentHeightRef.current = height;
    if (previous != null) {
      pendingPrependHeightRef.current = null;
      messagesRef.current?.scrollTo({
        y: Math.max(0, height - previous),
        animated: false,
      });
      return;
    }
    if (inbox.stickToBottomRef.current) {
      messagesRef.current?.scrollToEnd({ animated: false });
    }
  };

  const handleLoadPrevious = () => {
    if (!inbox.hasMore || inbox.loadingOlder) return;
    pendingPrependHeightRef.current = contentHeightRef.current;
    void inbox.loadOlder().then((grew) => {
      if (!grew) pendingPrependHeightRef.current = null;
    });
  };

  if (!inbox.selectedUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Whatsapp</Text>
            <Text style={styles.sub}>{inbox.chatList.length} chats</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => void inbox.refreshChats()}
            disabled={inbox.loadingList}
          >
            {inbox.loadingList ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.refreshText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={inbox.search}
          onChangeText={inbox.setSearch}
          placeholder="Search chats, phone or message…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {inbox.listError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{inbox.listError}</Text>
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
          onScroll={onChatListScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={inbox.loadingList}
              onRefresh={() => void inbox.refreshChats()}
              tintColor={colors.primary}
            />
          }
        >
          {inbox.chatListLoaded && inbox.filteredChats.length === 0 ? (
            <Text style={styles.emptyText}>No chats found</Text>
          ) : null}
          {!inbox.chatListLoaded && inbox.filteredChats.length === 0 ? (
            <Text style={styles.emptyText}>Loading chats…</Text>
          ) : null}
          {inbox.filteredChats.map((chat) => (
            <TouchableOpacity
              key={chat.phone}
              style={styles.chatCard}
              activeOpacity={0.75}
              onPress={() => inbox.selectChat(chat.phone)}
            >
              <Avatar name={chat.profileName} />
              <View style={styles.chatBody}>
                <View style={styles.chatTopRow}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {chat.profileName}
                  </Text>
                  <Text style={styles.chatTime}>{formatListTime(chat.timestamp)}</Text>
                </View>
                <Text style={styles.chatPhone} numberOfLines={1}>
                  {chat.phone}
                </Text>
                <Text style={styles.chatPreview} numberOfLines={1}>
                  {chat.preview || '—'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {inbox.loadingMore ? <Text style={styles.emptyText}>Loading more...</Text> : null}
        </ScrollView>
      </View>
    );
  }

  const showLoadPrevious =
    inbox.hasMore && (inbox.showLoadPrevious || inbox.loadingOlder) && inbox.activeMessages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <View style={styles.conversationHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            inbox.backToList();
            setImage(null);
            setMessage('');
          }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Avatar name={inbox.activeProfileName} />
        <View style={styles.conversationTitle}>
          <Text style={styles.chatName} numberOfLines={1}>
            {inbox.activeProfileName}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void Clipboard.setStringAsync(inbox.selectedUser || '');
              Alert.alert('Copied', 'Phone number copied');
            }}
          >
            <Text style={styles.activePhone} numberOfLines={1}>
              {inbox.selectedUser} · Copy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.messagesWrap}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={messagesRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onScroll={onMessagesScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onMessagesContentSizeChange}
      >
        {inbox.messagesLoading && inbox.activeMessages.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing(8) }} />
        ) : null}
        {!inbox.messagesLoading && inbox.activeMessages.length === 0 ? (
          <Text style={styles.emptyText}>No messages in this chat.</Text>
        ) : null}
        {inbox.activeMessages.map((item, index) => {
          const incoming = isIncoming(item);
          const view = presentMessage(item);
          return (
            <View
              key={getWhatsappMessageId(item, index)}
              style={[
                styles.messageRow,
                incoming ? styles.messageRowIncoming : styles.messageRowOutgoing,
              ]}
            >
              <View
                style={[styles.bubble, incoming ? styles.bubbleIncoming : styles.bubbleOutgoing]}
              >
                {view.kind === 'text' ? <Text style={styles.messageText}>{view.text}</Text> : null}
                {view.kind === 'image' && view.src ? (
                  <Image source={{ uri: view.src }} style={styles.messageImage} resizeMode="cover" />
                ) : null}
                {view.kind === 'image' && view.caption ? (
                  <Text style={styles.messageText}>{view.caption}</Text>
                ) : null}
                {view.kind === 'audio' ? (
                  <TouchableOpacity
                    disabled={!view.src}
                    onPress={() => {
                      if (view.src) void Linking.openURL(view.src);
                    }}
                  >
                    <Text style={styles.messageText}>🎵 Audio</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.messageTime}>{formatListTime(item.timestamp)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {showLoadPrevious ? (
        <View style={styles.loadOlderWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.loadOlderBtn}
            disabled={inbox.loadingOlder}
            onPress={handleLoadPrevious}
          >
            <Text style={styles.loadOlderText}>
              {inbox.loadingOlder ? 'Loading...' : 'Load previous'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </View>

      {image ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: image }} style={styles.previewImage} />
          <TouchableOpacity onPress={() => setImage(null)}>
            <Text style={styles.removeImage}>Remove image</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => void pickImage()}>
          <Text style={styles.attachText}>＋</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (sending || (!message.trim() && !image)) && styles.sendBtnDisabled,
          ]}
          disabled={sending || (!message.trim() && !image)}
          onPress={() => void sendMessage()}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

