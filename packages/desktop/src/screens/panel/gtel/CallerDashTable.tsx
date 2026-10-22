/** Caller Dashboard dense metrics table (web column groups). */

import { useMemo } from 'react';

import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import type { GtelCallerDashRow } from '@astro/shared';
import { TablePanel } from '@/components/TablePanel';
import { alpha } from '@mui/material/styles';
import {
  CommonTable,
  type CommonTableColumn,
  type CommonTableHeaderGroup,
} from '@/components/CommonTable';

import { dashToneColor, useDashPalette, type DashPalette } from './tones';
import {
  buildCallerDashChartRows,
  metricText,
  type CallerDashChartRow,
} from './chartRows';

/** Two-tier group header colors (light / dark) matching web admin. */
function callerDashHeaderGroups(dark: boolean): CommonTableHeaderGroup[] {
  const g = (
    id: string,
    label: string,
    columnIds: string[],
    light: [string, string, string],
    darkT: [string, string, string],
  ): CommonTableHeaderGroup => {
    const [bg, subBg, subFg] = dark ? darkT : light;
    return {
      id,
      label,
      columnIds,
      bgcolor: bg,
      color: '#fff',
      subBgcolor: subBg,
      subColor: subFg,
    };
  };

  return [
    g(
      'totalCalls',
      'TOTAL CALLS',
      ['answered', 'notAnswered', 'noWebhook', 'redials'],
      ['#2563eb', '#bfdbfe', '#1e3a8a'],
      ['#1d4ed8', '#1e3a5f', '#bfdbfe'],
    ),
    g(
      'campManual',
      'CAMPAIGN / MANUAL',
      ['campaign', 'manual'],
      ['#7c3aed', '#ddd6fe', '#4c1d95'],
      ['#6d28d9', '#3b2764', '#ddd6fe'],
    ),
    g(
      'dispositions',
      'DISPOSITIONS',
      ['valid', 'invalid', 'notSet'],
      ['#db2777', '#fbcfe8', '#9d174d'],
      ['#be185d', '#5c1a3a', '#fbcfe8'],
    ),
    g(
      'campaignPending',
      'CAMPAIGN',
      ['pending'],
      ['#15803d', '#bbf7d0', '#14532d'],
      ['#166534', '#14532d', '#bbf7d0'],
    ),
    g(
      'cxAllot',
      'CX ALLOTMENTS',
      ['allot'],
      ['#0f766e', '#99f6e4', '#115e59'],
      ['#0f766e', '#134e4a', '#99f6e4'],
    ),
    g(
      'players',
      'EXCH / CASINO / SM',
      ['exch', 'casino', 'sm'],
      ['#ea580c', '#fed7aa', '#9a3412'],
      ['#c2410c', '#7c2d12', '#fed7aa'],
    ),
    g(
      'flagged',
      'FLAGGED',
      ['flagged'],
      ['#be185d', '#fce7f3', '#9d174d'],
      ['#9d174d', '#4c0519', '#fbcfe8'],
    ),
    g(
      'campList',
      'CAMPAIGN LIST',
      ['activeCamps', 'inactiveCamps'],
      ['#166534', '#dcfce7', '#14532d'],
      ['#14532d', '#052e16', '#bbf7d0'],
    ),
  ];
}

function MetricPill({
  value,
  color,
  onClick,
  title,
}: {
  value: string | number;
  color?: string;
  onClick?: () => void;
  title?: string;
}) {
  const text = value == null || value === '' ? '—' : String(value);
  const fg = color || 'inherit';
  const clickable = Boolean(onClick);
  return (
    <Box
      component={clickable ? 'button' : 'div'}
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      title={title}
      sx={{
        display: 'inline-flex',
        minWidth: 34,
        height: 26,
        px: 0.85,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: color ? alpha(color, 0.18) : 'action.hover',
        color: fg,
        fontWeight: 700,
        fontSize: 12,
        border: 0,
        m: 0,
        font: 'inherit',
        cursor: clickable ? 'pointer' : 'default',
        textDecoration: 'none',
        '&:hover': clickable
          ? { bgcolor: color ? alpha(color, 0.28) : 'action.selected' }
          : undefined,
      }}
    >
      {text}
    </Box>
  );
}

function CallerNameCell({
  row,
  talkTime,
  palette,
  onOpenCalls,
  onOpenDisposition,
}: {
  row: GtelCallerDashRow;
  talkTime: string;
  palette: DashPalette;
  onOpenCalls: () => void;
  onOpenDisposition: () => void;
}) {
  const hasDisp = Object.keys(row.byDisposition || {}).length > 0;
  return (
    <Box sx={{ py: 0.25, minWidth: 0, width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.6 }}>
        <Typography
          component="button"
          onClick={onOpenCalls}
          sx={{
            m: 0,
            p: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            font: 'inherit',
            fontWeight: 800,
            fontSize: 13,
            color: palette.name,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': { color: palette.nameHover },
          }}
          title={row.name || '—'}
        >
          {row.name || '—'}
        </Typography>
        {row.empCode ? (
          <Box
            sx={{
              px: 0.75,
              py: 0.15,
              borderRadius: 999,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {row.empCode}
          </Box>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={hasDisp ? 'By disposition' : 'No disposition data'}>
          <span>
            <IconButton
              size="small"
              disabled={!hasDisp}
              onClick={onOpenDisposition}
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                bgcolor: alpha(palette.tone.bad, 0.12),
                color: palette.tone.bad,
                '&:hover': { bgcolor: alpha(palette.tone.bad, 0.22) },
                '&.Mui-disabled': { bgcolor: 'action.hover', color: 'text.disabled' },
              }}
            >
              <FormatListBulletedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Total
        </Typography>
        <Typography variant="caption" fontWeight={800} color="text.primary">
          {row.total || '0'}
        </Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Talk Time
        </Typography>
        <Typography variant="caption" fontWeight={800} color="text.primary" noWrap>
          {talkTime || '—'}
        </Typography>
      </Stack>
    </Box>
  );
}

type Props = {
  rows: GtelCallerDashRow[];
  loading: boolean;
  onOpenDisposition: (row: GtelCallerDashRow) => void;
  onOpenCalls: (row: GtelCallerDashRow) => void;
  onOpenActiveCampaigns: (row: GtelCallerDashRow) => void;
  onOpenAllotment: (row: GtelCallerDashRow) => void;
};

export function CallerDashTable({
  rows,
  loading,
  onOpenDisposition,
  onOpenCalls,
  onOpenActiveCampaigns,
  onOpenAllotment,
}: Props) {
  const palette = useDashPalette();
  const chartByEmp = useMemo(() => {
    const map = new Map<string, CallerDashChartRow>();
    for (const r of buildCallerDashChartRows(rows)) {
      map.set(r.empCode || r.fullName, r);
    }
    return map;
  }, [rows]);

  const headerGroups = useMemo(
    () => callerDashHeaderGroups(palette.dark),
    [palette.dark],
  );

  const columns = useMemo<CommonTableColumn<GtelCallerDashRow>[]>(
    () => [
      {
        id: 'caller',
        label: 'Caller',
        width: 220,
        stickyLeft: true,
        cellSx: { verticalAlign: 'top', py: 0.75 },
        render: (row) => {
          const c =
            chartByEmp.get(row.empCode || '') ||
            chartByEmp.get(`${row.name} (${row.empCode})`);
          return (
            <CallerNameCell
              row={row}
              talkTime={c?.talkTime || row.talkTime || '—'}
              palette={palette}
              onOpenCalls={() => onOpenCalls(row)}
              onOpenDisposition={() => onOpenDisposition(row)}
            />
          );
        },
      },
      {
        id: 'answered',
        label: 'ANSWERED',
        width: 84,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.answered ?? row.answered}
            color={palette.chart.answered}
          />
        ),
      },
      {
        id: 'notAnswered',
        label: 'NOT ANSWERED',
        width: 100,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.notAnswered ?? 0}
            color={palette.chart.notAnswered}
          />
        ),
      },
      {
        id: 'noWebhook',
        label: 'NO WEBHOOK',
        width: 96,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.noWebhook ?? 0}
            color={palette.chart.noWebhook}
          />
        ),
      },
      {
        id: 'redials',
        label: 'REDIALS',
        width: 80,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.redials ?? 0}
            color={palette.chart.manual}
          />
        ),
      },
      {
        id: 'campaign',
        label: 'CAMPAIGN',
        width: 88,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.campaignCalls ?? 0}
            color={palette.chart.campaign}
          />
        ),
      },
      {
        id: 'manual',
        label: 'MANUAL',
        width: 80,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.manualCalls ?? 0}
            color={palette.chart.manual}
          />
        ),
      },
      {
        id: 'valid',
        label: 'VALID DISPOSITION',
        width: 120,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.validDisp ?? 0}
            color={dashToneColor(palette, 'ok')}
          />
        ),
      },
      {
        id: 'invalid',
        label: 'INVALID DISPOSITION',
        width: 128,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.invalidDisp ?? 0}
            color={dashToneColor(palette, 'bad')}
          />
        ),
      },
      {
        id: 'notSet',
        label: 'DISPOSITION NOT SET',
        width: 128,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.notSetDisp ?? 0}
            color={dashToneColor(palette, 'warn')}
          />
        ),
      },
      {
        id: 'pending',
        label: 'PENDING CALLS',
        width: 100,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.pendingCalls ?? 0}
            color={dashToneColor(palette, 'warn')}
          />
        ),
      },
      {
        id: 'allot',
        label: 'TOTAL',
        width: 80,
        align: 'center',
        render: (row) => {
          const value = chartByEmp.get(row.empCode || '')?.allotTotal ?? 0;
          const hasList =
            (row.allottedCx?.length || 0) > 0 ||
            Object.keys(row.byAllotmentType || {}).length > 0 ||
            Number(value) > 0;
          return (
            <MetricPill
              value={value}
              color={palette.chart.allot}
              title={hasList ? 'View allotted CX' : undefined}
              onClick={hasList ? () => onOpenAllotment(row) : undefined}
            />
          );
        },
      },
      {
        id: 'exch',
        label: 'EXCH PLAYERS',
        width: 96,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.exchPlayers ?? 0}
            color={palette.chart.exch}
          />
        ),
      },
      {
        id: 'casino',
        label: 'CASINO PLAYERS',
        width: 108,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.casinoPlayers ?? 0}
            color={palette.chart.casino}
          />
        ),
      },
      {
        id: 'sm',
        label: 'SM PLAYERS',
        width: 88,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.smPlayers ?? 0}
            color={palette.chart.sm}
          />
        ),
      },
      {
        id: 'flagged',
        label: 'FLAGGED CX',
        width: 100,
        align: 'center',
        render: (row) => (
          <MetricPill
            value={chartByEmp.get(row.empCode || '')?.flagged ?? 0}
            color={palette.chart.flagged}
          />
        ),
      },
      {
        id: 'activeCamps',
        label: 'ACTIVE CAMPAIGNS',
        width: 140,
        align: 'center',
        render: (row) => {
          const text = metricText(row, 'campaign', ['active', 'activeCampaigns']);
          const n =
            row.campaignActive?.length ||
            Number(String(text).replace(/,/g, '')) ||
            0;
          const hasList = (row.campaignActive?.length || 0) > 0 || n > 0;
          return (
            <MetricPill
              value={text === '—' ? 0 : text}
              color={palette.chart.campActive}
              title={hasList ? 'View active campaigns' : undefined}
              onClick={hasList ? () => onOpenActiveCampaigns(row) : undefined}
            />
          );
        },
      },
      {
        id: 'inactiveCamps',
        label: 'INACTIVE CAMPAIGNS',
        width: 140,
        render: (row) => (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600 }}
          >
            {metricText(row, 'campaign', ['inactive', 'inactiveCampaigns'])}
          </Typography>
        ),
      },
    ],
    [
      chartByEmp,
      onOpenActiveCampaigns,
      onOpenAllotment,
      onOpenCalls,
      onOpenDisposition,
      palette,
    ],
  );

  return (
    <TablePanel
      footer={
        <Typography variant="caption" color="text.secondary">
          {rows.length.toLocaleString('en-IN')} callers
        </Typography>
      }
    >
      <CommonTable
        columns={columns}
        rows={rows}
        headerGroups={headerGroups}
        getRowKey={(row, i) => String(row.empCode || row.name || i)}
        loading={loading}
        emptyMessage="No callers for the selected filters."
        dense
        compact
        maxHeight="100%"
        minWidth={1780}
      />
    </TablePanel>
  );
}
