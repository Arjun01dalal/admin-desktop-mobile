/**
 * Mobile Ludo / Lagna game picker — table of Game|Players|Bet|Win|RTP|GGR
 * (port of desktop LudoGameSelect / laxminarayan Dashboard select menu).
 */
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
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
};

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
}: Props) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;

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
            <ScrollView
              horizontal
              bounces={false}
              showsHorizontalScrollIndicator={false}
            >
              <ScrollView
                style={styles.tableScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <View style={styles.table}>
                  <View style={[styles.tr, styles.trHeader]}>
                    <Text style={[styles.th, styles.colGame]}>Game</Text>
                    <Text style={[styles.th, styles.colNum]}>Players</Text>
                    <Text style={[styles.th, styles.colNum]}>Bet</Text>
                    <Text style={[styles.th, styles.colNum]}>Win</Text>
                    <Text style={[styles.th, styles.colNum]}>RTP</Text>
                    <Text style={[styles.th, styles.colNum]}>GGR</Text>
                  </View>
                  {rows.map((row) => {
                    const active = (value || 'All') === row.value;
                    const ggr = row.stats?.ggr;
                    return (
                      <TouchableOpacity
                        key={row.value}
                        style={[styles.tr, active && styles.trActive]}
                        onPress={() => {
                          onChange(row.value);
                          setOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.td, styles.colGame]} numberOfLines={1}>
                          {toDisplayText(row.label)}
                        </Text>
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
                    );
                  })}
                </View>
              </ScrollView>
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
  tableScroll: { maxHeight: 360 },
  table: { minWidth: 480 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing(1),
  },
  trHeader: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    paddingHorizontal: spacing(1),
  },
  trActive: { backgroundColor: 'rgba(245,179,1,0.12)' },
  th: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  td: { color: colors.foreground, fontSize: 12, fontWeight: '500' },
  colGame: { width: 110, flexGrow: 1, flexShrink: 1 },
  colNum: {
    width: 62,
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
