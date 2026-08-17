/**
 * Ludo Update Game IDs + Update RTP dialogs
 * (port of desktop LudoDetailsModal for React Native).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  const [currentGameIds, setCurrentGameIds] = useState<string[]>([]);
  const [message, setMessage] = useState<Msg>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmRtp, setConfirmRtp] = useState(false);

  const gameIdsKey = existingGameIds.join(',');
  const updateOpen = open && action === 'update';
  const rtpOpen = open && action === 'rtp';

  useEffect(() => {
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    setCurrentGameIds(gameIds);
    if (!selectedRtpGameId && gameIds.length) {
      setSelectedRtpGameId(gameIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdsKey]);

  useEffect(() => {
    if (!open) return;
    setAddInput('');
    setSelectedToRemove([]);
    setRtpValue('');
    setMessage(null);
    setConfirmRemove(false);
    setConfirmRtp(false);
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    if (action === 'rtp') {
      setSelectedRtpGameId(gameIds[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action, gameIdsKey]);

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

  const handleUpdateRtp = async () => {
    setConfirmRtp(false);
    if (!selectedRtpGameId) {
      setMessage({ text: 'Select a game ID', error: true });
      return;
    }
    const rtp = Number(rtpValue);
    if (!rtpValue.trim() || !Number.isFinite(rtp) || rtp < 0) {
      setMessage({ text: 'Enter a valid RTP value', error: true });
      return;
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
        return;
      }
      setRtpValue('');
      onClose();
    } catch {
      setMessage({ text: 'Failed to update RTP', error: true });
    } finally {
      setRtpLoading(false);
    }
  };

  const busy = loading || rtpLoading;
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Modal
      visible={updateOpen || rtpOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
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
                <Text style={styles.title}>Update RTP</Text>

                <Text style={styles.sectionLabel}>Game ID</Text>
                {currentGameIds.length ? (
                  <View style={styles.chipWrap}>
                    {currentGameIds.map((id) => {
                      const active = selectedRtpGameId === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          onPress={() => {
                            setSelectedRtpGameId(id);
                            setConfirmRtp(false);
                          }}
                          disabled={rtpLoading}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipActiveText]}>
                            {id}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.mutedText}>No game IDs available</Text>
                )}

                <Text style={styles.sectionLabel}>RTP</Text>
                <Input
                  placeholder="RTP"
                  value={rtpValue}
                  onChangeText={(v) => {
                    setRtpValue(v);
                    setConfirmRtp(false);
                  }}
                  editable={!rtpLoading}
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
                        onPress={() => void handleUpdateRtp()}
                        loading={rtpLoading}
                        style={styles.smallBtn}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    title="Update"
                    onPress={() => {
                      setMessage(null);
                      const rtp = Number(rtpValue);
                      if (!selectedRtpGameId) {
                        setMessage({ text: 'Select a game ID', error: true });
                        return;
                      }
                      if (!rtpValue.trim() || !Number.isFinite(rtp) || rtp < 0) {
                        setMessage({ text: 'Enter a valid RTP value', error: true });
                        return;
                      }
                      setConfirmRtp(true);
                    }}
                    disabled={rtpLoading || !currentGameIds.length}
                    style={styles.smallBtn}
                  />
                )}
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
  title: { color: colors.foreground, fontSize: 17, fontWeight: '800', marginBottom: spacing(3) },
  sectionLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(2),
    marginTop: spacing(1),
  },
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveText: { color: colors.primaryForeground },
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
