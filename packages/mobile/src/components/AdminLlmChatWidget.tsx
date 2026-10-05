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
import { colors, spacing } from '../theme';
import { LLM, styles } from './AdminLlmChatWidget.styles';

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
    const userIds = Array.from(new Set([...collectUserIds(rows), ...(extraIds || [])]));
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
          campaignMeta?.name || `${String(admin?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`,
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
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                  >
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
            <Text style={styles.dialerBtnText}>{dialerLoading ? 'Pushing…' : 'Add to dialer'}</Text>
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
                <Text key={col} style={[styles.tableCell, { minWidth: 120 }]} numberOfLines={1}>
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
          {!contentIsJson && trimmed ? <Text style={styles.bubbleText}>{content}</Text> : null}
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
    <Text style={[styles.bubbleText, role === 'user' && styles.bubbleTextUser]}>{content}</Text>
  );
}

export function AdminLlmChatHeaderButton() {
  const hasAccess = canUseAdminLlmChat();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(() => appStorage.getItem(LLM_CHAT_OPEN_KEY) === '1');
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send voice message');
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
              keyExtractor={(item, idx) => `${item.role}-${idx}-${item._pendingVoiceId || ''}`}
              contentContainerStyle={styles.messagesList}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Ask in English or Hindi about deposits, withdrawals, users, offices, callers,
                  roles, or wallet metrics — type or use the mic. Sensitive customer data is masked.
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
                  recording ? 'Listening… tap stop when done' : 'Ask a question (English or Hindi)…'
                }
                placeholderTextColor={LLM.muted}
                editable={!loading && !recording}
                multiline
                maxLength={4000}
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                style={[styles.micBtn, recording ? styles.micBtnRecording : null]}
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

