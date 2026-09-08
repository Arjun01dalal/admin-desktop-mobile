/** Presentational modal panels used by CallLogsScreen. */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../../../theme';
import { styles } from '../CallLogsScreen.styles';
import {
  COMMENT_OPTIONS,
  MAX_COMMENT_LENGTH,
  buildSummaryRows,
  type CallLogRow,
  type CallSummaryData,
} from './helpers';

export function CallSummaryModal({
  visible,
  loading,
  message,
  data,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  message: string;
  data: CallSummaryData | null;
  onClose: () => void;
}) {
  const rows = buildSummaryRows(data);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.summaryCard]}>
          <Text style={styles.summaryModalTitle}>Call Record</Text>
          <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.summaryLoadingText}>Loading summary…</Text>
              </View>
            ) : message ? (
              <Text style={styles.summaryError}>{message}</Text>
            ) : rows.length === 0 ? (
              <Text style={styles.summaryValue}>No summary available.</Text>
            ) : (
              <View style={styles.summaryTable}>
                <View style={[styles.summaryTableRow, styles.summaryTableHead]}>
                  <Text style={[styles.summaryTh, styles.summaryColAttr]}>Attribute</Text>
                  <Text style={[styles.summaryTh, styles.summaryColValue]}>Value</Text>
                  <Text style={[styles.summaryTh, styles.summaryColReason]}>Reason / Details</Text>
                </View>
                {rows.map((row, index) => (
                  <View
                    key={row.title}
                    style={[
                      styles.summaryTableRow,
                      index % 2 === 0 ? styles.summaryRowEven : styles.summaryRowOdd,
                    ]}
                  >
                    <Text style={[styles.summaryTdAttr, styles.summaryColAttr]}>{row.title}</Text>
                    <Text style={[styles.summaryTd, styles.summaryColValue]} selectable>
                      {row.value}
                    </Text>
                    <Text style={[styles.summaryTd, styles.summaryColReason]} selectable>
                      {row.reason || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={onClose}>
              <Text style={styles.clearBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CommentModal({
  row,
  choice,
  text,
  saving,
  onChoice,
  onText,
  onSave,
  onClose,
}: {
  row: CallLogRow | null;
  choice: string;
  text: string;
  saving: boolean;
  onChoice: (value: string) => void;
  onText: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={row !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add Comment</Text>
          <Text style={styles.modalSub}>
            {String(row?.client_name || '')} · {String(row?.caller_user_id || '')}
          </Text>
          <ScrollView style={styles.modalChips} showsVerticalScrollIndicator={false}>
            <View style={styles.chipWrap}>
              {[...COMMENT_OPTIONS, 'other'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, choice === item && styles.chipActive]}
                  onPress={() => onChoice(item)}
                >
                  <Text style={[styles.chipText, choice === item && styles.chipTextActive]}>
                    {item === 'other' ? 'Other…' : item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {(choice === 'other' || !choice) && (
            <TextInput
              style={styles.filterInput}
              value={text}
              onChangeText={(value) => onText(value.slice(0, MAX_COMMENT_LENGTH))}
              placeholder="Custom comment"
              placeholderTextColor={colors.muted}
              maxLength={MAX_COMMENT_LENGTH}
            />
          )}
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={onClose}>
              <Text style={styles.clearBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchBtn} onPress={onSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.searchBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
