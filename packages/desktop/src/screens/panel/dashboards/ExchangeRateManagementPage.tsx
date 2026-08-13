import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { todayIST } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type MarketRow = {
  marketName?: string;
  marketPL?: number;
  settleDateTime?: string;
};

type GameCard = {
  gameId?: string | number;
  gameName?: string;
  tournamentName?: string;
  markets?: MarketRow[];
  pl?: number;
};

/**
 * AAA exchange game-wise P/L — ported from laxminarayan ExchangeRateManagement
 * settled-market view (`gameWisePlusMinus` → Object.entries).
 */
export function ExchangeRateManagementPage() {
  const [params] = useSearchParams();
  const startDate = params.get('startDate') || todayIST();
  const endDate = params.get('endDate') || todayIST();

  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<Array<[string, GameCard]>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('dashboard.aaaGameWise', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load AAA exchange data');
        setGames([]);
        return;
      }
      const raw = res.data;
      // Laxmi: Object.entries(oldExchData) where each value is a game card.
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw as Record<string, unknown>)
          .filter(
            ([, v]) => v && typeof v === 'object' && !Array.isArray(v),
          )
          .map(([k, v]) => [k, v as GameCard] as [string, GameCard]);
        setGames(entries);
        return;
      }
      if (Array.isArray(raw)) {
        setGames(
          (raw as GameCard[]).map((g, i) => [
            String(g.gameId ?? i),
            g,
          ]),
        );
        return;
      }
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        gap={1}
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} mb={0.5}>
            {toDisplayText('AAA Exchange')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {startDate} → {endDate}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && games.length === 0 && (
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">No AAA exchange data</Typography>
        </Paper>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {games.map(([matchKey, game]) => {
          const gameId = String(game.gameId ?? matchKey);
          const markets = Array.isArray(game.markets) ? game.markets : [];
          const isOpen = Boolean(expanded[gameId]);
          const marketsToShow = isOpen ? markets : markets.slice(0, 3);
          const pl = Number(game.pl ?? 0);

          return (
            <Paper key={gameId} sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Box
                sx={{
                  bgcolor: 'action.hover',
                  textAlign: 'center',
                  py: 1,
                  px: 1,
                  mb: 1.5,
                  borderRadius: 1,
                }}
              >
                <Typography variant="subtitle1" fontWeight={800}>
                  {String(game.gameName || matchKey)}
                </Typography>
                {game.tournamentName ? (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Tournament:{' '}
                    <Box component="span" fontWeight={700} color="text.primary">
                      {String(game.tournamentName)}
                    </Box>
                  </Typography>
                ) : null}
              </Box>

              <Stack spacing={1}>
                {marketsToShow.map((mkt, i) => {
                  const marketPl = Number(mkt.marketPL ?? 0);
                  return (
                    <Box
                      key={`${gameId}-mkt-${i}`}
                      sx={{
                        bgcolor: 'action.selected',
                        borderRadius: 1,
                        p: 1.25,
                      }}
                    >
                      <Typography variant="body2" fontWeight={700}>
                        Market Name:{' '}
                        <Box component="span" fontWeight={800}>
                          {String(mkt.marketName || '—')}
                        </Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Market Profit/Loss:{' '}
                        <Box
                          component="span"
                          fontWeight={800}
                          sx={{ color: marketPl >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {marketPl.toFixed(2)}
                        </Box>
                      </Typography>
                      {mkt.settleDateTime ? (
                        <Typography variant="caption" color="text.secondary">
                          Settled On:{' '}
                          {new Date(mkt.settleDateTime).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}

                {markets.length > 4 && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [gameId]: !isOpen,
                      }))
                    }
                  >
                    {isOpen
                      ? 'Show Less ↑'
                      : `Show More (${markets.length - 3}) ↓`}
                  </Button>
                )}

                <Typography
                  variant="body2"
                  fontWeight={800}
                  textAlign="center"
                  mt={0.5}
                >
                  Total Game P/L:{' '}
                  <Box
                    component="span"
                    sx={{
                      color: pl >= 0 ? 'success.main' : 'error.main',
                      fontSize: 16,
                    }}
                  >
                    {pl.toFixed(2)}
                  </Box>
                </Typography>
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
