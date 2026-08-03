import { Box, Typography } from '@mui/material';
import { formatAmount } from '@/utils/dates';

export type BarItem = { name: string; amount: number };

const GRADIENTS: Record<string, [string, string]> = {
  CASINO: ['#3b82f6', '#1e40af'],
  EXCHANGE: ['#9ca3af', '#6b7280'],
  SATTAMATKA: ['#ef4444', '#991b1b'],
};

type Props = { data: BarItem[] };

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

/** Bet Amount Overview — matches Laxmi recharts chart. */
export function BetAmountBars({ data }: Props) {
  const width = 720;
  const height = 280;
  const margin = { top: 32, right: 24, left: 56, bottom: 52 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const amounts = data.map((d) => {
    const n = Number(d.amount);
    return Number.isFinite(n) ? n : 0;
  });
  const rawMax = Math.max(0, ...amounts);
  const maxVal = niceMax(rawMax);
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => t * maxVal);
  const barSlot = data.length ? chartW / data.length : chartW;
  const barW = Math.min(56, Math.max(28, barSlot * 0.35));

  return (
    <Box
      sx={{
        mt: 1,
        p: 2,
        bgcolor: '#f9fafb',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
        width: '100%',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 16, md: 18 },
          fontWeight: 600,
          mb: 1,
          color: '#374151',
        }}
      >
        Bet Amount Overview
      </Typography>

      {data.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          No bet data
        </Typography>
      ) : (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 420, width: '100%' }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height={280}
              role="img"
              aria-label="Bet amount overview"
            >
              <defs>
                {data.map((entry) => {
                  const [c0, c1] =
                    GRADIENTS[entry.name] || ['#64748b', '#334155'];
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

              {/* Baseline */}
              <line
                x1={margin.left}
                x2={margin.left + chartW}
                y1={margin.top + chartH}
                y2={margin.top + chartH}
                stroke="#d1d5db"
                strokeWidth={1}
              />

              {/* Y ticks (no full grid — matches Laxmi) */}
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
                      fontSize={11}
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
                        fontSize={11}
                      >
                        {formatLabel(amt)}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y={margin.top + chartH + 16}
                      textAnchor="end"
                      fill="#6b7280"
                      fontSize={12}
                      transform={`rotate(-25 ${x + barW / 2} ${margin.top + chartH + 16})`}
                    >
                      {item.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Box>
        </Box>
      )}
    </Box>
  );
}
