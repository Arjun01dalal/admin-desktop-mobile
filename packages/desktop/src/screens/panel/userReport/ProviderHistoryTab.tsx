import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount, todayIST } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import { StatusSelectFilter } from './historyFilters';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type Kind = 'qtech' | 'missing' | 'jetfair' | 'sm';
type Props = { userId: string; kind: Kind };

const ACTION: Record<Kind, SecureAction> = {
  qtech: 'userReport.qtechStoreBet',
  missing: 'userReport.qtechMissingBets',
  jetfair: 'userReport.jetfairMapping',
  sm: 'userReport.smMapping',
};

const SM_MARKETS = [
  { value: '301', label: 'regular' },
  { value: '401', label: 'starline' },
  { value: '501', label: 'king_bazar' },
  { value: '701', label: 'instant_worli_day' },
  { value: '801', label: 'instant_worli_night' },
];

const ORANGE_BTN = {
  ...laxmiActionBtnSx('black'),
  bgcolor: '#ff9f0a',
  backgroundImage: 'none',
  color: '#111',
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none !important' },
};

function asList(data: unknown, keys: string[]): HistoryRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as HistoryRow[];
  const root = data as Record<string, unknown>;
  const nested = (root.payload ?? root) as Record<string, unknown>;
  for (const k of keys) {
    const v = nested[k];
    if (Array.isArray(v)) return v as HistoryRow[];
  }
  return [];
}

function num(v: unknown) {
  return formatAmount(Number(v) || 0);
}

/** Qtech / Missing / Jetfair / SM provider mapping UIs. */
export function ProviderHistoryTab({ userId, kind }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [marketDate, setMarketDate] = useState(todayIST());
  const [marketId, setMarketId] = useState('');
  const [marketCode, setMarketCode] = useState('301');
  const [itemsPerPage, setItemsPerPage] = useState('1000');
  const [viewType, setViewType] = useState(
    kind === 'missing' ? 'Missing Provider' : 'Provider',
  );
  const [status, setStatus] = useState('');
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [betCount, setBetCount] = useState(0);
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let payload: Record<string, unknown> = { userId };
      if (kind === 'qtech' || kind === 'missing') {
        payload = {
          userId,
          startDate,
          endDate,
          size: Number(itemsPerPage),
          itemsPerPage: Number(itemsPerPage),
          pageNo: 1,
          filter: { userId, providerName: 'Qtech' },
        };
      } else if (kind === 'jetfair') {
        payload = { userId, marketId };
      } else {
        payload = { userId, resultDate: marketDate, marketCode };
      }

      const res = await secureApi(ACTION[kind], payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load');
        setRows([]);
        setRaw(null);
        return;
      }

      const data = (res.data || {}) as Record<string, unknown>;
      const nested = (data.payload ?? data) as Record<string, unknown>;
      setRaw(nested);

      setTotals({
        providerBet: Number(
          nested.totalBetAmountProvider ?? nested.providerBetAmount ?? 0,
        ),
        providerWin: Number(
          nested.totalWinAmountProvider ?? nested.providerWinAmount ?? 0,
        ),
        platformComm: Number(
          nested.platformCommissionAmount ?? nested.commissionAmount ?? 0,
        ),
        platformBet: Number(
          nested.platformBetAmount ?? nested.totalPlatformBet ?? 0,
        ),
        platformWin: Number(
          nested.platformWinAmount ?? nested.totalPlatformWin ?? 0,
        ),
      });

      let list: HistoryRow[] = [];
      if (kind === 'missing') {
        list =
          viewType === 'Missing Platforms'
            ? asList(nested, [
                'missingInPlatform',
                'missingPlatforms',
                'platformMissing',
                'items',
              ])
            : asList(nested, [
                'missingInProvider',
                'missingProviders',
                'providerMissing',
                'items',
              ]);
      } else if (viewType === 'Platform' || viewType === 'Provider') {
        list =
          viewType === 'Platform'
            ? asList(nested, [
                'platformBets',
                'platform',
                'plateformDetails',
                'items',
              ])
            : asList(nested, [
                'providerBets',
                'provider',
                'providersDetail',
                'items',
              ]);
      } else {
        list = asList(nested, ['items', 'providerBets', 'list']);
      }

      if (status) {
        list = list.filter(
          (r) => String(r.status || '').toLowerCase() === status.toLowerCase(),
        );
      }
      setRows(list);
      setBetCount(
        Number(nested.totalBets ?? nested.totalNumberOfBets ?? list.length) ||
          list.length,
      );
    } finally {
      setLoading(false);
    }
  }, [
    endDate,
    itemsPerPage,
    kind,
    marketCode,
    marketDate,
    marketId,
    startDate,
    status,
    userId,
    viewType,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    setMarketDate('');
    setMarketId('');
  };

  const qtechColumns = useMemo<CommonTableColumn<HistoryRow>[]>(
    () => [
      {
        id: 'type',
        label: 'Type',
        filter: (
          <TextField
            select
            size="small"
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
            sx={{
              minWidth: 140,
              '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
            }}
          >
            {(kind === 'missing'
              ? ['Missing Provider', 'Missing Platforms']
              : ['Provider', 'Platform']
            ).map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: () => viewType,
      },
      {
        id: 'round',
        label: 'Round Id',
        filter: null,
        render: (r) => String(r.roundId || r.round_id || '-'),
      },
      {
        id: 'status',
        label: 'Status',
        filter: (
          <StatusSelectFilter
            value={status}
            onChange={setStatus}
            options={[
              { id: '', label: 'Select status' },
              { id: 'W', label: 'Win' },
              { id: 'L', label: 'Loss' },
              { id: 'R', label: 'Roll Back' },
            ]}
          />
        ),
        render: (r) => String(r.status || '-'),
      },
      {
        id: 'bet',
        label: 'Total Bet',
        filter: null,
        render: (r) => num(r.totalBet ?? r.betAmount ?? r.amount),
      },
      {
        id: 'payout',
        label: 'Total Payout',
        filter: null,
        render: (r) => num(r.totalPayout ?? r.winAmount ?? r.payout),
      },
      {
        id: 'bonus',
        label: 'Total Bonus Bet',
        filter: null,
        render: (r) => num(r.totalBonusBet ?? r.bonusBet),
      },
      {
        id: 'currency',
        label: 'Currency',
        filter: null,
        render: (r) => String(r.currency || '-'),
      },
      {
        id: 'init',
        label: 'Initiated',
        filter: null,
        render: (r) => String(r.initiated || r.initiatedAt || '-'),
      },
      {
        id: 'done',
        label: 'Completed',
        filter: null,
        render: (r) => String(r.completed || r.completedAt || '-'),
      },
      {
        id: 'op',
        label: 'Operator Id',
        filter: null,
        render: (r) => String(r.operatorId || '-'),
      },
      {
        id: 'player',
        label: 'Player Id',
        filter: null,
        render: (r) => String(r.playerId || r.playerid || '-'),
      },
      {
        id: 'device',
        label: 'Device',
        filter: null,
        render: (r) => String(r.device || '-'),
      },
      {
        id: 'gp',
        label: 'Game Provider',
        filter: null,
        render: (r) => toDisplayText(String(r.gameProvider || r.providerName || '-')),
      },
      {
        id: 'gid',
        label: 'Game Id',
        filter: null,
        render: (r) => String(r.gameId || '-'),
      },
      {
        id: 'gcat',
        label: 'Game Category',
        filter: null,
        render: (r) => toDisplayText(String(r.gameCategory || r.category || '-')),
      },
    ],
    [kind, status, viewType],
  );

  const smColumns = useMemo<CommonTableColumn<HistoryRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        filter: (
          <TextField
            select
            size="small"
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
            sx={{
              minWidth: 110,
              '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
            }}
          >
            {['Provider', 'Platform'].map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (_r, i) => i + 1,
      },
      {
        id: 'gname',
        label: 'Game Name',
        filter: null,
        render: (r) => String(r.game_name || r.gameName || '-'),
      },
      {
        id: 'gid',
        label: 'Game Id',
        filter: null,
        render: (r) => String(r.game_id || r.gameId || '-'),
      },
      {
        id: 'gname2',
        label: 'Game Name',
        filter: null,
        render: (r) => String(r.game || r.bazar_name || '-'),
      },
      {
        id: 'bazar',
        label: 'Bazar Id',
        filter: null,
        render: (r) => String(r.bazar_id || r.bazarId || '-'),
      },
      {
        id: 'status',
        label: 'Status',
        filter: (
          <StatusSelectFilter
            value={status}
            onChange={setStatus}
            options={[
              { id: '', label: 'Select Status' },
              { id: 'W', label: 'Win' },
              { id: 'L', label: 'Loss' },
              { id: 'P', label: 'Pending' },
            ]}
          />
        ),
        render: (r) => String(r.status || '-'),
      },
      {
        id: 'win',
        label: 'Winning Point',
        filter: null,
        render: (r) => num(r.winning_point ?? r.winningPoint),
      },
      {
        id: 'comm',
        label: 'Commission',
        filter: null,
        render: (r) => num(r.commission),
      },
      {
        id: 'cust',
        label: 'Customer Id',
        filter: null,
        render: (r) => String(r.customer_id || r.userId || '-'),
      },
      {
        id: 'txn',
        label: 'Transaction Id',
        filter: null,
        render: (r) => String(r.transaction_id || r.transactionId || '-'),
      },
      {
        id: 'result',
        label: 'Result Date',
        filter: null,
        render: (r) => String(r.result_date || r.resultDate || '-'),
      },
    ],
    [status, viewType],
  );

  const jetfairColumns = useMemo<CommonTableColumn<HistoryRow>[]>(
    () => [
      { id: 'id', label: 'ID', filter: null, render: (r) => String(r._id || r.id || '-') },
      {
        id: 'runner',
        label: 'Runner Name',
        filter: (
          <TextField
            select
            size="small"
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
            sx={{
              minWidth: 110,
              '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
            }}
          >
            {['Provider', 'Platform'].map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (r) => String(r.runnerName || r.Runnername || '-'),
      },
      { id: 'hub', label: 'Hub', filter: null, render: (r) => String(r.hub || '-') },
      {
        id: 'stake',
        label: 'Stake',
        filter: null,
        render: (r) => num(r.stake ?? r.Stake),
      },
      {
        id: 'rate',
        label: 'Rate',
        filter: null,
        render: (r) => num(r.rate ?? r.Rate),
      },
      {
        id: 'nobc',
        label: 'No Bc',
        filter: null,
        render: (r) => String(r.noBc ?? r.NoBc ?? '-'),
      },
      {
        id: 'won',
        label: 'Is Bet Won',
        filter: null,
        render: (r) => String(r.isBetWon ?? r.IsBetWon ?? '-'),
      },
      {
        id: 'back',
        label: 'Isback',
        filter: null,
        render: (r) => String(r.isback ?? r.Isback ?? '-'),
      },
      {
        id: 'net',
        label: 'Net PL',
        filter: null,
        render: (r) => num(r.netPL ?? r.NetPL),
      },
      {
        id: 'hub2',
        label: 'Hub 2',
        filter: null,
        render: (r) => String(r.hub2 || r.Hub2 || '-'),
      },
      {
        id: 'created',
        label: 'Created On',
        filter: null,
        render: (r) => String(r.createdOn || r.CreatedOn || '-'),
      },
    ],
    [viewType],
  );

  const columns =
    kind === 'sm'
      ? smColumns
      : kind === 'jetfair'
        ? jetfairColumns
        : qtechColumns;

  return (
    <Box>
      {(kind === 'qtech' || kind === 'missing') && (
        <Stack spacing={0.5} mb={2} sx={{ color: '#111', fontWeight: 600 }}>
          <Typography>
            Total Bet Amount Provider : {num(totals.providerBet)} &nbsp;&nbsp;
            Total Win Amount Provider : {num(totals.providerWin)} &nbsp;&nbsp;
            Platform Commission Amount : {num(totals.platformComm)}
          </Typography>
          <Typography>
            Platform Bet Amount : {num(totals.platformBet)} &nbsp;&nbsp;
            Platform Win Amount : {num(totals.platformWin)}
          </Typography>
        </Stack>
      )}

      {kind === 'sm' && (
        <Stack spacing={0.5} mb={2} sx={{ color: '#111', fontWeight: 600 }}>
          <Typography>
            Total Bet Amount Provider : {num(totals.providerBet)} &nbsp;&nbsp;
            Total Win Amount Provider : {num(totals.providerWin)} &nbsp;&nbsp;
            Platform Commission Amount : {num(totals.platformComm)}
          </Typography>
          <Typography>
            Platform Bet Amount : {num(totals.platformBet)} &nbsp;&nbsp;
            Platform Win Amount : {num(totals.platformWin)}
          </Typography>
        </Stack>
      )}

      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        alignItems="flex-end"
        mb={1.5}
      >
        {(kind === 'qtech' || kind === 'missing') && (
          <>
            <TextField
              type="date"
              size="small"
              label="From Date"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              sx={{ bgcolor: '#fff' }}
            />
            <TextField
              type="date"
              size="small"
              label="To Date"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              sx={{ bgcolor: '#fff' }}
            />
          </>
        )}
        {kind === 'sm' && (
          <>
            <TextField
              type="date"
              size="small"
              label="Market Date"
              InputLabelProps={{ shrink: true }}
              value={marketDate}
              onChange={(e) => setMarketDate(e.target.value)}
              sx={{ bgcolor: '#fff' }}
            />
            <TextField
              select
              size="small"
              label="Select Market"
              value={marketCode}
              onChange={(e) => setMarketCode(e.target.value)}
              sx={{ bgcolor: '#fff', minWidth: 160 }}
              InputLabelProps={{ shrink: true }}
            >
              {SM_MARKETS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
        {kind === 'jetfair' && (
          <TextField
            size="small"
            label="Market Id"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            sx={{ bgcolor: '#fff', minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
          />
        )}

        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={laxmiActionBtnSx('white')}
          onClick={() => void load()}
        >
          Apply
        </Button>
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={ORANGE_BTN}
          onClick={clearDates}
        >
          Clear Dates
        </Button>

        {kind === 'missing' && (
          <>
            <Button
              variant="contained"
              color="inherit"
              disableElevation
              sx={ORANGE_BTN}
              onClick={() => setViewType('Missing Provider')}
            >
              Missing Providers
            </Button>
            <Button
              variant="contained"
              color="inherit"
              disableElevation
              sx={ORANGE_BTN}
              onClick={() => setViewType('Missing Platforms')}
            >
              Missing Platforms
            </Button>
          </>
        )}

        <TextField
          select
          size="small"
          label="Items Per Page"
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(e.target.value)}
          sx={{ bgcolor: '#fff', minWidth: 120 }}
          InputLabelProps={{ shrink: true }}
        >
          {['100', '250', '500', '1000'].map((o) => (
            <MenuItem key={o} value={o}>
              {o}
            </MenuItem>
          ))}
        </TextField>

        <Typography sx={{ color: '#111', fontWeight: 600, ml: 1 }}>
          {kind === 'missing'
            ? `Total Missing Bets : ${betCount}`
            : `Total Number of bets : ${betCount}`}
        </Typography>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(r, i) => String(r._id || r.roundId || i)}
        loading={loading}
        emptyMessage="No provider data"
        minWidth={1400}
        dense
      />

      {!raw && !loading && null}
    </Box>
  );
}
