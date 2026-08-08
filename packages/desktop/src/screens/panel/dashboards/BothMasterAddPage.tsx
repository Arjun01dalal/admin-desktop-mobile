import { useEffect, useState } from 'react';
import { Box, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { secureApi } from '@/api/secureClient';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from './ops/jyotishMapping';

type TeamTotals = {
  team: string;
  MATCH_ODDS: number;
  Bookmaker: number;
  BookmakerAndMatchOdds: number;
  total: number;
};

type MatchTotals = {
  match: string;
  teams: TeamTotals[];
};

function normalize(name: string) {
  return name.trim().toLowerCase();
}

function calculateTeamWiseTotals(obj1: unknown[], obj2: unknown[]): MatchTotals[] {
  const result: MatchTotals[] = [];
  const validMarkets = ['MATCH_ODDS', 'Bookmaker', 'BookmakerAndMatchOdds'];

  obj1.forEach((game1Raw) => {
    const game1 = game1Raw as {
      game?: { gameName?: string };
      markets?: Array<{
        marketName?: string;
        riskData?: Array<{ runner?: string; pl?: number }>;
      }>;
    };
    const matchName = game1?.game?.gameName;
    if (!matchName) return;

    const game2 = obj2.find((g) => {
      const row = g as { game?: { gameName?: string } };
      return row?.game?.gameName === matchName;
    }) as typeof game1 | undefined;
    if (!game2) return;

    const teamMap: Record<string, TeamTotals> = {};

    const processMarkets = (
      markets: Array<{
        marketName?: string;
        riskData?: Array<{ runner?: string; pl?: number }>;
      }> = [],
    ) => {
      markets.forEach((market) => {
        const marketName = market.marketName || '';
        if (!validMarkets.includes(marketName)) return;
        market.riskData?.forEach((runner) => {
          const key = normalize(String(runner.runner || ''));
          if (!teamMap[key]) {
            teamMap[key] = {
              team: String(runner.runner || ''),
              MATCH_ODDS: 0,
              Bookmaker: 0,
              BookmakerAndMatchOdds: 0,
              total: 0,
            };
          }
          const bucket = marketName as keyof Pick<
            TeamTotals,
            'MATCH_ODDS' | 'Bookmaker' | 'BookmakerAndMatchOdds'
          >;
          teamMap[key][bucket] += Number(runner.pl || 0);
        });
      });
    };

    processMarkets(game1.markets);
    processMarkets(game2.markets);

    Object.values(teamMap).forEach((team) => {
      team.total =
        team.MATCH_ODDS + team.Bookmaker + team.BookmakerAndMatchOdds;
    });

    result.push({
      match: matchName,
      teams: Object.values(teamMap),
    });
  });

  return result;
}

function unpackList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.payload)) return obj.payload;
    if (Array.isArray(obj.result)) return obj.result;
  }
  return [];
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <Box display="flex" justifyContent="space-between" mb={1}>
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        color={value >= 0 ? 'success.main' : 'error.main'}
      >
        {Number(value).toFixed(2)}
      </Typography>
    </Box>
  );
}

/**
 * AAA & Master AAA combined risk — ported from laxminarayan BothMasterAddPage.
 */
export function BothMasterAddPage() {
  useRevealCodes();
  const [loading, setLoading] = useState(true);
  const [commonData, setCommonData] = useState<MatchTotals[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [res1, res2] = await Promise.all([
          secureApi('dashboard.zehnRiskOs', {}),
          secureApi('dashboard.zehnRiskVip', {}),
        ]);
        if (!mounted) return;
        const data1 = unpackList(res1.data);
        const data2 = unpackList(res2.data);
        setCommonData(calculateTeamWiseTotals(data1, data2));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {toDisplayText('Live Match Total (AAA & Master AAA)')}
      </Typography>

      {loading ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      ) : (
        <Grid container spacing={2}>
          {commonData.map((matchItem, index) => {
            const team1 = matchItem.teams[0];
            const team2 = matchItem.teams[1];
            if (!team1 || !team2) return null;
            return (
              <Grid item xs={12} sm={6} md={4} key={`${matchItem.match}-${index}`}>
                <Paper sx={{ p: 2, bgcolor: '#1a1a1f', height: '100%' }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={800}
                    align="center"
                    sx={{
                      mb: 2,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      py: 1,
                      borderRadius: 1,
                    }}
                  >
                    {matchItem.match}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={700} mb={1}>
                      BOOKMAKER
                    </Typography>
                    <Row label={`${team1.team}:`} value={team1.Bookmaker} />
                    <Row label={`${team2.team}:`} value={team2.Bookmaker} />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={700} mb={1}>
                      MATCH ODDS
                    </Typography>
                    <Row label={`${team1.team}:`} value={team1.MATCH_ODDS} />
                    <Row label={`${team2.team}:`} value={team2.MATCH_ODDS} />
                  </Box>

                  <Box>
                    <Typography fontWeight={700} mb={1}>
                      TOTAL
                    </Typography>
                    <Row label={`${team1.team}:`} value={team1.total} />
                    <Row label={`${team2.team}:`} value={team2.total} />
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
