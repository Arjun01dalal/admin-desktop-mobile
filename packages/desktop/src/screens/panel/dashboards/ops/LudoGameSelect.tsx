/**
 * Ludo / Lagna game select — laxminarayan Dashboard table menu:
 * closed: "All (ggr)"; open: Game | Players | Bet | Win | RTP | GGR.
 */
import { Box, MenuItem, TextField, Typography } from '@mui/material';
import { toDisplayText } from './constants';
import type { SelectOption } from './types';

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

const GRID =
  'minmax(72px, 1.25fr) minmax(44px, 0.75fr) minmax(48px, 0.9fr) minmax(48px, 0.9fr) minmax(40px, 0.7fr) minmax(48px, 0.85fr)';

function Cell({
  children,
  header,
  align = 'left',
  ggr,
}: {
  children: React.ReactNode;
  header?: boolean;
  align?: 'left' | 'right';
  ggr?: number;
}) {
  const isGgr = typeof ggr === 'number';
  return (
    <Typography
      component="span"
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: align,
        fontVariantNumeric: 'tabular-nums',
        fontSize: 12,
        fontWeight: header ? 700 : isGgr ? 700 : 500,
        color: isGgr ? (ggr < 0 ? 'error.main' : 'success.main') : 'inherit',
        textDecoration: isGgr ? 'underline' : 'none',
      }}
    >
      {children}
    </Typography>
  );
}

function OptionRow({
  name,
  stats,
  header,
}: {
  name: string;
  stats?: LudoSelectStats | { uniquePlayers: string; bet: string; win: string; rtp: string; ggr: string };
  header?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID,
        columnGap: 0.75,
        width: '100%',
        alignItems: 'center',
      }}
    >
      <Cell header={header}>{name}</Cell>
      <Cell header={header} align="right">
        {stats ? stats.uniquePlayers : '—'}
      </Cell>
      <Cell header={header} align="right">
        {stats ? stats.bet : '—'}
      </Cell>
      <Cell header={header} align="right">
        {stats ? stats.win : '—'}
      </Cell>
      <Cell header={header} align="right">
        {stats ? stats.rtp : '—'}
      </Cell>
      <Cell
        header={header}
        align="right"
        ggr={
          !header && stats && typeof stats.ggr === 'number' ? stats.ggr : undefined
        }
      >
        {stats ? stats.ggr : '—'}
      </Cell>
    </Box>
  );
}

export function LudoGameSelect({ value, options, statsMap, onChange }: Props) {
  const selectedLabel =
    value === 'All'
      ? 'All'
      : options.find((o) => o.value === value)?.label || value;
  const selectedStats = statsMap?.[value];

  return (
    <TextField
      select
      size="small"
      value={value || 'All'}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value);
      }}
      SelectProps={{
        renderValue: () => (
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              maxWidth: '100%',
              overflow: 'hidden',
              gap: 0.75,
            }}
          >
            <Typography
              component="span"
              noWrap
              sx={{ fontSize: 13, fontWeight: 600 }}
            >
              {toDisplayText(selectedLabel)}
            </Typography>
            {selectedStats ? (
              <Typography
                component="span"
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    selectedStats.ggr < 0 ? 'error.main' : 'success.main',
                  flexShrink: 0,
                }}
              >
                ({selectedStats.ggr})
              </Typography>
            ) : null}
          </Box>
        ),
        MenuProps: {
          PaperProps: {
            sx: {
              width: 'min(580px, calc(100vw - 32px))',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 360,
            },
          },
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
        },
      }}
      sx={{
        minWidth: { xs: '100%', sm: 168 },
        maxWidth: '100%',
        flex: { xs: '1 1 100%', sm: '0 1 auto' },
        '& .MuiInputBase-root': {
          bgcolor: 'background.default',
          borderRadius: 1,
        },
      }}
    >
      <MenuItem
        disabled
        value="__header__"
        sx={{
          opacity: '1 !important',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pointerEvents: 'none',
          py: 0.75,
          bgcolor: 'action.hover',
          width: '100%',
        }}
      >
        <OptionRow
          header
          name="Game"
          stats={{
            uniquePlayers: 'Players',
            bet: 'Bet',
            win: 'Win',
            rtp: 'RTP',
            ggr: 'GGR',
          }}
        />
      </MenuItem>
      {options.map((opt) => {
        const stats = statsMap?.[opt.value];
        const selected = (value || 'All') === opt.value;
        return (
          <MenuItem
            key={opt.value}
            value={opt.value}
            sx={{
              py: 0.75,
              width: '100%',
              bgcolor: selected ? 'action.selected' : undefined,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <OptionRow name={toDisplayText(opt.label)} stats={stats} />
          </MenuItem>
        );
      })}
    </TextField>
  );
}
