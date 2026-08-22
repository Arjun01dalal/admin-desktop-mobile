import { useCallback, useEffect, useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type TopCasinoGameRow = {
  providerName: string;
  marketName: string;
  playCount: number;
};

function normalizeTopCasinoGames(data: unknown): TopCasinoGameRow[] {
  const raw = data as Record<string, unknown> | unknown[] | null;
  const list =
    (Array.isArray(raw) && raw) ||
    (raw && typeof raw === 'object'
      ? (raw.topCasinoGames as unknown) ||
        (raw.mostPlayedCasino as unknown) ||
        (raw.items as unknown) ||
        (raw.games as unknown) ||
        ((raw.payload as Record<string, unknown> | undefined)?.topCasinoGames as unknown) ||
        ((raw.payload as Record<string, unknown> | undefined)?.items as unknown) ||
        ((raw.payload as Record<string, unknown> | undefined)?.games as unknown)
      : null);

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        providerName: String(
          row.providerName ?? row.provider ?? row.provider_name ?? '',
        ).trim(),
        marketName: String(
          row.marketName ??
            row.market ??
            row.market_name ??
            row.gameName ??
            row.name ??
            '',
        ).trim(),
        playCount:
          Number(row.playCount ?? row.count ?? row.play_count ?? 0) || 0,
      };
    })
    .filter((item) => item.providerName || item.marketName);
}

type Props = {
  userId: string;
};

/** Top casino games for a user — `/User/top-casino-games`. */
export function TopCasinoGamesSection({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TopCasinoGameRow[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await secureApi('userReport.topCasinoGames', { userId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load top casino games');
        setRows([]);
        return;
      }
      setRows(normalizeTopCasinoGames(res.data));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<TopCasinoGameRow>[]>(
    () => [
      {
        id: 'sr',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'providerName',
        label: 'Provider Name',
        render: (row) => toDisplayText(row.providerName || '—'),
      },
      {
        id: 'marketName',
        label: 'Market Name',
        render: (row) => row.marketName || '—',
      },
      {
        id: 'playCount',
        label: 'Play Count',
        width: 110,
        render: (row) => String(row.playCount),
      },
    ],
    [],
  );

  const summaryText = loading ? 'Loading…' : `${rows.length} games`;

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        sx={{
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? '1px solid' : 'none',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
          <IconButton
            size="small"
            aria-label={open ? 'Collapse top casino games' : 'Expand top casino games'}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            sx={{
              p: 0.25,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {toDisplayText('Top Casino Games')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {summaryText}
        </Typography>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ p: 1.5 }}>
          {loading ? (
            <Stack alignItems="center" py={2}>
              <CircularProgress size={28} />
            </Stack>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No casino game data found.
            </Typography>
          ) : (
            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              <CommonTable
                columns={columns}
                rows={rows}
                getRowKey={(row, index) =>
                  `${row.providerName}-${row.marketName}-${index}`
                }
                dense
                minWidth={520}
                paper={false}
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
