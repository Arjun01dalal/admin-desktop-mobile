/**
 * WhatsApp inbox — native mobile port of desktop WhatsappPage.
 * Loads Exotel callbacks, groups conversations by phone, polls while the app
 * is active, and supports text/image replies.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';

type CallbackType = 'incoming_message' | 'outgoing_message' | 'dlr';

type WhatsappContent =
  | {
      type: 'text';
      text: { body?: string };
      profile_name?: string;
    }
  | {
      type: 'image';
      image: { url?: string; caption?: string; s3_url?: string };
      profile_name?: string;
    };

type WhatsappMessage = {
  callback_type?: CallbackType | string;
  from?: string;
  to?: string;
  timestamp?: string;
  profile_name?: string;
  description?: string;
  content?: WhatsappContent;
};

type GroupedChats = Record<string, WhatsappMessage[]>;

type ChatSummary = {
  phone: string;
  profileName: string;
  preview: string;
  timestamp: string;
};

const POLL_INTERVAL_MS = 4000;

function unpackMessages(data: unknown): WhatsappMessage[] {
  if (Array.isArray(data)) return data as WhatsappMessage[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of ['payload', 'data', 'items', 'rows', 'result']) {
    if (Array.isArray(obj[key])) return obj[key] as WhatsappMessage[];
  }
  return [];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

function formatWhatsappTo(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function groupChats(messages: WhatsappMessage[]): GroupedChats {
  const grouped: GroupedChats = {};
  for (const message of messages) {
    const raw =
      message.callback_type === 'incoming_message' ? message.from : message.to;
    if (!raw) continue;
    const phone = normalizePhone(raw);
    (grouped[phone] ||= []).push(message);
  }
  for (const chat of Object.values(grouped)) {
    chat.sort(
      (a, b) =>
        new Date(String(a.timestamp || '')).getTime() -
        new Date(String(b.timestamp || '')).getTime(),
    );
  }
  return grouped;
}

function getProfileName(messages: WhatsappMessage[], phone: string): string {
  const withName = [...messages]
    .reverse()
    .find((message) => message.profile_name || message.content?.profile_name);
  return (
    withName?.profile_name ||
    withName?.content?.profile_name ||
    phone
  );
}

function messagePreview(message: WhatsappMessage): string {
  if (message.content?.type === 'text') {
    return String(message.content.text.body || '');
  }
  if (message.content?.type === 'image') {
    const caption = String(message.content.image.caption || '').trim();
    return caption ? `📷 ${caption}` : '📷 Photo';
  }
  return String(message.description || '');
}

function buildSummaries(records: GroupedChats): ChatSummary[] {
  return Object.entries(records)
    .map(([phone, messages]) => {
      const visible = messages.filter((message) => message.callback_type !== 'dlr');
      const last = visible[visible.length - 1] || messages[messages.length - 1];
      if (!last) return null;
      return {
        phone,
        profileName: getProfileName(messages, phone),
        preview: messagePreview(last),
        timestamp: String(last.timestamp || ''),
      };
    })
    .filter((item): item is ChatSummary => item !== null)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || '?').slice(-2).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

export function WhatsappScreen() {
  const [records, setRecords] = useState<GroupedChats | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const messagesRef = useRef<ScrollView>(null);

  const fetchWhatsappData = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await secureApi<unknown>('whatsapp.getCallbacks', {});
      if (!res.ok) {
        if (!silent) setError(res.message || 'Failed to load chats');
        return;
      }
      setError(null);
      setRecords(groupChats(unpackMessages(res.data)));
    } finally {
      fetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWhatsappData();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void fetchWhatsappData(true);
    }, POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchWhatsappData(true);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [fetchWhatsappData]);

  const summaries = useMemo(
    () => (records ? buildSummaries(records) : []),
    [records],
  );

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summaries;
    return summaries.filter(
      (chat) =>
        chat.phone.toLowerCase().includes(query) ||
        chat.profileName.toLowerCase().includes(query) ||
        chat.preview.toLowerCase().includes(query),
    );
  }, [search, summaries]);

  const activeMessages = useMemo(() => {
    if (!selectedUser || !records) return [];
    return (records[normalizePhone(selectedUser)] || records[selectedUser] || []).filter(
      (item) => item.callback_type !== 'dlr',
    );
  }, [records, selectedUser]);

  const activeProfileName = useMemo(() => {
    if (!selectedUser || !records) return '';
    const messages = records[normalizePhone(selectedUser)] || records[selectedUser];
    return messages ? getProfileName(messages, selectedUser) : selectedUser;
  }, [records, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;
    requestAnimationFrame(() => messagesRef.current?.scrollToEnd({ animated: false }));
  }, [activeMessages.length, selectedUser]);

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
    if ((!text && !image) || !selectedUser || sending) return;
    setSending(true);
    try {
      const payload = image
        ? {
            to: formatWhatsappTo(selectedUser),
            type: 'image' as const,
            image,
            caption: text,
          }
        : {
            to: formatWhatsappTo(selectedUser),
            type: 'text' as const,
            text,
          };
      const res = await secureApi<unknown>('whatsapp.sendExotel', payload);
      if (!res.ok) {
        Alert.alert('Send failed', res.message || 'Failed to send message');
        return;
      }
      setMessage('');
      setImage(null);
      await fetchWhatsappData(true);
      requestAnimationFrame(() => messagesRef.current?.scrollToEnd({ animated: true }));
    } finally {
      setSending(false);
    }
  }, [fetchWhatsappData, image, message, selectedUser, sending]);

  if (!selectedUser) {
    return (
      <View style={styles.screen}>
        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Whatsapp</Text>
            <Text style={styles.sub}>{summaries.length} chats</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => void fetchWhatsappData()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.refreshText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search chats, phone or message…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void fetchWhatsappData()}
              tintColor={colors.primary}
            />
          }
        >
          {!loading && filteredChats.length === 0 ? (
            <Text style={styles.emptyText}>
              {records ? 'No chats found' : 'Loading chats…'}
            </Text>
          ) : null}
          {filteredChats.map((chat, ci) => (
            <TouchableOpacity
              key={`chat-${ci}-${chat.phone || ''}`}
              style={styles.chatCard}
              activeOpacity={0.75}
              onPress={() => setSelectedUser(normalizePhone(chat.phone))}
            >
              <Avatar name={chat.profileName} />
              <View style={styles.chatBody}>
                <View style={styles.chatTopRow}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {chat.profileName}
                  </Text>
                  <Text style={styles.chatTime}>{formatTime(chat.timestamp)}</Text>
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
        </ScrollView>
      </View>
    );
  }

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
            setSelectedUser(null);
            setImage(null);
            setMessage('');
          }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Avatar name={activeProfileName} />
        <View style={styles.conversationTitle}>
          <Text style={styles.chatName} numberOfLines={1}>
            {activeProfileName}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void Clipboard.setStringAsync(selectedUser);
              Alert.alert('Copied', 'Phone number copied');
            }}
          >
            <Text style={styles.activePhone} numberOfLines={1}>
              {selectedUser} · Copy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={messagesRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          messagesRef.current?.scrollToEnd({ animated: false })
        }
      >
        {activeMessages.length === 0 ? (
          <Text style={styles.emptyText}>No messages in this chat.</Text>
        ) : null}
        {activeMessages.map((item, index) => {
          const incoming = item.callback_type === 'incoming_message';
          const imageContent =
            item.content?.type === 'image' ? item.content.image : null;
          return (
            <View
              key={`${item.timestamp || 'message'}-${item.callback_type || 'unknown'}-${index}`}
              style={[
                styles.messageRow,
                incoming ? styles.messageRowIncoming : styles.messageRowOutgoing,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  incoming ? styles.bubbleIncoming : styles.bubbleOutgoing,
                ]}
              >
                {item.content?.type === 'text' ? (
                  <Text style={styles.messageText}>
                    {String(item.content.text.body || '')}
                  </Text>
                ) : null}
                {imageContent?.s3_url || imageContent?.url ? (
                  <Image
                    source={{ uri: imageContent.s3_url || imageContent.url }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                ) : null}
                {imageContent?.caption ? (
                  <Text style={styles.messageText}>{imageContent.caption}</Text>
                ) : null}
                {!item.content && item.description ? (
                  <Text style={styles.messageText}>{item.description}</Text>
                ) : null}
                <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
  },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(0.5) },
  refreshBtn: {
    minWidth: 76,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  refreshText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '700' },
  searchInput: {
    marginHorizontal: spacing(4),
    marginTop: spacing(3),
    marginBottom: spacing(2),
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: 14,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  errorBox: {
    marginHorizontal: spacing(4),
    marginBottom: spacing(2),
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  chatList: { padding: spacing(4), paddingTop: spacing(1), gap: spacing(2) },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing(8),
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2a4a3a',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#daf7f3', fontSize: 13, fontWeight: '800' },
  chatBody: { flex: 1, minWidth: 0 },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  chatName: { color: colors.foreground, fontSize: 14, fontWeight: '700', flex: 1 },
  chatTime: { color: colors.muted, fontSize: 10, flexShrink: 0 },
  chatPhone: { color: colors.primary, fontSize: 11, marginTop: 1 },
  chatPreview: { color: colors.muted, fontSize: 12, marginTop: spacing(0.5) },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 30,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: colors.foreground, fontSize: 30, lineHeight: 32 },
  conversationTitle: { flex: 1, minWidth: 0 },
  activePhone: { color: colors.primary, fontSize: 11, marginTop: 1 },
  messages: { flex: 1, backgroundColor: colors.background },
  messagesContent: { padding: spacing(3), gap: spacing(2), flexGrow: 1 },
  messageRow: { flexDirection: 'row' },
  messageRowIncoming: { justifyContent: 'flex-start' },
  messageRowOutgoing: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  bubbleIncoming: { backgroundColor: '#1f3d32' },
  bubbleOutgoing: { backgroundColor: colors.surfaceAlt },
  messageText: { color: colors.foreground, fontSize: 14, lineHeight: 20 },
  messageTime: {
    color: colors.muted,
    fontSize: 9,
    textAlign: 'right',
    marginTop: spacing(1),
  },
  messageImage: {
    width: 220,
    maxWidth: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing(1),
    backgroundColor: colors.surface,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    backgroundColor: colors.surface,
  },
  previewImage: { width: 48, height: 48, borderRadius: radius.sm },
  removeImage: { color: colors.destructive, fontSize: 12, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(2),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  attachText: { color: colors.foreground, fontSize: 24, lineHeight: 26 },
  messageInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    color: colors.foreground,
    fontSize: 14,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    textAlignVertical: 'top',
  },
  sendBtn: {
    minWidth: 58,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '800' },
});
