import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors } from '../../../../theme';
import { callLogRowId, formatStatusLabel, statusColor, type CallLogRow } from './helpers';
import { styles } from '../CallLogsScreen.styles';

type CallLogsListProps = {
  rows: CallLogRow[];
  rowOffset: number;
  selectedIds: Set<string>;
  allSelected: boolean;
  summaryBusyId: string | null;
  onToggleAll: () => void;
  onToggleSelect: (row: CallLogRow) => void;
  onSelectRow: (row: CallLogRow, index: number) => void;
  onComment: (row: CallLogRow) => void;
  onViewSummary: (row: CallLogRow) => void;
};

export function CallLogsList({
  rows,
  rowOffset,
  selectedIds,
  allSelected,
  summaryBusyId,
  onToggleAll,
  onToggleSelect,
  onSelectRow,
  onComment,
  onViewSummary,
}: CallLogsListProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>Calls</Text>
      {rows.length === 0 ? <Text style={styles.hint}>No call logs</Text> : null}
      {rows.length > 0 ? (
        <View style={styles.selectAllRow}>
          <TouchableOpacity style={styles.selectAllBtn} onPress={onToggleAll}>
            <Text style={styles.selectAllText}>
              {allSelected ? '☑ Deselect all' : '☐ Select all'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>{selectedIds.size} selected</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {rows.map((row, index) => {
          const id = callLogRowId(row);
          const checked = selectedIds.has(id);
          const badge = statusColor(row);
          return (
            <View key={`row-${index}-${String(row.call_sid || row._id || '')}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  style={[styles.cardCheck, checked && styles.cardCheckOn]}
                  onPress={() => onToggleSelect(row)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.cardCheckText, checked && styles.cardCheckTextOn]}>
                    {checked ? '☑' : '☐'}
                  </Text>
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => onSelectRow(row, index)}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardIndex}>#{rowOffset + index + 1}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {String(row.client_name || '—')}
                      </Text>
                      <Text
                        style={[
                          styles.statusPill,
                          badge
                            ? { color: badge, backgroundColor: `${badge}22` }
                            : { color: colors.muted, backgroundColor: 'rgba(148,163,184,0.18)' },
                        ]}
                        numberOfLines={1}
                      >
                        {formatStatusLabel(row)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        App: {appCodeForName(row.app_name)}
                      </Text>
                      <Text style={styles.cardSplitRight} numberOfLines={1}>
                        Bot {String(row.bot_id ?? '—')}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        {String(row.state || '—')}
                      </Text>
                      <Text style={styles.cardSplitRight} numberOfLines={1}>
                        {String(row.comments || '—')}
                      </Text>
                    </View>
                    <Text style={styles.cardHint}>Tap card for more details</Text>
                  </TouchableOpacity>
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => onComment(row)}>
                      <Text style={styles.cardActionBtnText}>Comment</Text>
                    </TouchableOpacity>
                    {String(row.status || '') === 'completed' && row.recording_url ? (
                      <TouchableOpacity
                        style={[
                          styles.cardActionBtn,
                          summaryBusyId === id && styles.cardActionBtnDisabled,
                        ]}
                        onPress={() => onViewSummary(row)}
                        disabled={summaryBusyId === id}
                      >
                        <Text style={styles.cardActionBtnText}>
                          {summaryBusyId === id ? 'Loading…' : 'View Summary'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}
