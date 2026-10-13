import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, spacing } from '../../../../theme';
import { formatStatusLabel, statusColor, type CallLogRow } from './helpers';
import { styles } from '../CallLogsScreen.styles';

export type CallLogCardProps = {
  row: CallLogRow;
  index: number;
  rowOffset: number;
  checked: boolean;
  summaryBusy: boolean;
  onToggleSelect: (row: CallLogRow) => void;
  onSelectRow: (row: CallLogRow, index: number) => void;
  onComment: (row: CallLogRow) => void;
  onViewSummary: (row: CallLogRow) => void;
};

export const CallLogCard = memo(function CallLogCard({
  row,
  index,
  rowOffset,
  checked,
  summaryBusy,
  onToggleSelect,
  onSelectRow,
  onComment,
  onViewSummary,
}: CallLogCardProps) {
  const badge = statusColor(row);
  return (
    <View style={[styles.card, { marginBottom: spacing(2) }]}>
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
                style={[styles.cardActionBtn, summaryBusy && styles.cardActionBtnDisabled]}
                onPress={() => onViewSummary(row)}
                disabled={summaryBusy}
              >
                <Text style={styles.cardActionBtnText}>
                  {summaryBusy ? 'Loading…' : 'View Summary'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

export type CallLogsListHeaderProps = {
  showSelectAll: boolean;
  allSelected: boolean;
  selectedCount: number;
  onToggleAll: () => void;
};

/** Section title + optional select-all row for use as FlatList header content. */
export function CallLogsListHeader({
  showSelectAll,
  allSelected,
  selectedCount,
  onToggleAll,
}: CallLogsListHeaderProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>Calls</Text>
      {showSelectAll ? (
        <View style={styles.selectAllRow}>
          <TouchableOpacity style={styles.selectAllBtn} onPress={onToggleAll}>
            <Text style={styles.selectAllText}>
              {allSelected ? '☑ Deselect all' : '☐ Select all'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>{selectedCount} selected</Text>
        </View>
      ) : null}
    </>
  );
}
