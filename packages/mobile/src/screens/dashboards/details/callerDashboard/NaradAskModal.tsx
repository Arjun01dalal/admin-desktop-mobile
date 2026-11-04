/**
 * Narad Ask — question modal for mobile Caller Dashboard.
 *
 * Note: KeyboardAvoidingView inside RN Modal is unreliable (esp. Android), so we
 * lift the bottom sheet with Keyboard show/hide height — same pattern as AdminLlmChatWidget.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildNaradAskPayload, extractNaradAskAnswer } from '@astro/shared/naradAsk';
import { secureApi } from '../../../../api/client';
import { getRoleName, getSessionUser } from '../../../../auth/permissions';
import { colors, spacing } from '../../../../theme';
import { styles } from '../CallerDashboardScreen.styles';
import { NaradAskAnswer } from './NaradAskAnswer';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NaradAskModal({ open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const session = useMemo(() => getSessionUser(), [open]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuestion('');
    setAnswer('');
    setError('');
    setLoading(false);
    setKeyboardHeight(0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [open]);

  const askUser = useMemo(() => {
    const id = String(session?._id || session?.name || session?.mobile || '').trim();
    const role = getRoleName(session) || 'admin';
    return { id: id || 'admin', name: String(session?.name || id || 'admin'), role };
  }, [session]);

  const onSubmit = async () => {
    const q = question.trim();
    if (!q) {
      setError('Enter a question');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const payload = buildNaradAskPayload(q, askUser);
      const res = await secureApi('gtel.naradAsk', payload);
      if (!res.ok) {
        setError(res.message || 'Ask failed');
        return;
      }
      setAnswer(extractNaradAskAnswer(res.data ?? res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask failed');
    } finally {
      setLoading(false);
    }
  };

  // When keyboard is open, keyboard height already includes home-indicator space.
  const bottomPad =
    keyboardHeight > 0
      ? spacing(3)
      : Math.max(spacing(6), insets.bottom + spacing(3));

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => !loading && onClose()}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <TouchableWithoutFeedback onPress={() => !loading && onClose()}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>

        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: keyboardHeight > 0 ? '70%' : '90%',
            paddingHorizontal: spacing(4),
            paddingTop: spacing(3),
            paddingBottom: bottomPad,
            marginBottom: keyboardHeight,
            flexShrink: 1,
          }}
        >
          <Text style={styles.title}>Ask AI</Text>
          <Text style={styles.sub}>
            As {askUser.name} · {askUser.role}
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing(2) }}
          >
            <Text style={styles.fieldLabel}>Question</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 96, textAlignVertical: 'top' }]}
              value={question}
              onChangeText={setQuestion}
              editable={!loading}
              multiline
              placeholder="e.g. withdrawal approval rate per caller last 30 days"
              placeholderTextColor={colors.muted}
            />

            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing(4) }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.sub, { marginTop: 8 }]}>Asking AI…</Text>
              </View>
            ) : null}

            {error && !loading ? (
              <Text style={{ color: colors.destructive, fontWeight: '700', marginTop: spacing(2) }}>
                {error}
              </Text>
            ) : null}

            {answer && !loading ? <NaradAskAnswer answer={answer} /> : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) }}>
            <TouchableOpacity
              style={[
                styles.modalClose,
                {
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              disabled={loading}
              onPress={onClose}
            >
              <Text style={[styles.modalCloseText, { color: colors.foreground }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalClose,
                {
                  flex: 1,
                  backgroundColor: colors.primary,
                  opacity: loading || !question.trim() ? 0.6 : 1,
                },
              ]}
              disabled={loading || !question.trim()}
              onPress={() => void onSubmit()}
            >
              <Text style={[styles.modalCloseText, { color: colors.primaryForeground }]}>
                {loading ? 'Submitting…' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
