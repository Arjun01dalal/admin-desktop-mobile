/**
 * Shatabhisha / Satta Matka platform detail — Laxmi `/nandi-platform`.
 * Opened from ops dashboard Satta Matka card.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  NANDI_MARKET_TABS,
  buildNandiDetailCards,
  buildNandiSessionMetrics,
  extractNandiPlayersList,
  formatNandiDetailValue,
  isRealNandiBazarId,
  mapNandiPlayerRow,
  nandiMetricTone,
  normalizeNandiBazarCards,
  normalizeNandiSessionLabel,
  sortNandiPlayers,
  unwrapNandiPayload,
  type NandiBazarCard,
  type NandiMarketKey,
  type NandiPlayerSortKey,
  type NandiSessionRow,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { todayIST } from '@/utils/dates';

type LocationState = {
  startDate?: string;
  endDate?: string;
};

const toneColor = (tone?: string) =>
  tone === 'neg' ? 'error.main' : tone === 'pos' ? 'success.main' : 'text.primary';

export function NandiPlatformPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state || {}) as LocationState;

  const [startDate, setStartDate] = useState(() => nav.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => nav.endDate || todayIST());
  const [market, setMarket] = useState<NandiMarketKey>('regular');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [detailCards, setDetailCards] = useState(() => buildNandiDetailCards(null));
  const [bazars, setBazars] = useState<NandiBazarCard[]>([]);

  const [playersOpen, setPlayersOpen] = useState(false);
  const [players, setPlayers] = useState<Record<string, unknown>[]>([]);
  const [playersTotal, setPlayersTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBazarId, setSelectedBazarId] = useState('');
  const [selectedBazarName, setSelectedBazarName] = useState('');
  const [selectedSession, setSelectedSession] = useState('Open');
  const [sortKey, setSortKey] = useState<NandiPlayerSortKey>('bet');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const playersReqId = useRef(0);

  const loadDetails = useCallback(async (from: string, to: string) => {
    setDetailsLoading(true);
    try {
      const res = await secureApi<unknown>('dashboard.nandiPlatformDetails', {
        startDate: from,
        endDate: to,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load platform details');
        setDetailCards([]);
        return;
      }
      setDetailCards(buildNandiDetailCards(unwrapNandiPayload(res.data)));
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const loadByMarket = useCallback(async (from: string, to: string, nextMarket: NandiMarketKey) => {
    setMarketLoading(true);
    try {
      const res = await secureApi<unknown>('dashboard.nandiPlatformByMarket', {
        startDate: from,
        endDate: to,
        market: nextMarket,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load market data');
        setBazars([]);
        return;
      }
      setBazars(normalizeNandiBazarCards(res.data));
      setPlayersOpen(false);
      setPlayers([]);
      setSelectedBazarId('');
      setSelectedBazarName('');
      setSelectedSession('Open');
      setPageNo(1);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(
    async (opts?: {
      from?: string;
      to?: string;
      selectedMarket?: NandiMarketKey;
      bazarId?: string;
      session?: string;
      page?: number;
      perPage?: number;
    }) => {
      const from = opts?.from ?? startDate;
      const to = opts?.to ?? endDate;
      const selectedMarket = opts?.selectedMarket ?? market;
      const bazarId = opts?.bazarId ?? selectedBazarId;
      const session = normalizeNandiSessionLabel(opts?.session ?? selectedSession);
      const page = opts?.page ?? pageNo;
      const perPage = opts?.perPage ?? pageSize;
      const reqId = ++playersReqId.current;

      setPlayersLoading(true);
      try {
        const body: Record<string, unknown> = {
          startDate: from,
          endDate: to,
          market: selectedMarket,
          session,
          pageNo: page,
          itemsPerPage: perPage,
        };
        if (isRealNandiBazarId(bazarId)) body.bazarId = bazarId;

        const res = await secureApi<unknown>('dashboard.nandiPlatformPlayers', body);
        if (reqId !== playersReqId.current) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load players');
          setPlayers([]);
          setPlayersTotal(0);
          setTotalPages(1);
          return;
        }
        const parsed = extractNandiPlayersList(res.data);
        setPlayers(parsed.list);
        setPlayersTotal(parsed.totalCount);
        setTotalPages(parsed.totalPages);
        setPageNo(page);
      } finally {
        if (reqId === playersReqId.current) setPlayersLoading(false);
      }
    },
    [endDate, market, pageNo, pageSize, selectedBazarId, selectedSession, startDate],
  );

  useEffect(() => {
    void loadDetails(startDate, endDate);
    void loadByMarket(startDate, endDate, market);
    // Initial mount only — Apply / market tabs re-fetch explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    void loadDetails(startDate, endDate);
    void loadByMarket(startDate, endDate, market);
  };

  const handleMarketChange = (next: NandiMarketKey) => {
    setMarket(next);
    void loadByMarket(startDate, endDate, next);
  };

  const openSessionPlayers = (sessionRow: NandiSessionRow, bazar: NandiBazarCard) => {
    const session = normalizeNandiSessionLabel(sessionRow.session, 'Open');
    setSelectedBazarId(bazar.bazarId);
    setSelectedBazarName(bazar.bazarName);
    setSelectedSession(session);
    setPageNo(1);
    setPlayers([]);
    setPlayersOpen(true);
    void loadPlayers({
      bazarId: bazar.bazarId,
      session,
      page: 1,
      selectedMarket: market,
    });
  };

  const closePlayers = () => {
    playersReqId.current += 1;
    setPlayersOpen(false);
    setPlayersLoading(false);
  };

  const sortedPlayers = useMemo(
    () => sortNandiPlayers(players, sortKey, sortDir, selectedSession),
    [players, sortDir, sortKey, selectedSession],
  );

  const handleSort = (key: NandiPlayerSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(
      ['user', 'mobile', 'customerId', 'partnerCustomerId', 'session'].includes(key) ? 'asc' : 'desc',
    );
  };

  const marketLabel = NANDI_MARKET_TABS.find((t) => t.key === market)?.label ?? market;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {toDisplayText('Satta Matka Platform')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            color="warning"
            startIcon={
              detailsLoading || marketLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            disabled={detailsLoading || marketLoading}
            onClick={handleApply}
          >
            Apply
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            Platform Details
          </Typography>
          {detailsLoading ? <CircularProgress size={16} /> : null}
        </Stack>
        {detailsLoading && detailCards.length === 0 ? (
          <Typography color="text.secondary">Loading details…</Typography>
        ) : detailCards.length === 0 ? (
          <Typography color="text.secondary">No summary data</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
                lg: 'repeat(6, minmax(0, 1fr))',
              },
            }}
          >
            {detailCards.map((card) => {
              const n = Number(card.value);
              const tone =
                /ggr|profit/i.test(card.label) && Number.isFinite(n) ? nandiMetricTone(n) : '';
              return (
                <Box
                  key={card.key}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 1.25,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {toDisplayText(card.label)}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700} color={toneColor(tone)}>
                    {formatNandiDetailValue(card.value, card.format)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            Markets
          </Typography>
          {marketLoading ? <CircularProgress size={16} /> : null}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
          {NANDI_MARKET_TABS.map((tab) => (
            <Chip
              key={tab.key}
              label={tab.label}
              color={market === tab.key ? 'warning' : 'default'}
              variant={market === tab.key ? 'filled' : 'outlined'}
              disabled={marketLoading}
              onClick={() => handleMarketChange(tab.key)}
              clickable
            />
          ))}
        </Stack>

        {marketLoading && bazars.length === 0 ? (
          <Typography color="text.secondary">Loading markets…</Typography>
        ) : bazars.length === 0 ? (
          <Typography color="text.secondary">No market data for selected filters</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              opacity: marketLoading ? 0.55 : 1,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {bazars.map((bazar) => {
              const selected = selectedBazarId === bazar.bazarId && playersOpen;
              return (
                <Box
                  key={bazar.bazarId}
                  sx={{
                    border: 1,
                    borderColor: selected ? 'warning.main' : 'divider',
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: 'background.default',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1} mb={1}>
                    <Box minWidth={0}>
                      <Typography fontWeight={700} noWrap title={bazar.bazarId}>
                        {bazar.bazarName}
                      </Typography>
                      {(bazar.openTime || bazar.closeTime) && (
                        <Typography variant="caption" color="text.secondary">
                          {bazar.openTime ? `O ${bazar.openTime}` : ''}
                          {bazar.openTime && bazar.closeTime ? ' · ' : ''}
                          {bazar.closeTime ? `C ${bazar.closeTime}` : ''}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color={bazar.result ? 'text.primary' : 'text.disabled'}
                      sx={{ textAlign: 'right', maxWidth: '46%' }}
                    >
                      {bazar.result || 'Not declared'}
                    </Typography>
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 0.75,
                      mb: 1,
                    }}
                  >
                    {bazar.summary.map((m) => (
                      <Box key={m.label}>
                        <Typography variant="caption" color="text.secondary">
                          {m.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={toneColor(m.tone)}>
                          {m.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {bazar.sessions.map((sessionRow, sIdx) => {
                    const sessionName = normalizeNandiSessionLabel(
                      sessionRow.session,
                      sIdx === 0 ? 'Open' : 'Close',
                    );
                    const active =
                      selected && selectedSession.toLowerCase() === sessionName.toLowerCase();
                    const metrics = buildNandiSessionMetrics(sessionRow);
                    return (
                      <Box
                        key={`${bazar.bazarId}-${sessionName}-${sIdx}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openSessionPlayers({ ...sessionRow, session: sessionName }, bazar)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openSessionPlayers({ ...sessionRow, session: sessionName }, bazar);
                          }
                        }}
                        sx={{
                          mt: 1,
                          p: 1,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          border: 1,
                          borderColor: active ? 'warning.main' : 'divider',
                          bgcolor: active ? 'action.selected' : 'background.paper',
                          '&:hover': { borderColor: 'warning.light' },
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} mb={0.5} display="block">
                          {sessionName}
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 0.5,
                          }}
                        >
                          {metrics.map((m) => (
                            <Box key={m.label}>
                              <Typography variant="caption" color="text.secondary" fontSize={10}>
                                {m.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                display="block"
                                color={toneColor(m.tone)}
                              >
                                {m.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <Dialog open={playersOpen} onClose={closePlayers} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pr: 6 }}>
          <Typography fontWeight={700}>Players</Typography>
          <Typography variant="body2" color="text.secondary">
            {`${selectedBazarName || selectedBazarId} · ${selectedSession} · ${marketLabel} · Total: ${playersTotal.toLocaleString('en-IN')}`}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={closePlayers}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <TextField
              select
              size="small"
              label="Per page"
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPageSize(next);
                void loadPlayers({ page: 1, perPage: next });
              }}
              sx={{ width: 120 }}
            >
              {[20, 50, 100, 200].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            {playersLoading ? <CircularProgress size={18} /> : null}
          </Stack>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  {(
                    [
                      ['user', 'User'],
                      ['mobile', 'Mobile'],
                      ['customerId', 'Customer ID'],
                      ['partnerCustomerId', 'Partner Customer ID'],
                      ['count', 'Count'],
                      ['betCount', 'Bet Count'],
                      ['bet', 'Bet'],
                      ['win', 'Win'],
                      ['ggr', 'GGR'],
                      ['session', 'Session'],
                    ] as const
                  ).map(([key, label]) => (
                    <TableCell key={key} sortDirection={sortKey === key ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === key}
                        direction={sortKey === key ? sortDir : 'asc'}
                        onClick={() => handleSort(key)}
                      >
                        {label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {playersLoading && players.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>Loading players…</TableCell>
                  </TableRow>
                ) : sortedPlayers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>No players found</TableCell>
                  </TableRow>
                ) : (
                  sortedPlayers.map((player, index) => {
                    const view = mapNandiPlayerRow(player, selectedSession);
                    return (
                      <TableRow key={`${view.userId || view.customerId}-${index}`} hover>
                        <TableCell>{(pageNo - 1) * pageSize + index + 1}</TableCell>
                        <TableCell>{view.userName}</TableCell>
                        <TableCell>{view.mobile}</TableCell>
                        <TableCell>
                          {view.customerId && view.customerId !== '-' ? (
                            <Typography
                              component="button"
                              variant="body2"
                              color="primary"
                              sx={{
                                border: 0,
                                background: 'none',
                                cursor: 'pointer',
                                p: 0,
                                font: 'inherit',
                                textDecoration: 'underline',
                              }}
                              onClick={() =>
                                navigate(
                                  `/users/report/${encodeURIComponent(view.customerId)}/${encodeURIComponent(view.userName)}`,
                                )
                              }
                            >
                              {view.customerId}
                            </Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{view.partnerCustomerId}</TableCell>
                        <TableCell>{view.count}</TableCell>
                        <TableCell>{view.betCount}</TableCell>
                        <TableCell>{view.bet}</TableCell>
                        <TableCell>{view.win}</TableCell>
                        <TableCell sx={{ color: toneColor(view.ggrTone), fontWeight: 700 }}>
                          {view.ggr}
                        </TableCell>
                        <TableCell>{view.session}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>

          {totalPages > 1 ? (
            <Stack alignItems="center" mt={2}>
              <Pagination
                count={totalPages}
                page={pageNo}
                onChange={(_e, page) => void loadPlayers({ page })}
                color="primary"
                shape="rounded"
              />
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
