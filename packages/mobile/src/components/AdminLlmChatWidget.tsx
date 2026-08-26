/**
 * Admin LLM Chat widget — mobile port of admin-panel-domains AdminLlmChatWidget.
 * Header robot icon → full-screen modal (gated by Admin_LLM_Chatbot).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import {
  CAMPAIGN_LIST,
  LLM_CHAT_HISTORY_KEY,
  LLM_CHAT_OPEN_KEY,
  collectUserIds,
  columnsFromRows,
  formatLlmCell,
  getListIdForCampaign,
  historyForApi,
  looksLikeUsersTable,
  normalizeDialerLeads,
  parseLlmSendResult,
  rowsFromLlmPayload,
  clearLlmChatStorage,
  type LlmChatMessage,
} from '@astro/shared';
import { secureApi } from '../api/client';
import { canUseAdminLlmChat, getSessionUser } from '../auth/permissions';
import { addToDialerBatch } from '../utils/externalDialer';
import { appStorage } from '../lib/webShim';
import { colors, radius, spacing } from '../theme';

/** LLM chat chrome — always light panel (readable tables), independent of app theme. */
const LLM = {
  bg: '#f8fafc',
  surface: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#cbd5e1',
  header: '#0f172a',
  headerInk: '#f8fafc',
  micBg: '#f5b301',
  micInk: '#1a1200',
  micRecordingBg: '#fee2e2',
  micRecordingInk: '#dc2626',
  sendBg: '#0f172a',
  sendInk: '#f8fafc',
  inputBg: '#ffffff',
  inputBorder: '#94a3b8',
};

function loadStoredMessages(): LlmChatMessage[] {
  try {
    const raw = appStorage.getItem(LLM_CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ResultTable({
  rows,
  collection,
  extraIds,
}: {
  rows: Record<string, unknown>[];
  collection?: string;
  extraIds?: string[];
}) {
  const [dialerLoading, setDialerLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const columns = columnsFromRows(rows);
  const showAddToDialer = looksLikeUsersTable(rows, collection);
  const admin = getSessionUser();

  const addToDialer = async () => {
    if (!selectedCampaignId) {
      Alert.alert('Validation', 'Please select a Campaign ID');
      return;
    }
    const userIds = Array.from(
      new Set([...collectUserIds(rows), ...(extraIds || [])]),
    );
    if (userIds.length === 0) {
      Alert.alert('Error', 'No user IDs found in this result');
      return;
    }

    setDialerLoading(true);
    try {
      const res = await secureApi('users.getDialerDataByIds', { userIds });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to load dialer leads');
        return;
      }
      const leads = normalizeDialerLeads(res.data);
      if (!leads.length) {
        Alert.alert('Error', 'No dialer leads found for selected users');
        return;
      }
      const campaignMeta = CAMPAIGN_LIST.find(
        (item) => String(item.id).trim() === selectedCampaignId,
      );
      const dialerRes = await addToDialerBatch({
        campaignId: selectedCampaignId,
        leads,
        serverId: campaignMeta?.serverId ?? String(admin?.serverId || ''),
        listId: getListIdForCampaign(selectedCampaignId),
        listName:
          campaignMeta?.name ||
          `${String(admin?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
      });
      if (!dialerRes.ok) {
        Alert.alert('Error', dialerRes.message || 'Failed to push to dialer');
        return;
      }
      Alert.alert('Success', dialerRes.message || `Pushed ${leads.length} leads to dialer`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to push to dialer');
    } finally {
      setDialerLoading(false);
    }
  };

  return (
    <View style={styles.tableBlock}>
      {showAddToDialer ? (
        <View style={styles.tableToolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CAMPAIGN_LIST.map((item) => {
              const id = String(item.id).trim();
              const active = selectedCampaignId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedCampaignId(active ? '' : id)}
                  disabled={dialerLoading}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.dialerBtn,
              (dialerLoading || !selectedCampaignId) && styles.dialerBtnDisabled,
            ]}
            disabled={dialerLoading || !selectedCampaignId}
            onPress={() => void addToDialer()}
          >
            <Text style={styles.dialerBtnText}>
              {dialerLoading ? 'Pushing…' : 'Add to dialer'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ScrollView horizontal>
        <View>
          <View style={styles.tableHeaderRow}>
            {columns.map((col) => (
              <Text key={col} style={[styles.tableHeaderCell, { minWidth: 120 }]}>
                {col}
              </Text>
            ))}
          </View>
          {rows.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              {columns.map((col) => (
                <Text
                  key={col}
                  style={[styles.tableCell, { minWidth: 120 }]}
                  numberOfLines={1}
                >
                  {formatLlmCell(row[col])}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MessageBody({
  content,
  role,
  safeData,
  collection,
}: {
  content: string;
  role: LlmChatMessage['role'];
  safeData?: unknown;
  collection?: string;
}) {
  if (role === 'assistant') {
    const rows = rowsFromLlmPayload(content, safeData);
    if (rows && rows.length > 0) {
      const trimmed = content.trim();
      const contentIsJson = trimmed.startsWith('{') || trimmed.startsWith('[');
      return (
        <View style={styles.resultStack}>
          {!contentIsJson && trimmed ? (
            <Text style={styles.bubbleText}>{content}</Text>
          ) : null}
          <ResultTable
            rows={rows}
            collection={collection}
            extraIds={collectUserIds(
              Array.isArray(safeData) ? (safeData as Record<string, unknown>[]) : [],
            )}
          />
        </View>
      );
    }
  }
  return (
    <Text style={[styles.bubbleText, role === 'user' && styles.bubbleTextUser]}>
      {content}
    </Text>
  );
}

export function AdminLlmChatHeaderButton() {
  const hasAccess = canUseAdminLlmChat();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(
    () => appStorage.getItem(LLM_CHAT_OPEN_KEY) === '1',
  );
  const [messages, setMessages] = useState<LlmChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<LlmChatMessage>>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);
  const cancelRecordingRef = useRef(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const recording = recorderState.isRecording;

  useEffect(() => {
    appStorage.setItem(LLM_CHAT_OPEN_KEY, open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    appStorage.setItem(LLM_CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!open || messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) return;
    if (!recording) return;
    cancelRecordingRef.current = true;
    void audioRecorder.stop().catch(() => undefined);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordingMs(0);
  }, [open, recording, audioRecorder]);

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    appStorage.removeItem(LLM_CHAT_HISTORY_KEY);
  };

  const sendVoiceUri = async (uri: string) => {
    const history = historyForApi(messages);
    const pendingId = `voice-pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: '🎤 Transcribing…', _pendingVoiceId: pendingId },
    ]);
    setLoading(true);
    try {
      const res = await secureApi('llmChat.sendVoice', {
        audioUri: uri,
        mimeType: 'audio/m4a',
        fileName: 'voice.m4a',
        history,
      });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to send voice message');
        setMessages((prev) => [
          ...prev.filter((m) => m._pendingVoiceId !== pendingId),
          {
            role: 'assistant',
            content: 'Sorry, something went wrong with the voice request.',
          },
        ]);
        return;
      }
      const payload = parseLlmSendResult(res.data);
      const transcript = String(payload?.transcript || '').trim() || 'Voice message';
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m._pendingVoiceId !== pendingId);
        return [
          ...withoutPending,
          { role: 'user', content: transcript },
          {
            role: 'assistant',
            content: payload?.answer || payload?.validationError || 'No response',
            refused: payload?.refused,
            safeData: payload?.safeData,
            collection: payload?.collection,
          },
        ];
      });
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to send voice message',
      );
      setMessages((prev) => [
        ...prev.filter((m) => m._pendingVoiceId !== pendingId),
        {
          role: 'assistant',
          content: 'Sorry, something went wrong with the voice request.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (loading) return;

    if (recording) {
      try {
        await audioRecorder.stop();
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setRecordingMs(0);
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          return;
        }
        const uri = audioRecorder.uri;
        if (!uri) {
          Alert.alert('Error', 'No audio captured. Try again.');
          return;
        }
        await sendVoiceUri(uri);
      } catch {
        Alert.alert('Error', 'Recording failed');
      }
      return;
    }

    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission', 'Microphone permission denied');
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      cancelRecordingRef.current = false;
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordStartedAtRef.current = Date.now();
      setRecordingMs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordStartedAtRef.current);
      }, 200);
    } catch {
      Alert.alert('Error', 'Could not access microphone');
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setRecordingMs(0);
    }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || recording) return;
    setInput('');
    const history = historyForApi(messages);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await secureApi('llmChat.send', { message: text, history });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to send message');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          },
        ]);
        return;
      }
      const payload = parseLlmSendResult(res.data);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: payload?.answer || payload?.validationError || 'No response',
          refused: payload?.refused,
          safeData: payload?.safeData,
          collection: payload?.collection,
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, recording, messages]);

  if (!hasAccess) return null;

  const timerLabel = `${String(Math.floor(recordingMs / 60000)).padStart(2, '0')}:${String(
    Math.floor((recordingMs % 60000) / 1000),
  ).padStart(2, '0')}`;

  return (
    <>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => setOpen(true)}
        accessibilityLabel="Admin Assistant"
      >
        <MaterialIcons name="smart-toy" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalRoot,
            {
              paddingTop: Math.max(insets.top, 8),
              paddingLeft: Math.max(insets.left, 0),
              paddingRight: Math.max(insets.right, 0),
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            enabled={Platform.OS === 'ios'}
          >
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleRow}>
                <MaterialIcons name="smart-toy" size={20} color={LLM.headerInk} />
                <Text style={styles.headerTitle}>Admin Assistant</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={startNewChat}
                  disabled={loading}
                  accessibilityLabel="New chat"
                  style={styles.headerActionBtn}
                >
                  <MaterialIcons name="add-comment" size={20} color="#e2e8f0" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  accessibilityLabel="Close"
                  style={styles.headerActionBtn}
                >
                  <MaterialIcons name="close" size={22} color="#e2e8f0" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              ref={listRef}
              style={styles.messagesFlex}
              data={messages}
              keyExtractor={(item, idx) =>
                `${item.role}-${idx}-${item._pendingVoiceId || ''}`
              }
              contentContainerStyle={styles.messagesList}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Ask in English or Hindi about deposits, withdrawals, users, offices,
                  callers, roles, or wallet metrics — type or use the mic. Sensitive
                  customer data is masked.
                </Text>
              }
              renderItem={({ item: m }) => {
                const withTable =
                  m.role === 'assistant' &&
                  Array.isArray(m.safeData) &&
                  (m.safeData as unknown[]).length > 0;
                return (
                  <View
                    style={[
                      styles.bubble,
                      m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                      m.refused && styles.bubbleRefused,
                      withTable && styles.bubbleWithTable,
                    ]}
                  >
                    <MessageBody
                      content={m.content}
                      role={m.role}
                      safeData={m.safeData}
                      collection={m.collection}
                    />
                  </View>
                );
              }}
              ListFooterComponent={
                loading ? (
                  <View style={[styles.bubble, styles.bubbleAssistant]}>
                    <ActivityIndicator size="small" color={LLM.ink} />
                  </View>
                ) : null
              }
            />

            <View
              style={[
                styles.composer,
                {
                  paddingBottom:
                    Math.max(insets.bottom, spacing(2)) +
                    (Platform.OS === 'android' ? keyboardHeight : 0),
                },
              ]}
            >
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={
                  recording
                    ? 'Listening… tap stop when done'
                    : 'Ask a question (English or Hindi)…'
                }
                placeholderTextColor={LLM.muted}
                editable={!loading && !recording}
                multiline
                maxLength={4000}
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  recording ? styles.micBtnRecording : null,
                ]}
                onPress={() => void toggleRecording()}
                disabled={loading}
                accessibilityLabel={recording ? 'Stop recording' : 'Ask by voice'}
              >
                <MaterialIcons
                  name={recording ? 'stop' : 'mic'}
                  size={22}
                  color={recording ? LLM.micRecordingInk : LLM.micInk}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (loading || recording || !input.trim()) && styles.sendBtnDisabled,
                ]}
                onPress={() => void send()}
                disabled={loading || recording || !input.trim()}
                accessibilityLabel="Send"
              >
                <MaterialIcons name="send" size={20} color={LLM.sendInk} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {recording ? (
            <Pressable style={styles.voiceOverlay} onPress={() => undefined}>
              <View style={styles.voiceCard}>
                <Text style={styles.voiceLabel}>Listening…</Text>
                <Text style={styles.voiceTimer}>{timerLabel}</Text>
                <Text style={styles.voiceHint}>Tap stop when you&apos;re done speaking</Text>
                <TouchableOpacity
                  style={styles.voiceStopBtn}
                  onPress={() => void toggleRecording()}
                >
                  <MaterialIcons name="stop" size={18} color="#fff" />
                  <Text style={styles.voiceStopText}>Stop</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

/** Clear chat history on logout. */
export function clearAdminLlmChatOnLogout(): void {
  clearLlmChatStorage(appStorage);
}

const styles = StyleSheet.create({
  headerIconBtn: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  modalRoot: {
    flex: 1,
    backgroundColor: LLM.header,
  },
  keyboardRoot: {
    flex: 1,
    backgroundColor: LLM.bg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LLM.header,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerTitle: {
    color: LLM.headerInk,
    fontSize: 15,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    padding: spacing(1.5),
  },
  messagesFlex: {
    flex: 1,
    minHeight: 0,
  },
  messagesList: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    flexGrow: 1,
  },
  emptyText: {
    color: LLM.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingVertical: spacing(10),
    paddingHorizontal: spacing(4),
  },
  bubble: {
    maxWidth: '90%',
    marginBottom: spacing(2),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1e293b',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: LLM.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleWithTable: {
    maxWidth: '100%',
  },
  bubbleRefused: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    color: LLM.ink,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  resultStack: {
    gap: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: LLM.surface,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: LLM.inputBorder,
    borderRadius: 14,
    paddingHorizontal: spacing(2.5),
    paddingVertical: Platform.OS === 'ios' ? spacing(2.5) : spacing(2),
    fontSize: 15,
    lineHeight: 20,
    color: LLM.ink,
    backgroundColor: LLM.inputBg,
    textAlignVertical: 'top',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LLM.micBg,
    marginBottom: 2,
  },
  micBtnRecording: {
    backgroundColor: LLM.micRecordingBg,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LLM.sendBg,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  tableBlock: {
    width: '100%',
    gap: 8,
    overflow: 'hidden',
  },
  tableToolbar: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: LLM.border,
    backgroundColor: LLM.surface,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: LLM.ink,
    borderColor: LLM.ink,
  },
  chipText: {
    fontSize: 12,
    color: LLM.ink,
    fontWeight: '600',
  },
  chipTextActive: {
    color: LLM.headerInk,
  },
  dialerBtn: {
    alignSelf: 'flex-end',
    backgroundColor: LLM.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  dialerBtnDisabled: {
    opacity: 0.65,
  },
  dialerBtnText: {
    color: LLM.headerInk,
    fontSize: 13,
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: LLM.header,
  },
  tableHeaderCell: {
    color: LLM.headerInk,
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: LLM.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: LLM.bg,
  },
  tableCell: {
    color: LLM.ink,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  voiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    zIndex: 30,
  },
  voiceCard: {
    width: '88%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 20,
    backgroundColor: LLM.header,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  voiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  voiceTimer: {
    fontVariant: ['tabular-nums'],
    fontSize: 28,
    fontWeight: '600',
    color: LLM.headerInk,
  },
  voiceHint: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  voiceStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    minWidth: 132,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ef4444',
  },
  voiceStopText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
