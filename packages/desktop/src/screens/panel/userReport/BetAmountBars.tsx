import { useState } from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatAmount } from '@/utils/dates';

export type BarItem = { name: string; amount: number };

const GRADIENTS: Record<string, [string, string]> = {
  CASINO: ['#3b82f6', '#1e40af'],
  EXCHANGE: ['#9ca3af', '#6b7280'],
  SATTAMATKA: ['#ef4444', '#991b1b'],
};

type Props = { data: BarItem[]; collapsible?: boolean };

/** Round axis max up to a clean step (matches recharts-ish scale). */
function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const exp = Math.floor(Math.log10(value));
  const frac = value / 10 ** exp;
  let niceFrac = 1;
  if (frac > 1) niceFrac = 2;
  if (frac > 2) niceFrac = 5;
  if (frac > 5) niceFrac = 10;
  return niceFrac * 10 ** exp;
}

function formatAxis(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return Number.isInteger(v) ? `${v}M` : `${v.toFixed(1)}M`;
  }
  if (n >= 1000) return String(Math.round(n));
  return String(n);
}

function formatLabel(amt: number): string {
  const shown = formatAmount(amt);
  return `₹${shown}`;
}

/** Bet Amount Overview — optional collapsible chart + legend. */
export function BetAmountBars({ data, collapsible = true }: Props) {
  const [open, setOpen] = useState(!collapsible);
  const height = 180;
  const margin = { top: 24, right: 16, left: 46, bottom: 26 };
  const slot = 104;
  const width = margin.left + margin.right + Math.max(1, data.length) * slot;
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const amounts = data.map((d) => {
    const n = Number(d.amount);
    return Number.isFinite(n) ? n : 0;
  });
  const rawMax = Math.max(0, ...amounts);
  const maxVal = niceMax(rawMax);
  const total = amounts.reduce((sum, n) => sum + n, 0);
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => t * maxVal);
  const barSlot = data.length ? chartW / data.length : chartW;
  const barW = Math.min(52, Math.max(30, barSlot * 0.5));

  const body = (
    <Box sx={{ px: 1, pb: 1, pt: 0.25, borderTop: '1px solid #eef1f4' }}>
      {data.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, fontSize: 12, textAlign: 'center' }}>
          No bet data
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            width: '100%',
          }}
        >
          <Box sx={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              role="img"
              aria-label="Bet amount overview"
            >
              <defs>
                {data.map((entry) => {
                  const [c0, c1] = GRADIENTS[entry.name] || ['#64748b', '#334155'];
                  return (
                    <linearGradient
                      key={entry.name}
                      id={`bet-grad-${entry.name}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={c0} />
                      <stop offset="100%" stopColor={c1} />
                    </linearGradient>
                  );
                })}
              </defs>

              <line
                x1={margin.left}
                x2={margin.left + chartW}
                y1={margin.top + chartH}
                y2={margin.top + chartH}
                stroke="#d1d5db"
                strokeWidth={1}
              />

              {ticks.map((tick) => {
                const y = margin.top + chartH - (tick / maxVal) * chartH;
                return (
                  <g key={`t-${tick}`}>
                    <line
                      x1={margin.left - 4}
                      x2={margin.left}
                      y1={y}
                      y2={y}
                      stroke="#9ca3af"
                      strokeWidth={1}
                    />
                    <text
                      x={margin.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#6b7280"
                      fontSize={10}
                    >
                      {formatAxis(tick)}
                    </text>
                  </g>
                );
              })}

              {data.map((item, i) => {
                const amt = amounts[i] ?? 0;
                const h = amt > 0 ? Math.max(4, (amt / maxVal) * chartH) : 0;
                const x = margin.left + i * barSlot + (barSlot - barW) / 2;
                const y = margin.top + chartH - h;
                return (
                  <g key={item.name}>
                    {h > 0 && (
                      <path
                        d={[
                          `M ${x} ${margin.top + chartH}`,
                          `L ${x} ${y + 10}`,
                          `Q ${x} ${y} ${x + 10} ${y}`,
                          `L ${x + barW - 10} ${y}`,
                          `Q ${x + barW} ${y} ${x + barW} ${y + 10}`,
                          `L ${x + barW} ${margin.top + chartH}`,
                          'Z',
                        ].join(' ')}
                        fill={`url(#bet-grad-${item.name})`}
                      >
                        <title>{`${item.name}: ${formatLabel(amt)}`}</title>
                      </path>
                    )}
                    {amt > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fill="#374151"
                        fontSize={10}
                      >
                        {formatLabel(amt)}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y={margin.top + chartH + 15}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize={10}
                    >
                      {item.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Box>

          <Box
            sx={{
              flex: '1 1 220px',
              minWidth: 200,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 0.5,
            }}
          >
            {data.map((item, i) => {
              const amt = amounts[i] ?? 0;
              const share = total > 0 ? Math.round((amt / total) * 100) : 0;
              const [c0] = GRADIENTS[item.name] || ['#64748b', '#334155'];
              return (
                <Box
                  key={`legend-${item.name}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 0.75,
                    py: 0.5,
                    bgcolor: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 1,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: c0,
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 10, color: '#667085' }}>
                      {item.name} · {share}%
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                      {formatLabel(amt)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        mt: 0.75,
        bgcolor: '#fff',
        border: '1px solid #dde2e8',
        borderRadius: 1.5,
        boxShadow: '0 2px 6px rgba(15,23,42,0.05)',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen((v) => !v);
                }
              }
            : undefined
        }
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          py: 0.65,
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
          bgcolor: open || !collapsible ? '#f8fafc' : '#fff',
          '&:hover': collapsible ? { bgcolor: '#f8fafc' } : undefined,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Bet Amount Overview
          </Typography>
          {data.length > 0 && (
            <Typography sx={{ fontSize: 11, color: '#667085' }}>
              · Total ₹{formatAmount(total)}
            </Typography>
          )}
        </Box>
        {collapsible ? (
          <IconButton
            size="small"
            aria-label={open ? 'Collapse bet amount overview' : 'Expand bet amount overview'}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            sx={{ p: 0.25, color: '#667085' }}
          >
            {open ? (
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        ) : null}
      </Box>

      {collapsible ? (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {body}
        </Collapse>
      ) : (
        body
      )}
    </Box>
  );
}
