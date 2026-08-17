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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';
import type { SelectOption } from '../types';

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

export function LudoGameStatsPicker({
  value,
  options,
  statsMap,
  onChange,
  onGgrPress,
}: Props) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const headerScrollRef = useRef<ScrollView>(null);

  const selectedLabel =
    value === 'All'
      ? 'All'
      : options.find((o) => o.value === value)?.label || value;
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
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.trigger}
        activeOpacity={0.75}
      >
        <Text style={styles.triggerLabel} numberOfLines={1}>
          {toDisplayText(selectedLabel)}
        </Text>
        {selectedStats ? (
          <Text
            style={[
              styles.triggerGgr,
              selectedStats.ggr < 0 ? styles.ggrNeg : styles.ggrPos,
            ]}
          >
            ({selectedStats.ggr})
          </Text>
        ) : null}
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
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
              showsVerticalScrollIndicator
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
                            <Text style={[styles.td, styles.colNum]}>
                              {fmt(row.stats?.bet)}
                            </Text>
                            <Text style={[styles.td, styles.colNum]}>
                              {fmt(row.stats?.win)}
                            </Text>
                            <Text style={[styles.td, styles.colNum]}>
                              {fmt(row.stats?.rtp)}
                            </Text>
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
                              typeof ggr === 'number' && ggr < 0
                                ? styles.ggrNeg
                                : styles.ggrPos,
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

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const ROW_H = 40;
const GAME_COL_W = 116;
const NUM_COL_W = 78;

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    maxWidth: '100%',
  },
  triggerLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  triggerGgr: { fontSize: 13, fontWeight: '800', flexShrink: 0 },
  chevron: { color: colors.muted, fontSize: 12, marginLeft: 'auto' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing(3),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    maxHeight: '80%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetCompact: { padding: spacing(2) },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing(2),
  },
  headerRow: { flexDirection: 'row', alignItems: 'stretch' },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tableScroll: { maxHeight: 320 },
  frozenCol: {
    width: GAME_COL_W,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  metricsViewport: { flexGrow: 1, flexShrink: 1 },
  gameCell: {
    width: GAME_COL_W,
    height: ROW_H,
    justifyContent: 'center',
    paddingHorizontal: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingHorizontal: spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricSelect: { flexDirection: 'row', alignItems: 'center' },
  headerCell: { backgroundColor: colors.surfaceAlt },
  bodyCell: { backgroundColor: 'transparent' },
  rowActive: { backgroundColor: 'rgba(245,179,1,0.12)' },
  th: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  td: { color: colors.foreground, fontSize: 12, fontWeight: '500' },
  tdGame: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  colNum: {
    width: NUM_COL_W,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  ggrCell: { fontWeight: '800', textDecorationLine: 'underline' },
  ggrPos: { color: colors.success },
  ggrNeg: { color: colors.destructive },
  closeBtn: {
    marginTop: spacing(2),
    alignSelf: 'center',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
  },
  closeText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
