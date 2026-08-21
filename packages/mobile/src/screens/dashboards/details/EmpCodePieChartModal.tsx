/**
 * Mobile Current Month Chart — empCode / agent 3D pie for Withdrawal Fund.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, spacing } from '../../../theme';
import { DetailFilterBar } from './DetailFilterBar';

export type ChartCountRow = { name: string; count: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  empCodeRows: ChartCountRow[];
  agentRows: ChartCountRow[];
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onApply: () => void;
};

type ChartKind = 'emp' | 'agents';

type Slice = ChartCountRow & {
  start: number;
  end: number;
  color: string;
  sideColor: string;
};

const PIE_COLORS = [
  '#ff9f0a',
  '#42a5f5',
  '#66bb6a',
  '#ab47bc',
  '#ef5350',
  '#26c6da',
  '#ffca28',
  '#8d6e63',
  '#7e57c2',
  '#ec407a',
  '#29b6f6',
  '#9ccc65',
];

function shadeHex(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  const n = parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16);
  if (!Number.isFinite(n)) return hex;
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (n & 255) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y} Z`;
}

function sideWallPath(
  cx: number,
  cy: number,
  r: number,
  depth: number,
  startAngle: number,
  endAngle: number,
): string {
  const topA = polar(cx, cy, r, startAngle);
  const topB = polar(cx, cy, r, endAngle);
  const botA = { x: topA.x, y: topA.y + depth };
  const botB = { x: topB.x, y: topB.y + depth };
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${topA.x} ${topA.y}`,
    `A ${r} ${r} 0 ${large} 1 ${topB.x} ${topB.y}`,
    `L ${botB.x} ${botB.y}`,
    `A ${r} ${r} 0 ${large} 0 ${botA.x} ${botA.y}`,
    'Z',
  ].join(' ');
}

/** Only draw walls for the front-facing arc (bottom of circle on screen). */
function frontWallSegments(start: number, end: number): { start: number; end: number }[] {
  const segs: { start: number; end: number }[] = [];
  // Front face in our polar (-90 offset): angles 0..180 land on lower half of circle.
  const frontStart = 0;
  const frontEnd = 180;
  const a = Math.max(start, frontStart);
  const b = Math.min(end, frontEnd);
  if (b > a) segs.push({ start: a, end: b });
  return segs;
}

function buildSlices(rows: ChartCountRow[]): Slice[] {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total <= 0) return [];
  let cursor = 0;
  return rows.map((row, i) => {
    const start = (cursor / total) * 360;
    cursor += row.count;
    let end = (cursor / total) * 360;
    if (end - start < 0.8) end = start + 0.8;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    return {
      ...row,
      start,
      end,
      color,
      sideColor: shadeHex(color, -50),
    };
  });
}

function Pie3D({ rows }: { rows: ChartCountRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const slices = useMemo(() => buildSlices(rows), [rows]);

  const size = 180;
  const cx = size / 2;
  const cy = size / 2 - 6;
  const r = 68;
  const depth = 12;
  const svgH = size + depth + 6;

  if (total <= 0) {
    return (
      <View style={styles.emptyPie}>
        <Text style={styles.emptyPieText}>No data for selected dates</Text>
      </View>
    );
  }

  return (
    <View style={styles.pieWrap}>
      <Svg width={size} height={svgH}>
        <Defs>
          <LinearGradient id="pieShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.22" />
          </LinearGradient>
          <LinearGradient id="floorShadow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Ellipse
          cx={cx}
          cy={cy + r * 0.55 + depth}
          rx={r * 0.85}
          ry={12}
          fill="url(#floorShadow)"
        />

        {/* Depth stack for solid 3D body */}
        {Array.from({ length: depth }).map((_, layer) => (
          <React.Fragment key={`layer-${layer}`}>
            {slices.map((s, i) => (
              <Path
                key={`d-${layer}-${i}`}
                d={slicePath(cx, cy + (layer + 1), r, s.start, s.end)}
                fill={s.sideColor}
              />
            ))}
          </React.Fragment>
        ))}

        {/* Extra front rim walls for crisp edge */}
        {slices.flatMap((s, i) =>
          frontWallSegments(s.start, s.end).map((seg, j) => (
            <Path
              key={`wall-${i}-${j}`}
              d={sideWallPath(cx, cy, r, depth, seg.start, seg.end)}
              fill={s.sideColor}
            />
          )),
        )}

        {/* Top face — no center text */}
        {slices.map((s, i) => (
          <Path
            key={`top-${i}`}
            d={slicePath(cx, cy, r, s.start, s.end)}
            fill={s.color}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
        ))}

        <Circle cx={cx} cy={cy} r={r} fill="url(#pieShade)" />
      </Svg>
    </View>
  );
}

export function EmpCodePieChartModal({
  visible,
  onClose,
  loading = false,
  empCodeRows,
  agentRows,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
}: Props) {
  const [tab, setTab] = useState<ChartKind>('emp');
  const rows = tab === 'emp' ? empCodeRows : agentRows;
  const total = Math.max(1, rows.reduce((s, r) => s + r.count, 0));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Current Month Chart</Text>
              <Text style={styles.subtitle}>
                {startDate} → {endDate}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeHit}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <DetailFilterBar
            startDate={startDate}
            endDate={endDate}
            loading={loading}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            onApply={onApply}
          />

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'emp' && styles.tabActive]}
              onPress={() => setTab('emp')}
            >
              <Text style={[styles.tabText, tab === 'emp' && styles.tabTextActive]}>
                Emp codes ({empCodeRows.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'agents' && styles.tabActive]}
              onPress={() => setTab('agents')}
            >
              <Text style={[styles.tabText, tab === 'agents' && styles.tabTextActive]}>
                Agents ({agentRows.length})
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.hint}>Loading chart…</Text>
            </View>
          ) : (
            <View style={styles.contentSplit}>
              <View style={styles.chartStage}>
                <Pie3D rows={rows} />
              </View>

              <Text style={styles.legendTitle}>
                {tab === 'emp' ? 'Emp code breakdown' : 'Agent breakdown'}
              </Text>

              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {rows.map((row, i) => {
                  const pct = Math.round((row.count / total) * 1000) / 10;
                  const color = PIE_COLORS[i % PIE_COLORS.length];
                  return (
                    <View key={`${row.name}-${i}`} style={styles.legendCard}>
                      <View style={styles.legendTop}>
                        <View style={[styles.swatch, { backgroundColor: color }]} />
                        <Text style={styles.legendName} numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text style={styles.legendCount}>{row.count}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(4, Math.min(100, pct))}%`,
                              backgroundColor: color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.legendPct}>{pct}% of total</Text>
                    </View>
                  );
                })}
                {rows.length === 0 ? <Text style={styles.hint}>No rows for this range</Text> : null}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing(3),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '94%',
    padding: spacing(4),
    gap: spacing(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  closeHit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  close: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing(2) },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: colors.primary },
  loader: { alignItems: 'center', paddingVertical: spacing(8), gap: spacing(2) },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing(2) },
  contentSplit: {
    minHeight: 280,
    maxHeight: 440,
  },
  chartStage: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1),
    marginBottom: spacing(2),
    alignItems: 'center',
    overflow: 'hidden',
  },
  pieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPie: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPieText: { color: colors.muted, fontSize: 13 },
  legendTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing(1),
  },
  listScroll: {
    flexGrow: 0,
    maxHeight: 240,
  },
  listContent: {
    paddingBottom: spacing(2),
  },
  legendCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2.5),
    marginBottom: spacing(2),
    gap: spacing(1),
  },
  legendTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  legendName: { flex: 1, color: colors.foreground, fontSize: 13, fontWeight: '700' },
  legendCount: { color: colors.foreground, fontSize: 14, fontWeight: '800' },
  barTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 99 },
  legendPct: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
