/**
 * Mobile Ludo / Lagna game picker — table of Game|Players|Bet|Win|RTP|GGR
 * (port of desktop LudoGameSelect / laxminarayan Dashboard select menu).
 *
 * Freeze panes: the Game column and the header row stay put; only the metric
 * columns scroll horizontally (header scroll is mirrored from the body).
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { toDisplayText } from '../jyotish/jyotishMapping';
import type { SelectOption } from '../types';
import { styles } from './LudoGameStatsPicker.styles';

export type LudoSelectStats = {
  uniquePlayers: number;
  bet: number;
  win: number;
  ggr: number;
  rtp: number;
};

type Props = {
  value: string;
  options: SelectOption[];
  statsMap?: Record<string, LudoSelectStats>;
  onChange: (value: string) => void;
  onGgrPress?: (gameId: string, ggr: number) => void;
};

const METRIC_COLUMNS = ['Players', 'Bet', 'Win', 'RTP', 'GGR'] as const;

function fmt(n: number | string | undefined): string {
  if (n === undefined || n === null) return '—';
  if (typeof n === 'string') return n;
  return n.toLocaleString('en-IN');
}

export function LudoGameStatsPicker({ value, options, statsMap, onChange, onGgrPress }: Props) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const headerScrollRef = useRef<ScrollView>(null);

  const selectedLabel =
    value === 'All' ? 'All' : options.find((o) => o.value === value)?.label || value;
  const selectedStats = statsMap?.[value];

  const rows = useMemo(
    () =>
      options.map((opt) => ({
        ...opt,
        stats: statsMap?.[opt.value],
      })),
    [options, statsMap],
  );

  const selectRow = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const mirrorHeaderScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    headerScrollRef.current?.scrollTo({
      x: e.nativeEvent.contentOffset.x,
      animated: false,
    });
  };

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.trigger} activeOpacity={0.75}>
        <Text style={styles.triggerLabel} numberOfLines={1}>
          {toDisplayText(selectedLabel)}
        </Text>
        {selectedStats ? (
          <Text style={[styles.triggerGgr, selectedStats.ggr < 0 ? styles.ggrNeg : styles.ggrPos]}>
            ({selectedStats.ggr})
          </Text>
        ) : null}
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, compact && styles.sheetCompact]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>Select game</Text>

            {/* Pinned header: Game cell is fixed, metric labels mirror body scroll. */}
            <View style={styles.headerRow}>
              <View style={[styles.gameCell, styles.headerCell]}>
                <Text style={styles.th}>Game</Text>
              </View>
              <ScrollView
                ref={headerScrollRef}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                style={styles.metricsViewport}
              >
                <View style={[styles.metricsRow, styles.headerCell]}>
                  {METRIC_COLUMNS.map((label) => (
                    <Text key={label} style={[styles.th, styles.colNum]}>
                      {label}
                    </Text>
                  ))}
                </View>
              </ScrollView>
            </View>

            <ScrollView
              style={styles.tableScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.bodyRow}>
                {/* Frozen game-name column */}
                <View style={styles.frozenCol}>
                  {rows.map((row) => {
                    const active = (value || 'All') === row.value;
                    return (
                      <TouchableOpacity
                        key={`game-${row.value}`}
                        style={[styles.gameCell, styles.bodyCell, active && styles.rowActive]}
                        onPress={() => selectRow(row.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.tdGame} numberOfLines={1}>
                          {toDisplayText(row.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Scrollable metric columns */}
                <ScrollView
                  horizontal
                  bounces={false}
                  showsHorizontalScrollIndicator
                  scrollEventThrottle={16}
                  onScroll={mirrorHeaderScroll}
                  style={styles.metricsViewport}
                >
                  <View>
                    {rows.map((row) => {
                      const active = (value || 'All') === row.value;
                      const ggr = row.stats?.ggr;
                      return (
                        <View
                          key={`metrics-${row.value}`}
                          style={[styles.metricsRow, styles.bodyCell, active && styles.rowActive]}
                        >
                          <TouchableOpacity
                            style={styles.metricSelect}
                            onPress={() => selectRow(row.value)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.td, styles.colNum]}>
                              {fmt(row.stats?.uniquePlayers)}
                            </Text>
                            <Text style={[styles.td, styles.colNum]}>{fmt(row.stats?.bet)}</Text>
                            <Text style={[styles.td, styles.colNum]}>{fmt(row.stats?.win)}</Text>
                            <Text style={[styles.td, styles.colNum]}>{fmt(row.stats?.rtp)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (typeof ggr !== 'number' || !onGgrPress) {
                                selectRow(row.value);
                                return;
                              }
                              setOpen(false);
                              onGgrPress(row.value, ggr);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.td,
                                styles.colNum,
                                styles.ggrCell,
                                typeof ggr === 'number' && ggr < 0 ? styles.ggrNeg : styles.ggrPos,
                              ]}
                            >
                              {fmt(ggr)}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

