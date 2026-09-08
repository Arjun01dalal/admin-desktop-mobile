import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../../theme';
import { REINIT_CHIPS, reinitTargetKey, type BotSummaryRow, type ReinitStatus } from './helpers';
import { styles } from '../CallLogsScreen.styles';

export type ReinitTarget = {
  key: string;
  botId: number;
  status: ReinitStatus;
};

type BotStatusPanelProps = {
  open: boolean;
  summaryRows: BotSummaryRow[];
  reinitTargets: ReinitTarget[];
  reinitKeys: Set<string>;
  actionLoading: boolean;
  allReinitSelected: boolean;
  onToggle: () => void;
  onToggleAll: () => void;
  onToggleTarget: (key: string) => void;
  onReinit: (targets: Array<{ botId: number; status: ReinitStatus }>) => void;
};

export function BotStatusPanel({
  open,
  summaryRows,
  reinitTargets,
  reinitKeys,
  actionLoading,
  allReinitSelected,
  onToggle,
  onToggleAll,
  onToggleTarget,
  onReinit,
}: BotStatusPanelProps) {
  const selectedReinit = reinitTargets.filter((target) => reinitKeys.has(target.key));
  const botCardStats = useCallback((row: BotSummaryRow) => {
    return [
      { label: 'Completed', value: row.completed, color: colors.success },
      { label: 'No-Answer', value: row.noAnswer, color: colors.destructive },
      { label: 'In-Progress', value: row.inProgress, color: colors.primary },
      { label: 'Failed', value: row.failed },
      { label: 'Busy', value: row.busy },
      { label: 'Queued', value: row.queued },
      { label: 'Deleted', value: row.deleted },
    ];
  }, []);

  return (
    <View style={styles.botStatusBlock}>
      <TouchableOpacity style={styles.botStatusHeader} onPress={onToggle}>
        <Text style={styles.collapseTitle}>
          Bot Status ({summaryRows.length}) {open ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <>
          {reinitTargets.length > 0 ? (
            <View style={styles.botStatusActions}>
              <TouchableOpacity
                style={styles.botStatusActionBtn}
                onPress={onToggleAll}
                disabled={actionLoading}
              >
                <Text style={styles.botStatusActionText}>
                  {allReinitSelected ? '☑ Deselect all' : '☐ Select all'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reinitBtn,
                  (!selectedReinit.length || actionLoading) && styles.btnDisabled,
                ]}
                disabled={!selectedReinit.length || actionLoading}
                onPress={() =>
                  onReinit(selectedReinit.map(({ botId, status }) => ({ botId, status })))
                }
              >
                <Text style={styles.reinitBtnText}>
                  {actionLoading ? 'Reinit…' : `Reinit Selected (${selectedReinit.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.botGrid}>
            {summaryRows.map((row) => (
              <View key={String(row.botId)} style={styles.botCard}>
                <View style={styles.botCardHeader}>
                  <Text style={styles.botCardTitle}>Bot {row.botId}</Text>
                  {row.state !== '-' ? (
                    <Text style={styles.botCardState} numberOfLines={1}>
                      {row.state}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.botChipRow}>
                  {botCardStats(row).map((stat) => {
                    const reinitChip = REINIT_CHIPS.find((chip) => chip.label === stat.label);
                    const canReinit = Boolean(reinitChip) && stat.value > 0;
                    const selectionKey = reinitChip
                      ? reinitTargetKey(row.botId, reinitChip.status)
                      : '';
                    const isSelected = canReinit && reinitKeys.has(selectionKey);
                    return (
                      <View
                        key={stat.label}
                        style={[
                          styles.botChip,
                          canReinit && styles.botChipReinit,
                          isSelected && styles.botChipSelected,
                        ]}
                      >
                        <TouchableOpacity
                          disabled={!canReinit || actionLoading}
                          onPress={() => {
                            if (canReinit) onToggleTarget(selectionKey);
                          }}
                        >
                          <Text
                            style={[styles.botChipValue, stat.color ? { color: stat.color } : null]}
                          >
                            {canReinit ? `${isSelected ? '☑' : '☐'} ${stat.value}` : stat.value}
                          </Text>
                          <Text style={styles.botChipLabel}>{stat.label}</Text>
                        </TouchableOpacity>
                        {canReinit ? (
                          <TouchableOpacity
                            disabled={actionLoading}
                            onPress={() =>
                              onReinit([{ botId: row.botId, status: reinitChip!.status }])
                            }
                          >
                            <Text style={styles.botChipReinitHint}>Reinit</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
