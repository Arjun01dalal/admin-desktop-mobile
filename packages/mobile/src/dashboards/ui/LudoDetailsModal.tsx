/**
 * Ludo Update Game IDs + Update RTP dialogs
 * (port of desktop LudoDetailsModal for React Native).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatLudoRtp, parseLudoRtpList, type LudoRtpRow } from '@astro/shared/ludoRtp';
import {
  apiOtpFailed,
  maskOtpMobile,
  resolveLudoRtpOtpMobile,
} from '@astro/shared/walletOtp';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';
import { Button, Input } from '../../components/UI';

export type LudoModalAction = 'update' | 'rtp' | null;

type Props = {
  open: boolean;
  action: LudoModalAction;
  existingGameIds?: string[];
  onClose: () => void;
  onGameIdsUpdated?: () => void;
};

const parseGameIds = (input: string): string[] =>
  Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

type Msg = { text: string; error: boolean } | null;

export function LudoDetailsModal({
  open,
  action,
  existingGameIds = [],
  onClose,
  onGameIdsUpdated,
}: Props) {
  const [addInput, setAddInput] = useState('');
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [selectedRtpGameId, setSelectedRtpGameId] = useState('');
  const [rtpValue, setRtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [rtpLoading, setRtpLoading] = useState(false);
  const [rtpListLoading, setRtpListLoading] = useState(false);
  const [rtpRows, setRtpRows] = useState<LudoRtpRow[]>([]);
  const [currentGameIds, setCurrentGameIds] = useState<string[]>([]);
  const [message, setMessage] = useState<Msg>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmRtp, setConfirmRtp] = useState(false);
  const [otpPending, setOtpPending] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const otpMobile = resolveLudoRtpOtpMobile();

  const gameIdsKey = existingGameIds.join(',');
  const updateOpen = open && action === 'update';
  const rtpOpen = open && action === 'rtp';

  useEffect(() => {
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    setCurrentGameIds(gameIds);
  }, [gameIdsKey]);

  useEffect(() => {
    if (!open) return;
    setAddInput('');
    setSelectedToRemove([]);
    setRtpValue('');
    setMessage(null);
    setConfirmRemove(false);
    setConfirmRtp(false);
    setOtpPending(false);
    setOtp('');
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpSent(false);
    setSelectedRtpGameId('');
  }, [open, action]);

  const loadRtpList = useCallback(async () => {
    setRtpListLoading(true);
    setMessage(null);
    try {
      const res = await secureApi<unknown>('dashboard.ludoRtpGet', {});
      if (!res.ok) {
        setRtpRows([]);
        setMessage({ text: res.message || 'Failed to load RTP list', error: true });
        return;
      }
      const rows = parseLudoRtpList(res.data);
      setRtpRows(rows);
      if (rows.length) {
        setSelectedRtpGameId((prev) => prev || rows[0].gameId);
        setRtpValue((prev) => (prev ? prev : String(rows[0].rtp ?? '')));
      }
    } catch {
      setRtpRows([]);
      setMessage({ text: 'Failed to load RTP list', error: true });
    } finally {
      setRtpListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rtpOpen) void loadRtpList();
  }, [rtpOpen, loadRtpList]);

  const callGameIdsApi = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await secureApi('dashboard.ludoGameIdsUpdate', payload);
      if (!res.ok) {
        setMessage({ text: res.message || 'Failed to update game IDs', error: true });
        return false;
      }
      setMessage({ text: res.message || 'Game IDs updated successfully', error: false });
      onGameIdsUpdated?.();
      return true;
    } catch {
      setMessage({ text: 'Failed to update game IDs', error: true });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const gameIds = parseGameIds(addInput);
    if (!gameIds.length) {
      setMessage({ text: 'Please enter at least one game ID to add', error: true });
      return;
    }
    const success = await callGameIdsApi({ action: 'add', gameIds });
    if (success) {
      setAddInput('');
      setCurrentGameIds((prev) => Array.from(new Set([...prev, ...gameIds])));
    }
  };

  const handleRemove = async () => {
    setConfirmRemove(false);
    if (!selectedToRemove.length) {
      setMessage({ text: 'Please select at least one game ID to remove', error: true });
      return;
    }
    const success = await callGameIdsApi({
      action: 'remove',
      gameIds: selectedToRemove,
    });
    if (success) {
      setCurrentGameIds((prev) => prev.filter((id) => !selectedToRemove.includes(id)));
      setSelectedToRemove([]);
    }
  };

  const toggleRemoveSelection = (gameId: string) => {
    setConfirmRemove(false);
    setSelectedToRemove((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId],
    );
  };

  const selectRtpRow = (row: LudoRtpRow) => {
    setSelectedRtpGameId(row.gameId);
    setRtpValue(String(row.rtp ?? ''));
    setConfirmRtp(false);
    setOtpPending(false);
    setOtp('');
    setMessage(null);
  };

  const performRtpUpdate = async () => {
    if (!selectedRtpGameId) {
      setMessage({ text: 'Select a game', error: true });
      return false;
    }
    const rtp = Number(rtpValue);
    if (!rtpValue.trim() || !Number.isFinite(rtp) || rtp < 0) {
      setMessage({ text: 'Enter a valid RTP value', error: true });
      return false;
    }
    setRtpLoading(true);
    setMessage(null);
    try {
      const res = await secureApi('dashboard.ludoRtp', {
        gameId: selectedRtpGameId,
        rtp,
      });
      if (!res.ok) {
        setMessage({ text: res.message || 'Failed to update RTP', error: true });
        return false;
      }
      setMessage({ text: res.message || 'RTP updated successfully', error: false });
      setRtpRows((prev) =>
        prev.map((row) =>
          row.gameId === selectedRtpGameId ? { ...row, rtp } : row,
        ),
      );
      setOtpPending(false);
      setOtp('');
      return true;
    } catch {
      setMessage({ text: 'Failed to update RTP', error: true });
      return false;
    } finally {
      setRtpLoading(false);
    }
  };

  const sendRtpOtp = async () => {
    setOtpSending(true);
    setMessage(null);
    try {
      const res = await secureApi<unknown>('users.sendWalletOtp', { mobile: otpMobile });
      if (apiOtpFailed(res)) {
        setMessage({ text: res.message || 'Failed to send OTP', error: true });
        return false;
      }
      setOtpSent(true);
      setMessage({
        text: `OTP sent to SuperAdmin (${maskOtpMobile(otpMobile)})`,
        error: false,
      });
      return true;
    } catch {
      setMessage({ text: 'Failed to send OTP', error: true });
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  const beginRtpOtpVerification = async () => {
    setConfirmRtp(false);
    if (!selectedRtpGameId) {
      setMessage({ text: 'Select a game', error: true });
      return;
    }
    const rtp = Number(rtpValue);
    if (!rtpValue.trim() || !Number.isFinite(rtp) || rtp < 0) {
      setMessage({ text: 'Enter a valid RTP value', error: true });
      return;
    }
    setOtp('');
    setOtpPending(true);
    await sendRtpOtp();
  };

  const verifyRtpOtpAndUpdate = async () => {
    const code = otp.trim();
    if (!/^\d{4}$/.test(code)) {
      setMessage({ text: 'OTP must be 4 digits', error: true });
      return;
    }
    setOtpVerifying(true);
    setMessage(null);
    try {
      const res = await secureApi<unknown>('users.verifyBlockOtp', {
        mobile: otpMobile,
        otp: Number(code),
      });
      if (apiOtpFailed(res)) {
        setMessage({ text: res.message || 'Invalid OTP', error: true });
        return;
      }
      await performRtpUpdate();
    } finally {
      setOtpVerifying(false);
    }
  };
  const busy = loading || rtpLoading || rtpListLoading || otpSending || otpVerifying;
  const handleClose = () => {
    if (busy) return;
    onClose();
  };
  const selectedRow = rtpRows.find((row) => row.gameId === selectedRtpGameId);

  return (
    <Modal
      visible={updateOpen || rtpOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {updateOpen && (
              <>
                <Text style={styles.title}>Update Game IDs</Text>

                <Text style={styles.sectionLabel}>Current Game IDs</Text>
                <View style={styles.chipWrap}>
                  {currentGameIds.length ? (
                    currentGameIds.map((id) => {
                      const marked = selectedToRemove.includes(id);
                      return (
                        <TouchableOpacity
                          key={id}
                          onPress={() => toggleRemoveSelection(id)}
                          style={[styles.chip, marked && styles.chipRemove]}
                        >
                          <Text style={[styles.chipText, marked && styles.chipRemoveText]}>
                            {id}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.mutedText}>No game IDs found</Text>
                  )}
                </View>

                <View style={styles.box}>
                  <Text style={styles.sectionLabel}>Add</Text>
                  <Input
                    placeholder="Game IDs to add"
                    value={addInput}
                    onChangeText={setAddInput}
                    editable={!loading}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Button
                    title="Add"
                    onPress={() => void handleAdd()}
                    disabled={loading}
                    loading={loading}
                    style={styles.smallBtn}
                  />
                </View>

                <View style={styles.box}>
                  <Text style={styles.sectionLabel}>Remove</Text>
                  <Text style={styles.mutedText}>
                    Tap chips above to select game IDs for removal
                    {selectedToRemove.length ? ` (${selectedToRemove.length} selected)` : ''}.
                  </Text>
                  {confirmRemove ? (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>
                        Remove {selectedToRemove.length} game ID
                        {selectedToRemove.length > 1 ? 's' : ''}?
                      </Text>
                      <View style={styles.btnRow}>
                        <Button
                          title="Cancel"
                          variant="outline"
                          onPress={() => setConfirmRemove(false)}
                          style={styles.smallBtn}
                        />
                        <Button
                          title="Confirm remove"
                          onPress={() => void handleRemove()}
                          loading={loading}
                          style={styles.smallBtn}
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      title="Remove"
                      onPress={() => setConfirmRemove(true)}
                      disabled={loading || !selectedToRemove.length}
                      style={styles.removeBtn}
                    />
                  )}
                </View>
              </>
            )}

            {rtpOpen && (
              <>
                <View style={styles.rtpHeaderRow}>
                  <Text style={styles.title}>Update RTP</Text>
                  <TouchableOpacity
                    onPress={() => void loadRtpList()}
                    disabled={rtpListLoading || rtpLoading}
                    style={styles.refreshBtn}
                  >
                    <Text style={styles.refreshBtnText}>
                      {rtpListLoading ? 'Loading…' : 'Refresh'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Game-wise RTP</Text>
                {rtpListLoading ? (
                  <ActivityIndicator color={colors.primary} style={styles.rtpLoader} />
                ) : rtpRows.length ? (
                  <View style={styles.rtpList}>
                    {rtpRows.map((row) => {
                      const active = selectedRtpGameId === row.gameId;
                      return (
                        <TouchableOpacity
                          key={row.gameId}
                          style={[styles.rtpRow, active && styles.rtpRowActive]}
                          onPress={() => selectRtpRow(row)}
                          disabled={rtpLoading}
                        >
                          <View style={styles.rtpRowMain}>
                            <Text style={styles.rtpGameId} numberOfLines={1}>
                              {row.gameName || row.gameId}
                            </Text>
                            {row.gameName ? (
                              <Text style={styles.rtpGameSub} numberOfLines={1}>
                                ID: {row.gameId}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.rtpValue}>{formatLudoRtp(row.rtp)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.mutedText}>No RTP data found</Text>
                )}

                <View style={styles.box}>
                  <Text style={styles.sectionLabel}>
                    {selectedRow
                      ? `Edit RTP — ${selectedRow.gameName || selectedRow.gameId}`
                      : 'Edit RTP'}
                  </Text>
                  <Input
                    placeholder="RTP (e.g. 0.8, 0.9, 1)"
                    value={rtpValue}
                    onChangeText={(v) => {
                      setRtpValue(v);
                      setConfirmRtp(false);
                      setOtpPending(false);
                      setOtp('');
                    }}
                    editable={!rtpLoading && !otpVerifying && Boolean(selectedRtpGameId)}
                    keyboardType="numeric"
                    style={styles.input}
                  />

                  {confirmRtp ? (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>
                        Set RTP of {selectedRtpGameId} to {rtpValue}?
                      </Text>
                      <View style={styles.btnRow}>
                        <Button
                          title="Cancel"
                          variant="outline"
                          onPress={() => setConfirmRtp(false)}
                          style={styles.smallBtn}
                        />
                        <Button
                          title="Confirm"
                          onPress={() => void beginRtpOtpVerification()}
                          loading={otpSending}
                          style={styles.smallBtn}
                        />
                      </View>
                    </View>
                  ) : otpPending ? (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>
                        OTP sent to SuperAdmin ({maskOtpMobile(otpMobile)}). Enter OTP to
                        update RTP for {selectedRtpGameId} → {rtpValue}.
                      </Text>
                      <Input
                        placeholder="4-digit OTP"
                        value={otp}
                        onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))}
                        editable={!otpVerifying && !rtpLoading}
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                      <View style={styles.btnRow}>
                        <Button
                          title="Cancel"
                          variant="outline"
                          onPress={() => {
                            setOtpPending(false);
                            setOtp('');
                          }}
                          style={styles.smallBtn}
                        />
                        <Button
                          title="Resend"
                          variant="outline"
                          onPress={() => void sendRtpOtp()}
                          disabled={otpSending || otpVerifying}
                          style={styles.smallBtn}
                        />
                        <Button
                          title={otpVerifying ? 'Verifying…' : 'Verify & Update'}
                          onPress={() => void verifyRtpOtpAndUpdate()}
                          loading={otpVerifying || rtpLoading}
                          disabled={!otpSent || otp.trim().length !== 4}
                          style={styles.smallBtn}
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      title="Update RTP"
                      onPress={() => {
                        setMessage(null);
                        const rtp = Number(rtpValue);
                        if (!selectedRtpGameId) {
                          setMessage({ text: 'Select a game from the list', error: true });
                          return;
                        }
                        if (!rtpValue.trim() || !Number.isFinite(rtp) || rtp < 0) {
                          setMessage({ text: 'Enter a valid RTP value', error: true });
                          return;
                        }
                        setConfirmRtp(true);
                      }}
                      disabled={rtpLoading || rtpListLoading || otpPending || !selectedRtpGameId}
                      style={styles.smallBtn}
                    />
                  )}
                </View>
              </>
            )}

            {message ? (
              <Text style={[styles.message, message.error ? styles.msgError : styles.msgOk]}>
                {message.text}
              </Text>
            ) : null}

            <View style={styles.footer}>
              {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <Button
                title="Close"
                variant="outline"
                onPress={handleClose}
                disabled={busy}
                style={styles.smallBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    maxHeight: '85%',
  },
  sheetContent: { padding: spacing(4) },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '800' },
  rtpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
    gap: spacing(2),
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  refreshBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  sectionLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(2),
    marginTop: spacing(1),
  },
  rtpLoader: { marginVertical: spacing(3) },
  rtpList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing(3),
  },
  rtpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  rtpRowActive: {
    backgroundColor: 'rgba(255,159,10,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9f0a',
  },
  rtpRowMain: { flex: 1, minWidth: 0 },
  rtpGameId: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  rtpGameSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rtpValue: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipRemove: { backgroundColor: colors.destructive, borderColor: colors.destructive },
  chipRemoveText: { color: '#fff' },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  mutedText: { color: colors.muted, fontSize: 12, marginBottom: spacing(2) },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
    backgroundColor: colors.surfaceAlt,
  },
  input: { marginBottom: spacing(2.5), backgroundColor: colors.background },
  smallBtn: { height: 40, alignSelf: 'flex-start' },
  removeBtn: { height: 40, alignSelf: 'flex-start', backgroundColor: colors.destructive },
  btnRow: { flexDirection: 'row', gap: spacing(2) },
  confirmRow: { gap: spacing(2), marginTop: spacing(1) },
  confirmText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  message: { marginTop: spacing(1), fontSize: 12, fontWeight: '600' },
  msgError: { color: colors.destructive },
  msgOk: { color: colors.success },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(3),
  },
});
