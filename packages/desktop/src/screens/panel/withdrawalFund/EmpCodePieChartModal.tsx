import { useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { CountRow } from './getWithdrawalSummaryByEmpCode';

type DateFilterProps = {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  empCodeRows: CountRow[];
  agentRows: CountRow[];
  dateFilter: DateFilterProps;
};

type ChartKind = 'emp' | 'agents';

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

function buildConicGradient(rows: CountRow[]): string {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total <= 0) return '#424242';
  let cursor = 0;
  const parts: string[] = [];
  rows.forEach((row, i) => {
    const start = (cursor / total) * 360;
    cursor += row.count;
    const end = (cursor / total) * 360;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    parts.push(`${color} ${start}deg ${end}deg`);
  });
  return `conic-gradient(from -90deg, ${parts.join(', ')})`;
}

function Pie3D({ rows }: { rows: CountRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const gradient = useMemo(() => buildConicGradient(rows), [rows]);

  if (total <= 0) {
    return (
      <Box
        sx={{
          height: 280,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
          No data for selected dates
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        height: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '900px',
      }}
    >
      {/* Ground shadow */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 28,
          width: 220,
          height: 36,
          borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.35)',
          filter: 'blur(10px)',
          transform: 'translateY(8px)',
        }}
      />

      {/* 3D stack: rim + face */}
      <Box
        sx={{
          position: 'relative',
          width: 240,
          height: 240,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(58deg)',
        }}
      >
        {/* Thickness layers for 3D depth */}
        {Array.from({ length: 14 }).map((_, i) => (
          <Box
            key={`rim-${i}`}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: gradient,
              filter: 'brightness(0.72)',
              transform: `translateZ(${-i}px)`,
              opacity: i === 13 ? 0.95 : 1,
            }}
          />
        ))}
        {/* Top face */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: gradient,
            boxShadow: 'inset 0 0 24px rgba(0,0,0,0.25)',
            transform: 'translateZ(1px)',
            border: '2px solid rgba(255,255,255,0.12)',
          }}
        />
        {/* Inner hole hint (donut look optional — solid pie keeps center) */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 54,
            height: 54,
            ml: '-27px',
            mt: '-27px',
            borderRadius: '50%',
            bgcolor: 'background.paper',
            transform: 'translateZ(2px)',
            boxShadow: '0 0 0 3px rgba(0,0,0,0.2)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1.1, textAlign: 'center' }}>
            {total}
            <Box
              component="span"
              sx={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'text.secondary' }}
            >
              total
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Legend({ rows }: { rows: CountRow[] }) {
  const total = Math.max(
    1,
    rows.reduce((s, r) => s + r.count, 0),
  );
  if (!rows.length) return null;
  return (
    <Box
      sx={{
        maxHeight: 280,
        overflowY: 'auto',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {rows.map((row, i) => {
        const pct = Math.round((row.count / total) * 1000) / 10;
        return (
          <Stack
            key={`${row.name}-${i}`}
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: i < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600 }} noWrap title={row.name}>
              {row.name}
            </Typography>
            <Typography
              sx={{ fontSize: 12, color: 'text.secondary', minWidth: 44, textAlign: 'right' }}
            >
              {pct}%
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800, minWidth: 36, textAlign: 'right' }}>
              {row.count}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

/** Current-month (or custom range) Emp / Agent 3D pie chart for Withdrawal Fund. */
export function EmpCodePieChartModal({
  open,
  onClose,
  title = 'Current Month Chart',
  subtitle,
  loading = false,
  empCodeRows,
  agentRows,
  dateFilter,
}: Props) {
  const [tab, setTab] = useState<ChartKind>('emp');

  useEffect(() => {
    if (open) setTab('emp');
  }, [open]);

  const rows = tab === 'emp' ? empCodeRows : agentRows;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        },
      }}
    >
      <DialogTitle
        sx={{
          py: 1.75,
          px: 2.5,
          pr: 6,
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,159,10,0.12) 0%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(255,159,10,0.14) 0%, #fff 100%)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <PieChartOutlineIcon sx={{ color: '#ff9f0a' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>{title}</Typography>
        </Stack>
        {subtitle ? (
          <Typography sx={{ mt: 0.5, ml: 4, fontSize: 12.5, color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        ) : null}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          disabled={loading}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'text.secondary',
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2.25 }}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="flex-end"
          flexWrap="wrap"
          useFlexGap
          mt={0.5}
          mb={2}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={dateFilter.startDate}
            onChange={(e) => dateFilter.onStartChange(e.target.value)}
            disabled={loading}
            sx={{ ...fieldSx, width: 180, minWidth: 180 }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={dateFilter.endDate}
            onChange={(e) => dateFilter.onEndChange(e.target.value)}
            disabled={loading}
            sx={{ ...fieldSx, width: 180, minWidth: 180 }}
          />
          <Button
            variant="contained"
            disabled={loading || !dateFilter.startDate || !dateFilter.endDate}
            onClick={() => dateFilter.onApply()}
            sx={orangeBtnSx}
          >
            Apply
          </Button>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_e, v: ChartKind) => setTab(v)}
          sx={{
            mb: 2,
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
            },
            '& .Mui-selected': { color: '#ff9f0a !important' },
            '& .MuiTabs-indicator': { bgcolor: '#ff9f0a' },
          }}
        >
          <Tab value="emp" label={`Emp codes (${empCodeRows.length})`} />
          <Tab value="agents" label={`Agents (${agentRows.length})`} />
        </Tabs>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" py={8} spacing={1.5}>
            <CircularProgress size={36} sx={{ color: '#ff9f0a' }} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Loading chart…</Typography>
          </Stack>
        ) : (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box sx={{ flex: 1.1, minWidth: 0 }}>
              <Pie3D rows={rows} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1 }}>
                {tab === 'emp' ? 'Emp code share' : 'Agent share'}
              </Typography>
              <Legend rows={rows} />
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 1.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          disabled={loading}
          sx={{ ...orangeBtnSx, minWidth: 110 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
