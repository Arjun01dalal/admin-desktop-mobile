/**
 * Isometric 3D bar chart — total or stacked-by-status, with tap tooltip.
 * Fits screen width (no horizontal scroll).
 */
import React, { memo, useMemo, useState } from 'react';
import Svg, { Defs, G, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import {
  BIFURCATION_STATUS_META,
  formatBifurcationAmount,
  formatBifurcationCompact,
  sortBifurcationChartData,
  type BifurcationChartDatum,
  type BifurcationChartMetric,
  type BifurcationStatusKey,
} from '@astro/shared/withdrawalBifurcation';

import { styles } from './WithdrawalBifurcationScreen.styles';
import { colors } from '../../theme';

export type ChartMode = 'total' | 'stacked';

type Props = {
  data: BifurcationChartDatum[];
  metric?: BifurcationChartMetric;
  mode?: ChartMode;
};

const PALETTE = [
  { front: '#3b82f6', top: '#60a5fa', side: '#1d4ed8' },
  { front: '#10b981', top: '#34d399', side: '#047857' },
  { front: '#f59e0b', top: '#fbbf24', side: '#b45309' },
  { front: '#ef4444', top: '#f87171', side: '#b91c1c' },
  { front: '#a855f7', top: '#c084fc', side: '#7e22ce' },
  { front: '#06b6d4', top: '#22d3ee', side: '#0e7490' },
  { front: '#ec4899', top: '#f472b6', side: '#be185d' },
  { front: '#84cc16', top: '#a3e635', side: '#4d7c0f' },
] as const;

const STACK_COLORS: Record<BifurcationStatusKey, string> = {
  approved: '#22c55e',
  pending: '#f59e0b',
  inProgress: '#38bdf8',
  rejected: '#ef4444',
  cancelled: '#94a3b8',
  failed: '#dc2626',
  onHold: '#a855f7',
  reverse: '#64748b',
};

const CHART_PAD_TOP = 34;
const CHART_PAD_BOTTOM = 6;
const CHART_PAD_LEFT = 4;
const CHART_PAD_RIGHT = 4;
const CHART_BODY_H = 160;

function axisCode(item: BifurcationChartDatum, index: number): string {
  const raw = String(item.code || '').trim().toUpperCase();
  if (raw && raw !== 'NONE') return raw;
  if (raw === 'NONE') return '—';
  const parts = item.label.split(/\s*\+\s*|\s+/).filter(Boolean);
  if (parts.length) return parts.map((p) => p[0]?.toUpperCase() || '').join('') || `#${index + 1}`;
  return `#${index + 1}`;
}

function shade(hex: string, factor: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type StackSeg = { key: string; fill: string; y: number; h: number };
type BarGeom = {
  key: string;
  code: string;
  label: string;
  valueLabel: string;
  detail: string;
  slotX: number;
  front?: string;
  top?: string;
  side?: string;
  stacks?: StackSeg[];
  valueX: number;
  valueY: number;
  paletteIndex: number;
  barX: number;
  barW: number;
};

function Bifurcation3DBarChartImpl({ data, metric = 'amount', mode = 'total' }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sorted = useMemo(() => sortBifurcationChartData(data, metric), [data, metric]);
  const selected = sorted.find((d) => d.key === selectedKey) || null;

  const layout = useMemo(() => {
    const chartWidth = Math.max(containerWidth, 1);
    if (!sorted.length || containerWidth <= 0) {
      return {
        chartWidth,
        chartHeight: CHART_PAD_TOP + CHART_BODY_H + CHART_PAD_BOTTOM,
        baseY: CHART_PAD_TOP + CHART_BODY_H,
        slot: 0,
        startX: CHART_PAD_LEFT,
        valueFont: 10,
        floor: '',
        bars: [] as BarGeom[],
        a11y: 'No bifurcation chart data',
      };
    }

    const depthX = mode === 'stacked' ? 0 : sorted.length >= 7 ? 8 : 10;
    const depthY = mode === 'stacked' ? 0 : sorted.length >= 7 ? 6 : 8;
    const usable = Math.max(0, chartWidth - CHART_PAD_LEFT - CHART_PAD_RIGHT - Math.max(depthX, 1));
    const slot = usable / sorted.length;
    const barWidth = Math.max(10, Math.min(32, slot * 0.55));
    const chartHeight = CHART_PAD_TOP + CHART_BODY_H + CHART_PAD_BOTTOM;
    const plotHeight = CHART_BODY_H - Math.max(depthY, 0);
    const baseY = CHART_PAD_TOP + CHART_BODY_H;
    const startX = CHART_PAD_LEFT;
    const valueFont = sorted.length >= 7 ? 9 : 10;
    const maxValue = Math.max(
      ...sorted.map((d) => (metric === 'count' ? d.count : d.amount)),
      1,
    );

    const bars: BarGeom[] = sorted.map((item, index) => {
      const value = metric === 'count' ? item.count : item.amount;
      const h = Math.max(value > 0 ? 8 : 0, (value / maxValue) * plotHeight);
      const slotX = startX + index * slot;
      const x = slotX + (slot - barWidth) / 2;
      const y = baseY - h;
      const valueLift = index % 2 === 0 ? 12 : 2;
      const code = axisCode(item, index);
      const valueLabel = formatBifurcationCompact(value, metric);
      const detailParts = item.segments
        .filter((s) => (metric === 'count' ? s.count : s.amount) > 0)
        .map(
          (s) =>
            `${s.label} ${
              metric === 'count'
                ? s.count
                : formatBifurcationAmount(s.amount)
            }`,
        );
      const detail = `${item.label}: ${
        metric === 'count' ? value : formatBifurcationAmount(value)
      }${detailParts.length ? ` · ${detailParts.join(' · ')}` : ''}`;

      if (mode === 'stacked') {
        let cursor = baseY;
        const stacks: StackSeg[] = [];
        for (const seg of item.segments) {
          const segVal = metric === 'count' ? seg.count : seg.amount;
          if (segVal <= 0) continue;
          const segH = Math.max(2, (segVal / maxValue) * plotHeight);
          cursor -= segH;
          stacks.push({
            key: seg.key,
            fill: STACK_COLORS[seg.key],
            y: cursor,
            h: segH,
          });
        }
        return {
          key: item.key,
          code,
          label: item.label,
          valueLabel,
          detail,
          slotX,
          stacks,
          valueX: x + barWidth / 2,
          valueY: Math.max(11, (stacks[stacks.length - 1]?.y ?? baseY) - valueLift),
          paletteIndex: index % PALETTE.length,
          barX: x,
          barW: barWidth,
        };
      }

      return {
        key: item.key,
        code,
        label: item.label,
        valueLabel,
        detail,
        slotX,
        front: `${x},${y} ${x + barWidth},${y} ${x + barWidth},${baseY} ${x},${baseY}`,
        top: `${x},${y} ${x + depthX},${y - depthY} ${x + barWidth + depthX},${y - depthY} ${x + barWidth},${y}`,
        side: `${x + barWidth},${y} ${x + barWidth + depthX},${y - depthY} ${x + barWidth + depthX},${baseY - depthY} ${x + barWidth},${baseY}`,
        valueX: x + barWidth / 2 + depthX / 3,
        valueY: Math.max(11, y - depthY - valueLift),
        paletteIndex: index % PALETTE.length,
        barX: x,
        barW: barWidth,
      };
    });

    return {
      chartWidth,
      chartHeight,
      baseY,
      depthX,
      depthY,
      slot,
      startX,
      valueFont,
      floor:
        mode === 'stacked'
          ? ''
          : `${CHART_PAD_LEFT},${baseY} ${CHART_PAD_LEFT + depthX},${baseY - depthY} ${chartWidth - CHART_PAD_RIGHT},${baseY - depthY} ${chartWidth - CHART_PAD_RIGHT - depthX},${baseY}`,
      bars,
      a11y: `Played bifurcation ${metric} ${mode}: ${bars.map((b) => `${b.code} ${b.valueLabel}`).join(', ')}`,
    };
  }, [containerWidth, metric, mode, sorted]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  if (!sorted.length) {
    return (
      <View style={styles.chartEmpty} accessibilityLabel="No graph data">
        <Text style={styles.muted}>No graph data</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.chartCard}
      onLayout={onLayout}
      accessible
      accessibilityLabel={layout.a11y}
    >
      {selected ? (
        <View style={styles.tooltip} accessibilityLiveRegion="polite">
          <Text style={styles.tooltipTitle}>{selected.label}</Text>
          <Text style={styles.tooltipBody}>
            {metric === 'count'
              ? `${selected.count} txn`
              : `₹${formatBifurcationAmount(selected.amount)}`}
          </Text>
          <Text style={styles.tooltipHint} numberOfLines={3}>
            {layout.bars.find((b) => b.key === selected.key)?.detail || ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.chartHint}>Tap a bar for details</Text>
      )}

      {containerWidth > 0 ? (
        <View>
          <Svg width={layout.chartWidth} height={layout.chartHeight}>
            <Defs>
              {PALETTE.map((p, i) => (
                <LinearGradient key={`g-${i}`} id={`barFront${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={p.top} stopOpacity="1" />
                  <Stop offset="100%" stopColor={p.front} stopOpacity="1" />
                </LinearGradient>
              ))}
            </Defs>

            {layout.floor ? (
              <Polygon
                points={layout.floor}
                fill={colors.surfaceAlt}
                stroke={colors.border}
                strokeWidth={1}
                opacity={0.85}
              />
            ) : null}

            {layout.bars.map((bar) => {
              const palette = PALETTE[bar.paletteIndex];
              if (bar.stacks) {
                return (
                  <G key={bar.key}>
                    {bar.stacks.map((seg) => (
                      <Rect
                        key={seg.key}
                        x={bar.barX}
                        y={seg.y}
                        width={bar.barW}
                        height={seg.h}
                        fill={seg.fill}
                        rx={2}
                      />
                    ))}
                    <SvgText
                      x={bar.valueX}
                      y={bar.valueY}
                      fill={colors.foreground}
                      fontSize={String(layout.valueFont)}
                      fontWeight="800"
                      textAnchor="middle"
                    >
                      {bar.valueLabel}
                    </SvgText>
                  </G>
                );
              }
              return (
                <G key={bar.key}>
                  <Polygon points={bar.side!} fill={shade(palette.side, 0.92)} />
                  <Polygon points={bar.front!} fill={`url(#barFront${bar.paletteIndex})`} />
                  <Polygon points={bar.top!} fill={palette.top} />
                  <SvgText
                    x={bar.valueX}
                    y={bar.valueY}
                    fill={colors.foreground}
                    fontSize={String(layout.valueFont)}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {bar.valueLabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Invisible hit targets for tooltips */}
          <View style={[styles.hitRow, { width: layout.chartWidth, height: layout.chartHeight }]}>
            {layout.bars.map((bar) => (
              <Pressable
                key={bar.key}
                style={{ width: layout.slot, height: '100%' }}
                accessibilityRole="button"
                accessibilityLabel={bar.detail}
                onPress={() => setSelectedKey((prev) => (prev === bar.key ? null : bar.key))}
              />
            ))}
          </View>

          <View style={[styles.axisRow, { width: layout.chartWidth, paddingLeft: layout.startX }]}>
            {layout.bars.map((bar) => (
              <View key={bar.key} style={[styles.axisSlot, { width: layout.slot }]}>
                <Text
                  style={styles.axisCode}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  accessibilityLabel={bar.label}
                >
                  {bar.code}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.chartEmpty}>
          <Text style={styles.muted}>…</Text>
        </View>
      )}

      <View style={styles.legendRow}>
        {mode === 'stacked'
          ? BIFURCATION_STATUS_META.map(({ key, label }) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: STACK_COLORS[key] }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))
          : layout.bars.map((bar) => (
              <View key={bar.key} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: PALETTE[bar.paletteIndex].front },
                  ]}
                />
                <Text style={styles.legendText} numberOfLines={2}>
                  {bar.code} · {bar.label}
                </Text>
              </View>
            ))}
      </View>
    </View>
  );
}

export const Bifurcation3DBarChart = memo(Bifurcation3DBarChartImpl);
