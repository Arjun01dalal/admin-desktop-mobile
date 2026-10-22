import { useMemo, useState } from 'react';

import { Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { GtelCallerDashRow } from '@astro/shared';

import { buildCallerDashChartRows, type CallerDashChartRow } from './chartRows';
import { useDashPalette, type DashPalette } from './tones';

export type CallerDashChartsMode = 'tabs' | 'stack';

type TabId = 'calls' | 'mode' | 'active' | 'flagged' | 'allot';
type Series = { key: string; label: string; color: string };

type ChartDef = {
  id: TabId;
  label: string;
  title: string;
  hint: string;
  stacked: boolean;
  series: Series[];
  score: (row: CallerDashChartRow) => number;
};

const TOP_N = 12;

function buildChartDefs(palette: DashPalette): ChartDef[] {
  const c = palette.chart;
  return [
    {
      id: 'calls',
      label: 'Calls by Caller',
      title: 'Calls by Caller',
      hint: 'Answered vs Not Answered vs No Webhook',
      stacked: true,
      series: [
        { key: 'answered', label: 'Answered', color: c.answered },
        { key: 'notAnswered', label: 'Not Answered', color: c.notAnswered },
        { key: 'noWebhook', label: 'No Webhook', color: c.noWebhook },
      ],
      score: (r) => r.answered + r.notAnswered + r.noWebhook || r.total,
    },
    {
      id: 'mode',
      label: 'Campaign / Manual by Caller',
      title: 'Campaign / Manual by Caller',
      hint: 'Campaign vs Manual',
      stacked: true,
      series: [
        { key: 'campaignCalls', label: 'Campaign', color: c.campaign },
        { key: 'manualCalls', label: 'Manual', color: c.manual },
      ],
      score: (r) => r.campaignCalls + r.manualCalls,
    },
    {
      id: 'active',
      label: 'Campaign Allotment Status',
      title: 'Campaign Allotment Status',
      hint: 'Active campaigns per caller',
      stacked: false,
      series: [{ key: 'campaignActive', label: 'Active', color: c.campActive }],
      score: (r) => r.campaignActive,
    },
    {
      id: 'flagged',
      label: 'Flagged by Caller',
      title: 'Flagged by Caller',
      hint: 'Personal connection compliance',
      stacked: false,
      series: [{ key: 'flagged', label: 'Flagged keyword', color: c.flagged }],
      score: (r) => r.flagged,
    },
    {
      id: 'allot',
      label: 'Allotment per Caller',
      title: 'Allotment per Caller',
      hint: 'Allotment per caller',
      stacked: false,
      series: [{ key: 'allotTotal', label: 'Allotted', color: c.allot }],
      score: (r) => r.allotTotal,
    },
  ];
}

function readValue(row: CallerDashChartRow, key: string): number {
  if (key in row.allotTypes) return Number(row.allotTypes[key]) || 0;
  const v = (row as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : Number(v) || 0;
}

function YAxis({ max }: { max: number }) {
  const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  return (
    <Box
      sx={{
        width: 36,
        flexShrink: 0,
        height: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pr: 0.5,
      }}
    >
      {ticks.map((t) => (
        <Typography
          key={`y-${t}`}
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: 10, lineHeight: 1, textAlign: 'right' }}
        >
          {t}
        </Typography>
      ))}
    </Box>
  );
}

function ChartCard({
  def,
  rows,
  keepZeros,
  limit,
  gridLine,
}: {
  def: ChartDef;
  rows: CallerDashChartRow[];
  /** Table/stack view keeps zero bars so every caller appears on X-axis. */
  keepZeros: boolean;
  limit?: number;
  gridLine: string;
}) {
  const ranked = useMemo(() => {
    const list = [...rows]
      .map((row) => ({ row, total: def.score(row) }))
      .sort((a, b) => b.total - a.total || a.row.name.localeCompare(b.row.name));
    return keepZeros ? list : list.filter((x) => x.total > 0);
  }, [def, keepZeros, rows]);

  const visible = limit ? ranked.slice(0, limit) : ranked;
  const max = Math.max(...ranked.map((x) => x.total), 1);

  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={800}>
          {def.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {def.hint}
        </Typography>
      </Stack>

      {visible.length ? (
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5 }}>
          <YAxis max={max} />
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              height: 200,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 0.75,
              overflowX: 'auto',
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundImage: `repeating-linear-gradient(to top, transparent, transparent calc(25% - 1px), ${gridLine} 25%)`,
              backgroundSize: '100% 100%',
              pl: 1,
              pb: 0.25,
            }}
          >
            {visible.map(({ row, total }) => {
              const parts = def.series
                .map((s) => ({ ...s, value: readValue(row, s.key) }))
                .filter((p) => p.value > 0);
              const heightPct = total > 0 ? Math.max(4, (total / max) * 100) : 0;
              const fallback = def.series[0]?.color || '#94a3b8';
              return (
                <Tooltip
                  key={`${def.id}-${row.fullName}`}
                  title={
                    <Box>
                      <Typography variant="caption" display="block" fontWeight={700}>
                        {row.fullName}
                      </Typography>
                      {def.series.map((s) => (
                        <Typography key={s.key} variant="caption" display="block">
                          {s.label}: {readValue(row, s.key).toLocaleString('en-IN')}
                        </Typography>
                      ))}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      flex: '0 0 52px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      minWidth: 52,
                    }}
                  >
                    <Box
                      sx={{
                        width: '55%',
                        height: `${heightPct}%`,
                        minHeight: total > 0 ? 4 : 0,
                        display: 'flex',
                        flexDirection: def.stacked ? 'column-reverse' : 'column',
                        borderRadius: '5px 5px 0 0',
                        overflow: 'hidden',
                        bgcolor: def.stacked ? 'transparent' : parts[0]?.color || fallback,
                        background: !def.stacked
                          ? `linear-gradient(180deg, ${parts[0]?.color || fallback}cc, ${parts[0]?.color || fallback})`
                          : undefined,
                      }}
                    >
                      {def.stacked
                        ? parts.map((p) => (
                            <Box
                              key={p.key}
                              sx={{ flex: p.value, minHeight: 3, bgcolor: p.color }}
                            />
                          ))
                        : null}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.75,
                        maxWidth: 60,
                        textAlign: 'center',
                        fontSize: 10,
                        lineHeight: 1.1,
                        color: 'text.secondary',
                        transform: 'rotate(-35deg)',
                        transformOrigin: 'top center',
                        height: 28,
                      }}
                      noWrap
                    >
                      {row.name}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No data for this chart.
        </Typography>
      )}

      <Stack
        direction="row"
        spacing={1.5}
        justifyContent="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: 2.25 }}
      >
        {def.series.map((s) => (
          <Stack key={s.key} direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} />
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

type Props = {
  rows: GtelCallerDashRow[];
  mode?: CallerDashChartsMode;
};

export function CallerDashCharts({ rows, mode = 'tabs' }: Props) {
  const palette = useDashPalette();
  const [tab, setTab] = useState<TabId>('calls');
  const [showAll, setShowAll] = useState(false);

  const chartDefs = useMemo(() => buildChartDefs(palette), [palette]);
  const chartRows = useMemo(() => buildCallerDashChartRows(rows), [rows]);
  const flaggedTotal = useMemo(
    () => chartRows.reduce((s, r) => s + r.flagged, 0),
    [chartRows],
  );

  const activeDef = chartDefs.find((d) => d.id === tab) || chartDefs[0];
  const hiddenCount = Math.max(0, chartRows.length - TOP_N);

  if (mode === 'stack') {
    return (
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" fontWeight={800}>
          Graphical View
        </Typography>
        {chartDefs.map((def) => (
          <ChartCard
            key={def.id}
            def={{
              ...def,
              hint:
                def.id === 'flagged'
                  ? `Personal connection compliance Total flagged: ${flaggedTotal}`
                  : def.hint,
            }}
            rows={chartRows}
            keepZeros
            gridLine={palette.gridLine}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle1" fontWeight={800}>
        Graphical View
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {chartDefs.map((item) => {
          const active = tab === item.id;
          return (
            <Button
              key={item.id}
              size="small"
              onClick={() => {
                setTab(item.id);
                setShowAll(false);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 999,
                px: 1.75,
                py: 0.6,
                color: active ? '#fff' : 'text.primary',
                bgcolor: active ? palette.tabActive : palette.tabIdleBg,
                border: '1px solid',
                borderColor: active ? palette.tabActive : palette.tabIdleBorder,
                '&:hover': {
                  bgcolor: active ? palette.tabActive : palette.tabIdleBg,
                  filter: 'brightness(1.08)',
                },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>

      <ChartCard
        def={{
          ...activeDef,
          hint:
            activeDef.id === 'flagged'
              ? `Personal connection compliance · Total flagged: ${flaggedTotal}`
              : activeDef.hint,
        }}
        rows={chartRows}
        keepZeros={false}
        limit={showAll ? undefined : TOP_N}
        gridLine={palette.gridLine}
      />

      {hiddenCount > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            onClick={() => setShowAll((v) => !v)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 999,
              px: 1.5,
              bgcolor: palette.tabIdleBg,
              color: 'text.primary',
              border: '1px solid',
              borderColor: palette.tabIdleBorder,
              '&:hover': { filter: 'brightness(1.08)' },
            }}
          >
            {showAll ? 'View less' : `View more (${hiddenCount} more)`}
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
