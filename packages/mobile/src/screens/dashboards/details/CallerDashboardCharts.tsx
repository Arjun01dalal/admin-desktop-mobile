import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { GtelCallerDashRow } from '@astro/shared';

import { styles } from './CallerDashboardCharts.styles';

type SeriesKey = string;

type ChartRow = {
  name: string;
  fullName: string;
  answered: number;
  notAnswered: number;
  noWebhook: number;
  total: number;
  campaignCalls: number;
  manualCalls: number;
  campaignActive: number;
  campaignInactive: number;
  allotTotal: number;
  allotTypes: Record<string, number>;
  flagged: number;
};

type TabId = 'calls' | 'mode' | 'active' | 'flagged' | 'allot';

type SeriesDef = { key: SeriesKey; color: string; label: string };

const COLORS = {
  answered: '#2e7d32',
  notAnswered: '#ef6c00',
  noWebhook: '#c62828',
  campaign: '#2e7d32',
  manual: '#6a1b9a',
  campActive: '#2e7d32',
  allot: '#00838f',
  flagged: '#ad1457',
};

const ALLOT_TYPE_COLORS = [
  '#00838f',
  '#2e7d32',
  '#6a1b9a',
  '#ef6c00',
  '#1565c0',
  '#ad1457',
  '#5d4037',
  '#f9a825',
];

const TOP_N = 8;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

function labelize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function metricNum(row: GtelCallerDashRow, keys: string[]): number {
  const wanted = new Set(keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const m of row.metrics) {
    const field = m.key.includes(':') ? m.key.split(':')[1] : m.key;
    const norm = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return toNumber(m.value);
  }
  return 0;
}

function metricNumInGroup(row: GtelCallerDashRow, group: string, keys: string[]): number {
  const g = group.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const m of row.metrics) {
    if (!m.key.includes(':')) continue;
    const [grp, field] = m.key.split(':');
    if (grp.toLowerCase().replace(/[^a-z0-9]/g, '') !== g) continue;
    const norm = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return toNumber(m.value);
  }
  return 0;
}

function buildRows(rows: GtelCallerDashRow[]): ChartRow[] {
  return rows.map((row) => {
    const allotTypes: Record<string, number> = {};
    for (const m of row.metrics) {
      if (!m.key.startsWith('allotment:')) continue;
      const field = m.key.slice('allotment:'.length);
      if (!field || field === 'total' || field === 'allotted' || field === 'count') continue;
      allotTypes[field] = toNumber(m.value);
    }
    const allotTotal =
      metricNumInGroup(row, 'allotment', ['total', 'allotted', 'count']) ||
      Object.values(allotTypes).reduce((s, n) => s + n, 0);

    const flagged =
      metricNumInGroup(row, 'personalConnectionCompliance', ['flagged', 'flaggedCount']) ||
      metricNumInGroup(row, 'connectionCompliance', ['flagged', 'flaggedCount']) ||
      metricNumInGroup(row, 'compliance', ['flagged', 'flaggedCount']) ||
      metricNum(row, ['flagged', 'flaggedCount']);

    return {
      name: shortName(row.name),
      fullName: row.empCode ? `${row.name} (${row.empCode})` : row.name,
      answered: toNumber(row.answered) || metricNum(row, ['answered']),
      notAnswered: metricNum(row, ['notAnswered', 'not_answered', 'noAnswer']),
      noWebhook: metricNum(row, ['noWebhook', 'no_webhook']),
      total: toNumber(row.total) || metricNum(row, ['total', 'totalCalls']),
      campaignCalls:
        metricNumInGroup(row, 'callmode', ['campaign']) ||
        metricNum(row, ['campaign', 'campaignCalls']),
      manualCalls:
        metricNumInGroup(row, 'callmode', ['manual']) || metricNum(row, ['manual', 'manualCalls']),
      campaignActive: metricNumInGroup(row, 'campaign', ['active']),
      campaignInactive: metricNumInGroup(row, 'campaign', ['inactive']),
      allotTotal,
      allotTypes,
      flagged,
    };
  });
}

function readSeriesValue(row: ChartRow, key: SeriesKey): number {
  if (Object.prototype.hasOwnProperty.call(row.allotTypes, key)) {
    return toNumber(row.allotTypes[key]);
  }
  const direct = (row as unknown as Record<string, unknown>)[key];
  return toNumber(direct);
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Comparative stacked bars: bar length = total vs max; numbers painted inside segments. */
function CompactBars({
  rows,
  series,
  totalOf,
}: {
  rows: ChartRow[];
  series: SeriesDef[];
  totalOf: (row: ChartRow) => number;
}) {
  const max = Math.max(...rows.map((r) => totalOf(r)), 1);

  return (
    <View style={styles.list}>
      {rows.map((row, index) => {
        const total = totalOf(row);
        const barPct = total > 0 ? Math.max(8, (total / max) * 100) : 0;
        const positive = series
          .map((s) => ({ ...s, value: readSeriesValue(row, s.key) }))
          .filter((p) => p.value > 0);

        return (
          <View key={row.fullName} style={styles.row}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.labelCol}>
              <Text style={styles.label} numberOfLines={1}>
                {row.name}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.barFill, { width: `${barPct}%` }]}>
                {positive.map((p) => (
                  <View
                    key={p.key}
                    style={[
                      styles.segment,
                      {
                        // flex keeps proportions; minWidth so small series
                        // (No Webhook / Manual) still fit their digit.
                        flex: p.value,
                        minWidth: 28,
                        backgroundColor: p.color,
                      },
                    ]}
                  >
                    <Text style={styles.segmentNum} numberOfLines={1}>
                      {p.value.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.value}>{total.toLocaleString('en-IN')}</Text>
          </View>
        );
      })}
    </View>
  );
}

type Props = {
  rows: GtelCallerDashRow[];
};

export function CallerDashboardCharts({ rows }: Props) {
  const [tab, setTab] = useState<TabId>('calls');
  const [showAll, setShowAll] = useState(false);

  const built = useMemo(() => {
    const chartRows = buildRows(rows);
    const allotTypeKeys = Array.from(
      new Set(chartRows.flatMap((r) => Object.keys(r.allotTypes))),
    ).sort((a, b) => a.localeCompare(b));
    const flaggedTotal = chartRows.reduce((sum, r) => sum + r.flagged, 0);

    const tabs: { id: TabId; label: string; available: boolean }[] = [
      {
        id: 'calls',
        label: 'Calls',
        available: chartRows.some((r) => r.answered || r.notAnswered || r.noWebhook || r.total),
      },
      {
        id: 'mode',
        label: 'Camp / Manual',
        available: chartRows.some((r) => r.campaignCalls || r.manualCalls),
      },
      {
        id: 'active',
        label: 'Active Campaign',
        available: chartRows.some((r) => r.campaignActive),
      },
      {
        id: 'flagged',
        label: 'Flagged',
        available: chartRows.some((r) => r.flagged > 0),
      },
      {
        id: 'allot',
        label: 'CX Allotment',
        available: chartRows.some((r) => r.allotTotal > 0 || Object.keys(r.allotTypes).length > 0),
      },
    ];

    return {
      chartRows,
      allotTypeKeys,
      flaggedTotal,
      tabs: tabs.filter((t) => t.available),
    };
  }, [rows]);

  const activeTab = built.tabs.some((t) => t.id === tab) ? tab : built.tabs[0]?.id;

  const { seriesForTab, sorted, totalOf } = useMemo(() => {
    let series: SeriesDef[];
    if (activeTab === 'calls') {
      series = [
        { key: 'answered', color: COLORS.answered, label: 'Answered' },
        { key: 'notAnswered', color: COLORS.notAnswered, label: 'Not Answered' },
        { key: 'noWebhook', color: COLORS.noWebhook, label: 'No Webhook' },
      ];
    } else if (activeTab === 'mode') {
      series = [
        { key: 'campaignCalls', color: COLORS.campaign, label: 'Campaign' },
        { key: 'manualCalls', color: COLORS.manual, label: 'Manual' },
      ];
    } else if (activeTab === 'active') {
      series = [{ key: 'campaignActive', color: COLORS.campActive, label: 'Active Campaign' }];
    } else if (activeTab === 'flagged') {
      series = [{ key: 'flagged', color: COLORS.flagged, label: 'Flagged words' }];
    } else if (built.allotTypeKeys.length) {
      series = built.allotTypeKeys.map((key, i) => ({
        key,
        color: ALLOT_TYPE_COLORS[i % ALLOT_TYPE_COLORS.length],
        label: labelize(key),
      }));
    } else {
      series = [{ key: 'allotTotal', color: COLORS.allot, label: 'Allotted' }];
    }

    const score = (row: ChartRow): number => {
      if (activeTab === 'calls') {
        return row.answered + row.notAnswered + row.noWebhook || row.total;
      }
      if (activeTab === 'mode') return row.campaignCalls + row.manualCalls;
      if (activeTab === 'active') return row.campaignActive;
      if (activeTab === 'flagged') return row.flagged;
      if (built.allotTypeKeys.length) {
        return (
          built.allotTypeKeys.reduce((s, k) => s + toNumber(row.allotTypes[k]), 0) ||
          row.allotTotal
        );
      }
      return row.allotTotal;
    };

    const baseRows =
      activeTab === 'flagged'
        ? built.chartRows.filter((r) => r.flagged > 0)
        : built.chartRows;

    return {
      seriesForTab: series,
      totalOf: score,
      sorted: [...baseRows].sort((a, b) => score(b) - score(a)),
    };
  }, [activeTab, built.allotTypeKeys, built.chartRows]);

  const visible = showAll ? sorted : sorted.slice(0, TOP_N);
  const hiddenCount = Math.max(0, sorted.length - TOP_N);

  const meta =
    activeTab === 'calls'
      ? { title: 'Calls by Caller', sub: 'Sorted by total' }
      : activeTab === 'mode'
        ? { title: 'Campaign / Manual', sub: 'Per-caller campaign vs manual' }
        : activeTab === 'active'
          ? { title: 'Active Campaign', sub: 'Active campaigns per caller' }
          : activeTab === 'flagged'
            ? {
                title: 'Flagged by Caller',
                sub: `Personal connection · Total flagged: ${built.flaggedTotal.toLocaleString('en-IN')}`,
              }
            : {
                title: 'CX Allotment',
                sub: built.allotTypeKeys.length
                  ? built.allotTypeKeys.map(labelize).join(' · ')
                  : 'Total allotted',
              };

  if (!rows.length || !built.tabs.length || !activeTab) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.headTitle}>{meta.title}</Text>
        <Text style={styles.headSub}>{meta.sub}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}
        >
          {built.tabs.map((t) => {
            const active = t.id === activeTab;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTab(t.id);
                  setShowAll(false);
                }}
                style={[styles.tab, active ? styles.tabActive : null]}
              >
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Legend items={seriesForTab.map((s) => ({ color: s.color, label: s.label }))} />

        {visible.length ? (
          <CompactBars rows={visible} series={seriesForTab} totalOf={totalOf} />
        ) : (
          <Text style={styles.empty}>No data for this chart</Text>
        )}

        {hiddenCount > 0 ? (
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={styles.moreBtn}
            accessibilityRole="button"
          >
            <Text style={styles.moreText}>
              {showAll ? 'Show top 8' : `Show all ${sorted.length} callers`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
