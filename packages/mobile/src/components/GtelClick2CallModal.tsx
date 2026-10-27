/**
 * Click-to-call overlay — mobile port of admin-panel-domains Click2CallBtn modal.
 * Disposition / hangup / redial / quick-status / notes / callback.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  buildGtelClickToCallBody,
  canConfirmGtelHangup,
  canShowGtelC2c,
  createGtelCallId,
  extractGtelDispositions,
  extractPreviousNoteDetails,
  formatCallbackDueAtIst,
  formatGtelBalanceDisplay,
  formatGtelCallElapsed,
  formatPreviousNoteCallAt,
  getNumericExtension,
  isDispositionAlreadySetMessage,
  isGreenDisposition,
  isNegativeGtelBalance,
  isNoActiveCallError,
  parseGtelQuickStatus,
  sanitizeGtelPhone,
  type GtelCallQuickStatus,
  type GtelC2cTarget,
  type GtelPreviousNote,
} from '@astro/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { secureApi } from '../api/client';
import { getStoredUser } from '../lib/webShim';
import { styles } from './GtelClick2CallModal.styles';

export { canShowGtelC2c };
export type { GtelC2cTarget };

type Props = {
  target: GtelC2cTarget | null;
  onClose: () => void;
  onEnded?: () => void;
  canShowMobile: boolean;
  onOpenReport?: (userId: string, userName?: string) => void;
};

export function GtelClick2CallModal({
  target,
  onClose,
  onEnded,
  canShowMobile,
  onOpenReport,
}: Props) {
  const insets = useSafeAreaInsets();
  const admin = getStoredUser<Record<string, unknown>>();
  const [starting, setStarting] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [redialing, setRedialing] = useState(false);
  const [showRedial, setShowRedial] = useState(false);
  const [confirmHangup, setConfirmHangup] = useState(false);
  const [callId, setCallId] = useState('');
  const [extension, setExtension] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackDueAt, setCallbackDueAt] = useState('');
  const [previousNote, setPreviousNote] = useState<GtelPreviousNote | null>(null);
  const [quickStatus, setQuickStatus] = useState<GtelCallQuickStatus | null>(null);
  const [dispLoading, setDispLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState<GtelC2cTarget | null>(null);
  const startedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadDispositions = useCallback(async () => {
    setDispLoading(true);
    try {
      const res = await secureApi('gtel.dispositions', {});
      if (!res.ok) {
        setDispositions([]);
        setMsg(res.message || 'Failed to load dispositions');
        return;
      }
      const list = extractGtelDispositions(res.data);
      setDispositions(list);
      if (!list.length) setMsg('No dispositions returned from dialer');
    } catch (err) {
      setDispositions([]);
      setMsg(err instanceof Error ? err.message : 'Failed to load dispositions');
    } finally {
      setDispLoading(false);
    }
  }, []);

  const startCall = useCallback(
    async (next: GtelC2cTarget) => {
      const phone = sanitizeGtelPhone(next.phoneNumber);
      const ext =
        getNumericExtension(next.extensionId) || getNumericExtension(admin?.extensionId);
      const nextCallId = createGtelCallId();
      const isCampaign = Boolean(next.campaignDataId);
      setStarting(true);
      setMsg('');
      setActive(next);
      setShowRedial(false);
      setConfirmHangup(false);
      try {
        if (!phone) {
          setMsg('Phone number is required');
          onCloseRef.current();
          return;
        }
        if (!isCampaign && !ext) {
          if (next.isProspect) {
            setMsg('Extension not found for prospect call');
            onCloseRef.current();
            return;
          }
          setCallId(nextCallId);
          setExtension('—');
          setStartedAt(Date.now());
          setElapsed(0);
          setEnded(false);
          setPreview(true);
          setDisposition('');
          setNotes('');
          setCallbackDueAt('');
          void loadDispositions();
          return;
        }

        const body = buildGtelClickToCallBody({
          callId: nextCallId,
          phone,
          extension: ext,
          subAdminId: String(admin?._id || ''),
          target: next,
        });
        const res = await secureApi('gtel.clickToCall', body);
        if (!res.ok || res.success === false) {
          setMsg(res.message || 'Call could not be initiated');
          onCloseRef.current();
          return;
        }
        setPreviousNote(extractPreviousNoteDetails(res.data, body));
        setCallId(nextCallId);
        setExtension(isCampaign ? 'Campaign' : ext);
        setStartedAt(Date.now());
        setElapsed(0);
        setEnded(false);
        setPreview(false);
        setDisposition('');
        setNotes('');
        setCallbackDueAt('');
        setQuickStatus({ callId: nextCallId, answered: false, hangup: false });
        setMsg('Call initiated');
        void loadDispositions();
      } finally {
        setStarting(false);
      }
    },
    [admin, loadDispositions],
  );

  useEffect(() => {
    if (!target) {
      startedRef.current = false;
      setCallId('');
      setActive(null);
      setMsg('');
      setPreview(false);
      setShowRedial(false);
      setConfirmHangup(false);
      setPreviousNote(null);
      setQuickStatus(null);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void startCall(target);
  }, [target, startCall]);

  useEffect(() => {
    if (!callId || ended || !startedAt) return;
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [callId, ended, startedAt]);

  useEffect(() => {
    const id = String(callId || '').trim();
    if (!id || ended || preview) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await secureApi('gtel.quickStatus', { callId: id });
        if (cancelled || !res.ok) return;
        const status = parseGtelQuickStatus(res.data, id);
        if (status) setQuickStatus(status);
      } catch {
        /* ignore */
      }
    };
    void poll();
    const intervalId = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [callId, ended, preview]);

  const hangUp = useCallback(async () => {
    if (!callId) return;
    if (!disposition) {
      setMsg('Please select disposition');
      setConfirmHangup(true);
      return;
    }
    setHangingUp(true);
    try {
      if (!preview) {
        const notesTrim = notes.trim();
        const callbackIst = formatCallbackDueAtIst(callbackDueAt);
        if (notesTrim || callbackIst) {
          const metaRes = await secureApi('gtel.updateMetadata', {
            callId,
            ...(notesTrim ? { notes: notesTrim } : {}),
            ...(callbackIst ? { callbackDueAtIST: callbackIst } : {}),
          });
          if (!metaRes.ok && metaRes.success === false) {
            setMsg(metaRes.message || 'Failed to update call note');
            return;
          }
        }

        const dispRes = await secureApi('gtel.updateDisposition', {
          callId,
          disposition,
        });
        const alreadySet = isDispositionAlreadySetMessage(dispRes.message);
        if (!dispRes.ok && !alreadySet && dispRes.success === false) {
          setMsg(dispRes.message || 'Failed to update disposition');
          return;
        }
        const statusRes = await secureApi<{ status?: string }>('gtel.callDetails', { callId });
        const status = String(
          (statusRes.data as { status?: string } | undefined)?.status || '',
        ).toUpperCase();
        if (status !== 'COMPLETED') {
          const hangRes = await secureApi('gtel.hangup', { callId });
          if (!hangRes.ok || hangRes.success === false) {
            if (isNoActiveCallError(hangRes.message)) {
              if (active?.disableRedial) {
                setMsg(hangRes.message || 'No active call found');
                setEnded(true);
                onCloseRef.current();
                return;
              }
              setShowRedial(true);
              setConfirmHangup(false);
              setMsg(hangRes.message || 'No active call found');
              return;
            }
            setMsg(hangRes.message || 'Hang up failed');
            setEnded(true);
            onCloseRef.current();
            return;
          }
        }
      }
      setEnded(true);
      setMsg('Call ended');
      onEnded?.();
      onCloseRef.current();
    } finally {
      setHangingUp(false);
    }
  }, [active?.disableRedial, callId, callbackDueAt, disposition, notes, onEnded, preview]);

  const openHangupForm = () => {
    if (hangingUp || ended || !callId) return;
    setConfirmHangup(true);
    setMsg('');
    if (!dispositions.length && !dispLoading) void loadDispositions();
  };

  const handleRedial = useCallback(async () => {
    if (active?.disableRedial || !callId || redialing) return;
    setRedialing(true);
    setMsg('');
    try {
      const nextCallId = createGtelCallId();
      const res = await secureApi('gtel.redial', {
        originalCallId: callId,
        callId: nextCallId,
        reason: 'no_active_call',
      });
      if (!res.ok || res.success === false) {
        setMsg(res.message || 'Redial failed');
        return;
      }
      setCallId(nextCallId);
      setStartedAt(Date.now());
      setElapsed(0);
      setEnded(false);
      setShowRedial(false);
      setConfirmHangup(false);
      setQuickStatus({ callId: nextCallId, answered: false, hangup: false });
      setMsg('Call redialed');
    } finally {
      setRedialing(false);
    }
  }, [active?.disableRedial, callId, redialing]);

  if (!target && !callId) return null;

  const statusColor = quickStatus?.hangup
    ? '#ef4444'
    : quickStatus?.answered
      ? '#22c55e'
      : '#f59e0b';
  const live = Boolean(callId) && !ended;
  const showHangupForm = confirmHangup && live;
  const phoneDisplay = canShowMobile ? active?.phoneNumber || '—' : '**********';
  const dpId = String(active?.userId || '').trim();
  const cxName = active?.userName || '—';
  const canConfirm = canConfirmGtelHangup({ callId, disposition, hangingUp });
  const statusLabel = ended
    ? 'Ended'
    : quickStatus?.hangup
      ? 'Hangup'
      : quickStatus?.answered
        ? 'Answered'
        : starting && !callId
          ? 'Connecting…'
          : showRedial
            ? 'Redial'
            : 'Calling';

  const openDpReport = () => {
    if (!dpId || !onOpenReport) return;
    onOpenReport(dpId, cxName !== '—' ? cxName : dpId);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (hangingUp) return;
        if (ended || !callId) onCloseRef.current();
        else if (showHangupForm) setConfirmHangup(false);
        else openHangupForm();
      }}
    >
      <View
        style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, spacing(2)) }]}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {ended ? 'Call ended' : 'Active Call'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {starting && !callId
                  ? 'Connecting…'
                  : `${phoneDisplay} · ${formatGtelCallElapsed(elapsed)}`}
              </Text>
            </View>

            {starting && !callId ? <ActivityIndicator color={colors.primary} /> : null}

            {live && showRedial && !active?.disableRedial ? (
              <TouchableOpacity
                style={[styles.redialIconBtn, redialing && { opacity: 0.6 }]}
                disabled={redialing}
                onPress={() => void handleRedial()}
              >
                {redialing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.redialIconText}>Redial</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {live && !showRedial ? (
              <TouchableOpacity
                style={[styles.hangIconBtn, showHangupForm && styles.hangIconBtnActive]}
                disabled={hangingUp}
                onPress={openHangupForm}
                accessibilityLabel="Hang up"
              >
                <Text
                  style={[styles.hangIconText, showHangupForm && styles.hangIconTextActive]}
                >
                  End
                </Text>
              </TouchableOpacity>
            ) : null}

            {ended || (!callId && !starting) ? (
              <TouchableOpacity style={styles.closeBtn} onPress={() => onCloseRef.current()}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {live ? (
            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>DP ID</Text>
                <Text
                  style={[styles.metaValue, onOpenReport && dpId ? styles.metaLink : null]}
                  numberOfLines={1}
                  onPress={onOpenReport && dpId ? openDpReport : undefined}
                >
                  {dpId || '—'}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>CX Name</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {cxName}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Balance</Text>
                <Text
                  style={[
                    styles.metaValue,
                    isNegativeGtelBalance(active?.balance) ? { color: colors.destructive } : null,
                  ]}
                  numberOfLines={1}
                >
                  {formatGtelBalanceDisplay(active?.balance)}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Bonus Balance</Text>
                <Text
                  style={[
                    styles.metaValue,
                    isNegativeGtelBalance(active?.bonusBalance)
                      ? { color: colors.destructive }
                      : null,
                  ]}
                  numberOfLines={1}
                >
                  {formatGtelBalanceDisplay(active?.bonusBalance)}
                </Text>
              </View>
            </View>
          ) : null}

          {showHangupForm ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.formHeader}>
                <Text style={styles.formHeaderText} numberOfLines={1}>
                  {statusLabel}
                  {extension ? ` · Ext ${extension}` : ''}
                </Text>
                <TouchableOpacity
                  disabled={hangingUp}
                  onPress={() => setConfirmHangup(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {previousNote?.text || previousNote?.callAt ? (
                <View style={styles.previousNoteBox}>
                  <Text style={styles.previousNoteLabel}>Previous note</Text>
                  {previousNote.text ? (
                    <Text style={styles.previousNoteText}>{previousNote.text}</Text>
                  ) : null}
                  {previousNote.callAt ? (
                    <Text style={styles.previousNoteLabel}>
                      {formatPreviousNoteCallAt(previousNote.callAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Disposition *</Text>
              {dispLoading ? (
                <Text style={styles.hint}>Loading…</Text>
              ) : (
                <View style={styles.chipWrap}>
                  {dispositions.map((item) => {
                    const selected = disposition === item;
                    const green = isGreenDisposition(item);
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.chip,
                          selected && styles.chipActive,
                          selected && green && styles.chipGreen,
                        ]}
                        onPress={() => setDisposition(item)}
                        disabled={hangingUp}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextActive,
                            selected && green && styles.chipTextGreen,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.sectionLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={notes}
                editable={!hangingUp}
                multiline
                placeholder="Add call note…"
                placeholderTextColor={colors.muted}
                onChangeText={setNotes}
              />
              <Text style={styles.sectionLabel}>Callback IST (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={callbackDueAt}
                editable={!hangingUp}
                placeholder="YYYY-MM-DDTHH:mm"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                onChangeText={setCallbackDueAt}
              />

              <TouchableOpacity
                style={[styles.hangBtn, !canConfirm && { opacity: 0.5 }]}
                disabled={!canConfirm || dispLoading}
                onPress={() => void hangUp()}
              >
                <Text style={styles.hangBtnText}>
                  {hangingUp ? 'Hanging up…' : 'Confirm Hang Up'}
                </Text>
              </TouchableOpacity>

              {preview ? (
                <View style={styles.previewBanner}>
                  <Text style={styles.previewText}>Extension not found — preview mode</Text>
                </View>
              ) : null}
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </ScrollView>
          ) : live ? (
            <>
              <Text style={styles.callIdLine} numberOfLines={1}>
                {statusLabel}
                {callId ? ` · ${callId}` : ''}
              </Text>
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </>
          ) : ended ? (
            <Text style={styles.ended}>Call ended</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
