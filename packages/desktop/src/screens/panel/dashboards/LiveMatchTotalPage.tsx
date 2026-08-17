import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import SearchIcon from '@mui/icons-material/Search';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { todayIST } from '@/utils/dates';
import { LiveStreamModal } from './LiveStreamModal';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from './ops/jyotishMapping';

export type LiveMatchVariant = 'laxmi' | 'master' | 'both';

type OddsCell = { price: string | number; size: string | number };
type FancyMarket = {
  marketName?: string;
  betSize?: unknown;
  result?: unknown;
  data: Record<string, number>;
};
type MarketBook = {
  marketName?: string;
  betSize?: unknown;
  result?: unknown;
  data: Record<string, number>;
};
type MatchRow = {
  matchName: string;
  sportName: string;
  teams: Record<string, number>;
  marketList?: MarketBook[];
  marketName?: string;
  fancy: FancyMarket[];
  betSize?: unknown;
  oddsTeams?: OddsCell[];
  code?: string;
};

const BOOK_ACTION: Record<LiveMatchVariant, SecureAction> = {
  laxmi: 'dashboard.finalBookLaxmi',
  master: 'dashboard.finalBookVip',
  both: 'dashboard.finalBookBoth',
};

const TITLES: Record<LiveMatchVariant, string> = {
  laxmi: 'Live Match Total',
  master: 'Live Match Total (Master)',
  both: 'Live Match Total (Master & Laxmi)',
};

type Props = { variant?: LiveMatchVariant };

function getBg(index: number) {
  return index % 2 === 0
    ? 'radial-gradient(#1d4665,#1b262e)'
    : 'radial-gradient(#90101a,#4e070c)';
}

function buildRunnerUI(input: unknown): Array<{
  eventName?: string;
  data: OddsCell[];
  code?: string;
}> {
  const matches = Array.isArray(input) ? input : [input];
  const build = (p: { price?: unknown; size?: unknown } | undefined) => ({
    price: (p?.price as string | number) ?? '-',
    size: (p?.size as string | number) ?? '-',
  });

  return matches.map((match) => {
    const m = (match || {}) as {
      eventName?: string;
      code?: string;
      runners?: Array<{
        backPrices?: Array<{ price?: unknown; size?: unknown }>;
        layPrices?: Array<{ price?: unknown; size?: unknown }>;
      }>;
    };
    const runners = m.runners ?? [];
    if (runners.length === 0) {
      return { eventName: m.eventName, data: [], code: m.code };
    }
    const get = (i: number, type: 'back' | 'lay') =>
      build(runners?.[i]?.[`${type}Prices`]?.[0]);

    const data =
      runners.length >= 3
        ? [
            get(0, 'back'),
            get(0, 'lay'),
            get(2, 'back'),
            get(2, 'lay'),
            get(1, 'back'),
            get(1, 'lay'),
          ]
        : [
            get(0, 'back'),
            get(0, 'lay'),
            { price: '-', size: '-' },
            { price: '-', size: '-' },
            get(1, 'back'),
            get(1, 'lay'),
          ];

    return { eventName: m.eventName, data, code: m.code };
  });
}

function normalizeMarketName(name: unknown): string {
  return String(name || '').toLowerCase().trim();
}

function mergeLaxmiMarketBooks(
  markets: Array<{
    marketName?: string;
    betSize?: unknown;
    result?: unknown;
    riskData?: Array<{ runner?: string; pl?: number }>;
  }>,
): MarketBook[] {
  const riskToMap = (
    riskData: Array<{ runner?: string; pl?: number }> | undefined,
  ): Record<string, number> => {
    const map: Record<string, number> = {};
    (riskData || []).forEach((risk) => {
      const key = risk?.runner;
      if (key == null || key === '') return;
      // The reference keeps each API market's latest runner PL as-is.
      map[key] = Number(risk.pl || 0);
    });
    return map;
  };

  const addInto = (
    target: Record<string, number>,
    source: Record<string, number>,
  ) => {
    Object.entries(source).forEach(([runner, pl]) => {
      const existingKey = Object.keys(target).find(
        (key) => normalizeMarketName(key) === normalizeMarketName(runner),
      );
      if (existingKey) {
        target[existingKey] = Number(target[existingKey] || 0) + Number(pl || 0);
      } else {
        target[runner] = Number(pl || 0);
      }
    });
  };

  const withoutToss = markets.filter(
    (market) => normalizeMarketName(market.marketName) !== 'toss',
  );
  const finalBook = withoutToss.find(
    (market) => normalizeMarketName(market.marketName) === 'final book',
  );
  const matchOdds = withoutToss.filter((market) => {
    const name = normalizeMarketName(market.marketName);
    return name === 'match odds' || name.endsWith('match odds');
  });
  const others = withoutToss.filter((market) => {
    const name = normalizeMarketName(market.marketName);
    return (
      name !== 'final book' &&
      name !== 'match odds' &&
      !name.endsWith('match odds')
    );
  });

  const marketList: MarketBook[] = [];
  if (finalBook || matchOdds.length) {
    const mergedData = riskToMap(finalBook?.riskData);
    let mergedBetSize = Number(finalBook?.betSize || 0);
    matchOdds.forEach((market) => {
      addInto(mergedData, riskToMap(market.riskData));
      mergedBetSize += Number(market.betSize || 0);
    });
    marketList.push({
      marketName: finalBook?.marketName || 'Final Book',
      betSize: mergedBetSize || finalBook?.betSize || matchOdds[0]?.betSize,
      result: finalBook?.result ?? '',
      data: mergedData,
    });
  }

  others.forEach((market) => {
    marketList.push({
      marketName: market.marketName,
      betSize: market.betSize,
      result: market.result,
      data: riskToMap(market.riskData),
    });
  });
  return marketList;
}

function formatDataForUI(data: unknown, variant: LiveMatchVariant): MatchRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = item as {
      game?: { gameName?: string; sportName?: string };
      markets?: Array<{
        marketType?: string;
        marketName?: string;
        betSize?: unknown;
        result?: unknown;
        riskData?: Array<{ runner?: string; pl?: number }>;
      }>;
    };
    const matchName = String(row?.game?.gameName || '');
    const sportRaw = String(row?.game?.sportName || '').trim();
    // Master keeps the raw sport name; Laxmi/Both coerce blanks to "Other".
    const sportName =
      variant === 'master'
        ? String(row?.game?.sportName || '')
        : sportRaw.length > 0
          ? sportRaw
          : 'Other';
    const result: MatchRow = {
      matchName,
      sportName,
      teams: {},
      fancy: [],
    };

    if (variant === 'laxmi') {
      const marketBooks = (row.markets || []).filter(
        (market) => market.marketType === 'MARKET',
      );
      result.marketList = mergeLaxmiMarketBooks(marketBooks);
      const preferred = result.marketList[0];
      if (preferred) {
        result.teams = { ...preferred.data };
        result.betSize = preferred.betSize;
        result.marketName = preferred.marketName;
      }
    }

    row?.markets?.forEach((market) => {
      if (variant !== 'laxmi' && market.marketType === 'MARKET') {
        market?.riskData?.forEach((r) => {
          const team = String(r.runner || '').toLowerCase();
          result.teams[team] = (result.teams[team] || 0) + Number(r.pl || 0);
        });
      }
      if (market.marketType === 'FANCY') {
        const fancyObj: FancyMarket = {
          marketName: market.marketName,
          betSize: market?.betSize,
          result: market?.result,
          data: {},
        };
        market?.riskData?.forEach((r) => {
          const key = String(r.runner || '');
          if (!key) return;
          if (variant === 'laxmi') fancyObj.data[key] = Number(r.pl || 0);
          else fancyObj.data[key] = (fancyObj.data[key] || 0) + Number(r.pl || 0);
        });
        result.fancy.push(fancyObj);
      }
      if (variant !== 'laxmi') result.betSize = market?.betSize;
    });

    return result;
  });
}

function mergeFinalData(
  finalRes: MatchRow[],
  matches: Array<{ eventName?: string; data: OddsCell[]; code?: string }>,
): MatchRow[] {
  return finalRes.map((match) => {
    const found = matches.find(
      (m) =>
        String(m.eventName || '').toLowerCase() ===
        String(match.matchName || '').toLowerCase(),
    );
    return {
      ...match,
      oddsTeams:
        found?.data ||
        Array(6).fill({ price: '-', size: '-' }) as OddsCell[],
      code: found?.code,
    };
  });
}

function groupBySport(data: MatchRow[]): Record<string, MatchRow[]> {
  return data.reduce<Record<string, MatchRow[]>>((acc, item) => {
    const sport = item?.sportName ?? '';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(item);
    return acc;
  }, {});
}

function sortSports(
  grouped: Record<string, MatchRow[]>,
): Array<[string, MatchRow[]]> {
  return Object.entries(grouped).sort(([a], [b]) => {
    const A = a.toLowerCase();
    const B = b.toLowerCase();
    if (A === 'cricket') return -1;
    if (B === 'cricket') return 1;
    if (A === 'other') return 1;
    if (B === 'other') return -1;
    return A.localeCompare(B);
  });
}

function getClosestKey(
  data: Record<string, number>,
  result: unknown,
): number | null {
  if (result === '' || result == null) return null;
  const keys = Object.keys(data).map(Number);
  if (Object.prototype.hasOwnProperty.call(data, String(result))) {
    return Number(result);
  }
  if (keys.length === 0) return null;
  return keys.reduce((prev, curr) =>
    Math.abs(curr - Number(result)) < Math.abs(prev - Number(result))
      ? curr
      : prev,
  );
}

function unpackBookList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.payload)) return obj.payload;
    if (Array.isArray(obj.result)) return obj.result;
  }
  return [];
}

/**
 * Live Match Total books — ported from laxminarayan LiveMatchTotal /
 * MasterLiveMatchTotal / BothLiveMatchTotal.
 */
export function LiveMatchTotalPage({ variant = 'laxmi' }: Props) {
  useRevealCodes();
  const location = useLocation();
  const navState = (location.state || {}) as {
    startDate?: string;
    endDate?: string;
  };
  const initialStart = navState.startDate || todayIST();
  const initialEnd = navState.endDate || todayIST();

  const orderRef = useRef<string[]>([]);
  const firstLoad = useRef(true);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupedData, setGroupedData] = useState<Array<[string, MatchRow[]]>>(
    [],
  );
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [streamId, setStreamId] = useState('');
  const [streamOpen, setStreamOpen] = useState(false);

  const applyDates = useCallback(() => {
    if (!draftStart || !draftEnd) {
      toast.error('Please select both dates');
      return;
    }
    if (draftStart > draftEnd) {
      toast.error('From date cannot be after To date');
      return;
    }
    firstLoad.current = true;
    orderRef.current = [];
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }, [draftEnd, draftStart]);

  const filteredGroupedData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groupedData;
    return groupedData
      .map(([sport, matches]) => {
        const filtered = matches.filter((match) =>
          String(match.matchName || '')
            .toLowerCase()
            .includes(query),
        );
        return [sport, filtered] as [string, MatchRow[]];
      })
      .filter(([, matches]) => matches.length > 0);
  }, [groupedData, searchQuery]);

  const fetchAllData = useCallback(async () => {
    try {
      if (firstLoad.current) setLoading(true);

      let matches: Array<{
        eventName?: string;
        data: OddsCell[];
        code?: string;
      }> = [];
      try {
        const oddsRes = await secureApi('dashboard.oddsGameList', {});
        if (oddsRes.ok) {
          const oddsRaw = oddsRes.data;
          const oddsList =
            oddsRaw && typeof oddsRaw === 'object' && !Array.isArray(oddsRaw)
              ? ((oddsRaw as { data?: unknown }).data ?? oddsRaw)
              : oddsRaw;
          matches = buildRunnerUI(oddsList);
        }
      } catch {
        matches = [];
      }

      const bookRes = await secureApi(BOOK_ACTION[variant], {
        startDate,
        endDate,
      });
      if (!bookRes.ok) {
        const msg = bookRes.message || 'Failed to load live match book';
        setError(msg);
        if (firstLoad.current) toast.error(msg);
        setGroupedData([]);
        return;
      }

      const finalBook = formatDataForUI(unpackBookList(bookRes.data), variant);

      // Master filters book rows to odds gameList when odds are available.
      let bookForMerge = finalBook;
      let oddsForMerge = matches;
      if (variant === 'master') {
        const normalize = (value: string) => value.toLowerCase().trim();
        const bookMatchSet = new Set(
          finalBook.map((item) => normalize(item.matchName)),
        );
        const filteredMatches = matches.filter((match) =>
          bookMatchSet.has(normalize(String(match.eventName || ''))),
        );
        bookForMerge =
          matches.length === 0
            ? finalBook
            : finalBook.filter((book) =>
                filteredMatches.some(
                  (match) =>
                    normalize(String(match.eventName || '')) ===
                    normalize(book.matchName),
                ),
              );
        oddsForMerge = matches.length === 0 ? [] : filteredMatches;
      }

      const merged = mergeFinalData(bookForMerge, oddsForMerge);

      if (firstLoad.current) {
        orderRef.current = merged.map((m) => m.matchName);
      } else if (variant === 'master') {
        merged.forEach((match) => {
          if (!orderRef.current.includes(match.matchName)) {
            orderRef.current.push(match.matchName);
          }
        });
      }

      const stableSorted = [...merged].sort(
        (a, b) =>
          orderRef.current.indexOf(a.matchName) -
          orderRef.current.indexOf(b.matchName),
      );

      if (variant === 'master') {
        orderRef.current = orderRef.current.filter((name) =>
          stableSorted.some((match) => match.matchName === name),
        );
      }

      setError('');
      setGroupedData(sortSports(groupBySport(stableSorted)));
      firstLoad.current = false;
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate, variant]);

  useEffect(() => {
    let mounted = true;
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const loop = async () => {
      if (!mounted) return;
      try {
        await fetchAllData();
      } catch {
        /* ignore poll errors */
      }
      await delay(variant === 'laxmi' ? 4000 : 1000);
      if (mounted) void loop();
    };
    void loop();
    return () => {
      mounted = false;
    };
  }, [fetchAllData]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        {toDisplayText(TITLES[variant])}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {startDate} → {endDate}
      </Typography>

      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="nowrap"
        mb={2}
        sx={{ overflowX: 'auto', pt: 1, pb: 0.5 }}
      >
        <TextField
          label="From Date"
          type="date"
          size="small"
          value={draftStart}
          onChange={(e) => setDraftStart(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160, flexShrink: 0 }}
        />
        <TextField
          label="To Date"
          type="date"
          size="small"
          value={draftEnd}
          onChange={(e) => setDraftEnd(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160, flexShrink: 0 }}
        />
        <Button
          variant="contained"
          color="warning"
          onClick={applyDates}
          disabled={loading && groupedData.length === 0}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Apply
        </Button>
        <TextField
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search match name"
          sx={{ minWidth: 220, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && groupedData.length === 0 && (
        <Box display="flex" justifyContent="center" mt={5}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && groupedData.length === 0 && !error && (
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No live match book data for this date range.
          </Typography>
        </Paper>
      )}

      {!loading &&
        groupedData.length > 0 &&
        filteredGroupedData.length === 0 &&
        searchQuery.trim() && (
          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography color="text.secondary">
              No matches found for “{searchQuery.trim()}”.
            </Typography>
          </Paper>
        )}

      {filteredGroupedData.length > 0 && (
        <Grid container spacing={2}>
          {filteredGroupedData.map(([sport, matches]) => (
            <Grid item xs={12} key={sport}>
              <Accordion defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}
                >
                  <Typography fontWeight="bold" fontSize={18}>
                    {sport || 'Other'}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {matches.map((match, index) => (
                      <Grid
                        item
                        xs={12}
                        sm={6}
                        lg={4}
                        key={`${match.matchName}-${match.code || index}`}
                      >
                        <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                          <Typography
                            variant="h6"
                            align="center"
                            fontWeight="bold"
                            sx={{
                              mb: 2,
                              bgcolor: 'rgba(255,255,255,0.08)',
                              fontSize: 15,
                              py: 1,
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              px: 2,
                            }}
                          >
                            {match.matchName}
                            <Box
                              component="span"
                              onClick={() => {
                                setStreamId(String(match.code || ''));
                                setStreamOpen(true);
                              }}
                              sx={{ cursor: 'pointer', display: 'inline-flex' }}
                            >
                              <LiveTvIcon sx={{ fontSize: 20, color: 'error.main' }} />
                            </Box>
                          </Typography>

                          <Box mb={2}>
                            <Box display="flex" gap={0.5} mb={0.5}>
                              {['1', 'X', '2'].map((label) => (
                                <Box key={label} sx={{ flex: 1, textAlign: 'center' }}>
                                  <Typography fontSize={12} fontWeight="bold">
                                    {label}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                            {(() => {
                              const data = match.oddsTeams || [];
                              const group1 = data.slice(0, 2);
                              const groupX = data.slice(2, 4);
                              const group2 = data.slice(4, 6);
                              const renderGroup = (
                                cells: OddsCell[],
                                offset: number,
                                prefix: string,
                              ) =>
                                cells.map((item, i) => (
                                  <Box
                                    key={`${prefix}-${i}`}
                                    sx={{
                                      flex: 1,
                                      background: getBg(i + offset),
                                      color: '#fff',
                                      textAlign: 'center',
                                      py: 0.4,
                                      borderRadius: 0.8,
                                      fontSize: 11,
                                    }}
                                  >
                                    <div style={{ fontWeight: 'bold' }}>
                                      {item?.price ?? '-'}
                                    </div>
                                    <div style={{ fontSize: 9 }}>
                                      {item?.size ?? '-'}
                                    </div>
                                  </Box>
                                ));
                              return (
                                <Box display="flex" gap={0.5}>
                                  {renderGroup(group1, 0, '1')}
                                  {renderGroup(groupX, 2, 'x')}
                                  {renderGroup(group2, 4, '2')}
                                </Box>
                              );
                            })()}
                          </Box>

                          {(match.marketList?.length
                            ? match.marketList
                            : Object.keys(match.teams || {}).length
                              ? [
                                  {
                                    marketName: match.marketName || 'Market',
                                    betSize: match.betSize,
                                    data: match.teams,
                                  },
                                ]
                              : []
                          ).map((market, marketIndex) => (
                            <Box
                              key={`${market.marketName || 'market'}-${marketIndex}`}
                              mb={2}
                              sx={{
                                p: match.marketList?.length ? 1 : 0,
                                bgcolor: match.marketList?.length
                                  ? 'action.hover'
                                  : 'transparent',
                                borderRadius: 1,
                              }}
                            >
                              <Typography fontWeight="bold" mb={1} fontSize={13}>
                                {`${market.marketName || 'Market'}${
                                  market.betSize != null
                                    ? ` (${toDisplayText('Bet Size')}:- ${market.betSize})`
                                    : ''
                                }`}
                              </Typography>
                              {Object.entries(market.data || {}).map(
                                ([team, value]) => (
                                  <Box
                                    key={team}
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: 15,
                                    }}
                                  >
                                    <span>{team}</span>
                                    <span
                                      style={{
                                        color:
                                          Number(value) < 0 ? '#d32f2f' : '#2e7d32',
                                        fontWeight: 'bold',
                                      }}
                                    >
                                      {Number(value).toFixed(2)}
                                    </span>
                                  </Box>
                                ),
                              )}
                            </Box>
                          ))}

                          {(() => {
                            const fancyList = match.fancy || [];
                            const priorityOrder = [6, 10, 15, 20];
                            const getOverNumber = (name: string) => {
                              const m = name.match(/\d+/);
                              return m ? parseInt(m[0], 10) : null;
                            };
                            const sortedFancyList = [...fancyList].sort(
                              (a, b) => {
                                const aName =
                                  a?.marketName?.toLowerCase() || '';
                                const bName =
                                  b?.marketName?.toLowerCase() || '';
                                const aNum = getOverNumber(aName);
                                const bNum = getOverNumber(bName);
                                const isAValid =
                                  aName.includes('over run') &&
                                  aNum != null &&
                                  priorityOrder.includes(aNum);
                                const isBValid =
                                  bName.includes('over run') &&
                                  bNum != null &&
                                  priorityOrder.includes(bNum);
                                if (isAValid && isBValid && aNum != null && bNum != null) {
                                  return (
                                    priorityOrder.indexOf(aNum) -
                                    priorityOrder.indexOf(bNum)
                                  );
                                }
                                if (isAValid) return -1;
                                if (isBValid) return 1;
                                return 0;
                              },
                            );
                            const visibleList = showAll
                              ? sortedFancyList
                              : sortedFancyList.slice(0, 7);

                            return (
                              <>
                                {visibleList.map((f, i) => {
                                  const uniqueIndex = `${index}-${i}`;
                                  const selectedKey = getClosestKey(
                                    f?.data || {},
                                    f?.result,
                                  );
                                  return (
                                    <Box
                                      key={f?.marketName || uniqueIndex}
                                      sx={{
                                        mb: 1.5,
                                        p: 1,
                                        bgcolor: 'rgba(255,255,255,0.04)',
                                        borderRadius: 1,
                                      }}
                                    >
                                      <Typography
                                        fontSize={13}
                                        fontWeight="bold"
                                        sx={{
                                          mb: 0.5,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}
                                        onClick={() =>
                                          setOpenIndex(
                                            openIndex === uniqueIndex
                                              ? null
                                              : uniqueIndex,
                                          )
                                        }
                                      >
                                        {`${f?.marketName} (${toDisplayText('Bet Size')}:- ${f?.betSize})`}
                                        <span>
                                          {openIndex === uniqueIndex ? '▲' : '▼'}
                                        </span>
                                      </Typography>
                                      <Collapse
                                        in={openIndex === uniqueIndex}
                                        timeout="auto"
                                        unmountOnExit
                                      >
                                        {Object.entries(f?.data || {}).map(
                                          ([key, val]) => {
                                            const isActive =
                                              Number(key) === selectedKey;
                                            return (
                                              <Box
                                                key={key}
                                                sx={{
                                                  display: 'flex',
                                                  justifyContent:
                                                    'space-between',
                                                  fontSize: 14,
                                                  py: 0.3,
                                                  px: 1,
                                                  borderRadius: 1,
                                                  backgroundColor: isActive
                                                    ? 'rgba(255,192,203,0.25)'
                                                    : 'transparent',
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    fontWeight: isActive
                                                      ? 600
                                                      : 400,
                                                  }}
                                                >
                                                  {key}
                                                </span>
                                                <span
                                                  style={{
                                                    color:
                                                      Number(val) < 0
                                                        ? '#d32f2f'
                                                        : '#2e7d32',
                                                    fontWeight: isActive
                                                      ? 700
                                                      : 500,
                                                  }}
                                                >
                                                  {Number(val).toFixed(2)}
                                                </span>
                                              </Box>
                                            );
                                          },
                                        )}
                                      </Collapse>
                                    </Box>
                                  );
                                })}
                                {fancyList.length > 10 && (
                                  <Box textAlign="center" mt={1}>
                                    <Typography
                                      sx={{
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        color: 'warning.main',
                                        fontWeight: 'bold',
                                      }}
                                      onClick={() => {
                                        setShowAll(!showAll);
                                        setOpenIndex(null);
                                      }}
                                    >
                                      {showAll ? 'Show Less' : 'Show More'}
                                    </Typography>
                                  </Box>
                                )}
                              </>
                            );
                          })()}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))}
        </Grid>
      )}

      <LiveStreamModal
        open={streamOpen}
        onClose={() => setStreamOpen(false)}
        streamId={streamId}
      />
    </Box>
  );
}

export function LiveMatchTotalLaxmiPage() {
  return <LiveMatchTotalPage variant="laxmi" />;
}

export function LiveMatchTotalMasterPage() {
  return <LiveMatchTotalPage variant="master" />;
}

export function LiveMatchTotalBothPage() {
  return <LiveMatchTotalPage variant="both" />;
}
