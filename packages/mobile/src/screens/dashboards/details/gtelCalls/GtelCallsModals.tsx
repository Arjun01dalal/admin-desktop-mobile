/** Picker / details / flagged media / manual dial modals for Gtel Calls. */
import React from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  maskGtelPhone,
  pickGtelRecordingUrl,
  pickGtelTranscription,
  sanitizeGtelPhone,
  type GtelCall,
  type GtelFilters,
} from '@astro/shared';

import { colors, spacing } from '../../../../theme';
import { formatGtelTs } from './format';
import { styles } from './styles';

export type FlaggedMediaState = {
  callId: string;
  loading: boolean;
  call: GtelCall | null;
  view: 'actions' | 'transcript';
} | null;

type Props = {
  sheetBottomPad: number;
  canShowMobile: boolean;
  picker: null | 'extension' | 'disposition';
  setPicker: (v: null | 'extension' | 'disposition') => void;
  draft: GtelFilters;
  setDraft: React.Dispatch<React.SetStateAction<GtelFilters>>;
  extensions: string[];
  dispositions: string[];
  detailsOpen: boolean;
  setDetailsOpen: (v: boolean) => void;
  detailsCallId: string;
  detailsLoading: boolean;
  detailEntries: [string, string][];
  flaggedMedia: FlaggedMediaState;
  setFlaggedMedia: React.Dispatch<React.SetStateAction<FlaggedMediaState>>;
  playFlaggedRecording: () => void;
  manualOpen: boolean;
  setManualOpen: (v: boolean) => void;
  manualPhone: string;
  setManualPhone: (v: string) => void;
  manualSearching: boolean;
  searchManualUsers: () => void;
  manualUsersOpen: boolean;
  setManualUsersOpen: (v: boolean) => void;
  manualUsers: Record<string, unknown>[];
  setC2cTarget: (t: {
    phoneNumber: string;
    userId?: string;
    userName?: string;
    appName?: string;
    lastActivity?: string;
  } | null) => void;
};

export function GtelCallsModals(p: Props) {
  const {
    sheetBottomPad,
    canShowMobile,
    picker,
    setPicker,
    draft,
    setDraft,
    extensions,
    dispositions,
    detailsOpen,
    setDetailsOpen,
    detailsCallId,
    detailsLoading,
    detailEntries,
    flaggedMedia,
    setFlaggedMedia,
    playFlaggedRecording,
    manualOpen,
    setManualOpen,
    manualPhone,
    setManualPhone,
    manualSearching,
    searchManualUsers,
    manualUsersOpen,
    setManualUsersOpen,
    manualUsers,
    setC2cTarget,
  } = p;

  return (
    <>
      {/* Extension / disposition picker */}
      <Modal
        visible={picker != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setPicker(null)}
          />
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>
              {picker === 'extension' ? 'Select Extension' : 'Select Disposition'}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  if (picker === 'extension') setDraft((p) => ({ ...p, extension: '' }));
                  else setDraft((p) => ({ ...p, disposition: '' }));
                  setPicker(null);
                }}
              >
                <Text style={styles.modalOptionText}>All</Text>
              </TouchableOpacity>
              {picker === 'disposition' ? (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setDraft((p) => ({ ...p, disposition: 'null' }));
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>No Disposition</Text>
                </TouchableOpacity>
              ) : null}
              {(picker === 'extension' ? extensions : dispositions).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.modalOption}
                  onPress={() => {
                    if (picker === 'extension') setDraft((p) => ({ ...p, extension: item }));
                    else setDraft((p) => ({ ...p, disposition: item }));
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDone} onPress={() => setPicker(null)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Call details (menu Gtel Calls only) */}
      <Modal
        visible={detailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Call Details</Text>
            <Text style={styles.sub} selectable>
              {detailsCallId || '—'}
            </Text>
            {detailsLoading ? <Text style={styles.hint}>Loading…</Text> : null}
            {!detailsLoading && !detailEntries.length ? (
              <Text style={styles.hint}>No details found</Text>
            ) : null}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: spacing(4) }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {detailEntries.map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{key}</Text>
                  <Text style={styles.detailValue} selectable>
                    {value}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDone} onPress={() => setDetailsOpen(false)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Flagged call media — GET /dialer/calls?callId= */}
      <Modal
        visible={flaggedMedia != null}
        transparent
        animationType="slide"
        onRequestClose={() => setFlaggedMedia(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Call Actions</Text>
            <Text style={styles.sub} selectable>
              {flaggedMedia?.callId || '—'}
            </Text>
            {flaggedMedia?.loading ? <Text style={styles.hint}>Loading call…</Text> : null}
            {!flaggedMedia?.loading && flaggedMedia?.view === 'transcript' ? (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnGhost]}
                  onPress={() =>
                    setFlaggedMedia((prev) => (prev ? { ...prev, view: 'actions' } : prev))
                  }
                >
                  <Text style={styles.actionBtnGhostText}>Back</Text>
                </TouchableOpacity>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={{ paddingBottom: spacing(4) }}
                >
                  <Text style={styles.transcriptBody} selectable>
                    {pickGtelTranscription(flaggedMedia.call) || 'No transcript available'}
                  </Text>
                </ScrollView>
              </>
            ) : null}
            {!flaggedMedia?.loading && flaggedMedia?.view === 'actions' ? (
              <View style={styles.flaggedMediaActions}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    !pickGtelRecordingUrl(flaggedMedia.call) && styles.actionBtnDisabled,
                  ]}
                  disabled={!pickGtelRecordingUrl(flaggedMedia.call)}
                  onPress={() => void playFlaggedRecording()}
                >
                  <Text style={styles.actionBtnText}>Recording</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionBtnGhost,
                    !pickGtelTranscription(flaggedMedia.call) && styles.actionBtnDisabled,
                  ]}
                  disabled={!pickGtelTranscription(flaggedMedia.call)}
                  onPress={() => {
                    if (!pickGtelTranscription(flaggedMedia.call)) {
                      Alert.alert('Transcript', 'Transcript not available');
                      return;
                    }
                    setFlaggedMedia((prev) => (prev ? { ...prev, view: 'transcript' } : prev));
                  }}
                >
                  <Text style={styles.actionBtnGhostText}>Transcript</Text>
                </TouchableOpacity>
                {!pickGtelRecordingUrl(flaggedMedia.call) &&
                !pickGtelTranscription(flaggedMedia.call) ? (
                  <Text style={styles.hint}>No recording or transcript found for this call.</Text>
                ) : null}
              </View>
            ) : null}
            <TouchableOpacity style={styles.modalDone} onPress={() => setFlaggedMedia(null)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual dial phone entry */}
      <Modal
        visible={manualOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManualOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Manual Call</Text>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={manualPhone}
              onChangeText={setManualPhone}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="10 digit mobile"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, manualSearching && { opacity: 0.6 }]}
                disabled={manualSearching}
                onPress={() => void searchManualUsers()}
              >
                <Text style={styles.formBtnPrimaryText}>
                  {manualSearching ? 'Searching…' : 'Search'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setManualOpen(false)}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual dial user picker */}
      <Modal
        visible={manualUsersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualUsersOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Select User</Text>
            {!manualUsers.length ? (
              <Text style={styles.hint}>No users found for this number</Text>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.userList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {manualUsers.map((user, idx) => {
                  const id = String(user._id || user.dp_id || '');
                  const name = String(user.name || user.userName || user.username || '—');
                  const mobile = String(user.mobile || manualPhone);
                  const startCall = () => {
                    setManualUsersOpen(false);
                    setC2cTarget({
                      phoneNumber: sanitizeGtelPhone(mobile),
                      userId: id || undefined,
                      userName: name,
                      appName: String(user.clientName || '') || undefined,
                      lastActivity: formatGtelTs(
                        String(
                          user.lastActivity ||
                            user.last_activity ||
                            user.activeUser ||
                            user.active_user ||
                            '',
                        ),
                      ),
                    });
                  };
                  return (
                    <TouchableOpacity
                      key={`${id}-${idx}`}
                      style={styles.userRow}
                      activeOpacity={0.75}
                      onPress={startCall}
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{name}</Text>
                        <Text style={styles.userMeta}>
                          {maskGtelPhone(mobile, canShowMobile)}
                        </Text>
                        {id ? (
                          <Text style={styles.userId} selectable>
                            {id}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.userCallBtn}>
                        <Text style={styles.userCallBtnText}>Call</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalDone} onPress={() => setManualUsersOpen(false)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
