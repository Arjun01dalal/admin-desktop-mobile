import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { BackButton } from '@/components/BackButton';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST, formatAmount } from '@/utils/dates';
import { display } from './shared';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type RtpType =
  | 'Qtech'
  | 'WCO'
  | 'Satta Matka'
  | 'Falcon'
  | 'Exchange'
  | 'AAA Exchange';

type QtechGame = {
  gameId?: string;
  totalAmount?: number;
  totalBets?: number;
  totalWins?: number;
  winAmount?: number;
  winPercentage?: number;
};

type QtechRow = {
  userId: string;
  games?: QtechGame[];
  combined?: {
    totalAmount?: number;
    totalBets?: number;
    totalWins?: number;
    winAmount?: number;
    winPercentage?: number;
  };
};

type ExchangeRow = {
  userId: string;
  amount?: number;
  clientName?: string;
  name?: string;
  provider?: string;
  totalBets?: number;
  winLoss?: number;
};

type PlayerRtpRow = QtechRow | ExchangeRow;

/** Same Type list as old Players RTP UI. */
const TYPE_OPTIONS: RtpType[] = [
  'Qtech',
  'WCO',
  'Satta Matka',
  'Falcon',
  'Exchange',
  'AAA Exchange',
];

/** Only these have RTP APIs wired (same as laxminarayan TYPE_CONFIG). */
const SUPPORTED_RTP_TYPES = new Set<RtpType>(['Qtech', 'AAA Exchange']);

/**
 * Old UI: Object.entries(res?.payload || {}).
 * secureApi with keepDataEnvelope returns the same envelope shape.
 */
function unpackExchangeRows(data: unknown, filterUserId: string): ExchangeRow[] {
  const asMap = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };

  const envelope = asMap(data) || {};
  let map =
    asMap(envelope.payload) ||
    asMap(envelope.data) ||
    asMap(envelope.result) ||
    asMap(envelope.report) ||
    envelope;

  // Payload sometimes arrives as a JSON string.
  if (typeof envelope.payload === 'string') {
    try {
      const parsed = JSON.parse(envelope.payload) as unknown;
      map = asMap(parsed) || map;
    } catch {
      /* ignore */
    }
  }

  const list: ExchangeRow[] = [];

  if (Array.isArray(map)) {
    for (const item of map) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const id = String(row.userId || row._id || row.id || '');
      if (!id) continue;
      list.push({ ...(row as Omit<ExchangeRow, 'userId'>), userId: id });
    }
  } else if (map) {
    for (const [id, value] of Object.entries(map)) {
      if (!id || id === 'payload' || id === 'data' || id === 'success' || id === 'message') {
        continue;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      list.push({ ...(value as Omit<ExchangeRow, 'userId'>), userId: id });
    }
  }

  if (!filterUserId.trim()) return list;
  return list.filter((row) => row.userId === filterUserId.trim());
}

function unpackQtechRows(data: unknown): QtechRow[] {
  if (Array.isArray(data)) return data as QtechRow[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload as QtechRow[];
    if (Array.isArray(obj.items)) return obj.items as QtechRow[];
  }
  return [];
}

const fieldSx = {
  flex: 1,
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
};

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

function rowBgSx(winPercentage: number | undefined) {
  const pct = Number(winPercentage) || 0;
  if (pct > 85) {
    return { bgcolor: 'rgba(244,67,54,0.2)', '&:hover': { bgcolor: 'rgba(244,67,54,0.28)' } };
  }
  if (pct > 70) {
    return { bgcolor: 'rgba(255,152,0,0.2)', '&:hover': { bgcolor: 'rgba(255,152,0,0.28)' } };
  }
  return undefined;
}

/** Players RTP — ops.playerRtpQtech / ops.playerRtpExchange. */
export function PlayerRtpPage() {
  useRevealCodes();
  const navigate = useNavigate();
  const location = useLocation();
  const fromUserReport = Boolean(
    (location.state as { fromUserReport?: boolean } | null)?.fromUserReport,
  );
  const seedUserId = String((location.state as { id?: string } | null)?.id || '');
  const [type, setType] = useState<RtpType>('Qtech');
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [draftUserId, setDraftUserId] = useState(seedUserId);
  const [draftGameId, setDraftGameId] = useState('');
  const [userId, setUserId] = useState(seedUserId);
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<PlayerRtpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      if (!SUPPORTED_RTP_TYPES.has(type)) {
        startTransition(() => setRows([]));
        return;
      }

      const action = type === 'Qtech' ? 'ops.playerRtpQtech' : 'ops.playerRtpExchange';
      const res = await secureApi<unknown>(action, {
        startDate,
        endDate,
        userId: userId || '',
        gameId: type === 'Qtech' ? gameId : '',
      });

      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load players RTP');
        startTransition(() => setRows([]));
        return;
      }

      if (type === 'Qtech') {
        startTransition(() => setRows(unpackQtechRows(res.data)));
      } else {
        const list = unpackExchangeRows(res.data, userId);
        startTransition(() => setRows(list));
        if (list.length === 0 && res.message) {
          toast.info(res.message);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load players RTP');
      startTransition(() => setRows([]));
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [type, startDate, endDate, userId, gameId, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, userId, gameId]);

  const search = useCallback(() => {
    setUserId(draftUserId.trim());
    setGameId(draftGameId.trim());
  }, [draftUserId, draftGameId]);

  const applyDates = useCallback(() => {
    void load();
  }, [load]);

  const qtechColumns = useMemo<CommonTableColumn<QtechRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <ColumnSearch
            value={draftUserId}
            onChange={setDraftUserId}
            onSearch={search}
            placeholder="Search by User ID"
          />
        ),
        render: (row) => display(row.userId),
      },
      {
        id: 'gameId',
        label: 'Game ID',
        width: 160,
        cellSx: {
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        filter: (
          <ColumnSearch
            value={draftGameId}
            onChange={setDraftGameId}
            onSearch={search}
            placeholder="Search Game ID"
          />
        ),
        render: (row) => {
          const text =
            [...(row.games || [])]
              .sort((a, b) => (Number(b.winPercentage) || 0) - (Number(a.winPercentage) || 0))
              .map((g) => g.gameId)
              .filter(Boolean)
              .join(', ') || '—';
          return (
            <Box
              component="span"
              title={text === '—' ? undefined : text}
              sx={{
                display: 'block',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </Box>
          );
        },
      },
      {
        id: 'gameCount',
        label: 'Game Count',
        render: (row) => (
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/playerRtp/details', { state: { gameData: row.games || [] } });
            }}
            sx={{
              minWidth: 0,
              px: 0.5,
              fontWeight: 700,
              color: '#ff9f0a',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              textTransform: 'none',
            }}
          >
            {row.games?.length || 0}
          </Button>
        ),
      },
      {
        id: 'totalAmount',
        label: 'Total Amount',
        render: (row) => formatAmount(row.combined?.totalAmount ?? 0),
      },
      {
        id: 'totalBets',
        label: 'Total Bets',
        render: (row) => display(row.combined?.totalBets ?? 0),
      },
      {
        id: 'totalWins',
        label: 'Total Wins',
        render: (row) => display(row.combined?.totalWins ?? 0),
      },
      {
        id: 'winAmount',
        label: 'Total Wins Amount',
        render: (row) => formatAmount(row.combined?.winAmount ?? 0),
      },
      {
        id: 'winPct',
        label: 'Total Win %',
        render: (row) => display(row.combined?.winPercentage ?? 0),
      },
    ],
    [draftUserId, draftGameId, search, navigate],
  );

  const exchangeColumns = useMemo<CommonTableColumn<ExchangeRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <ColumnSearch
            value={draftUserId}
            onChange={setDraftUserId}
            onSearch={search}
            placeholder="Search by User ID"
          />
        ),
        render: (row) => display(row.userId),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => formatAmount(row.amount),
      },
      {
        id: 'clientName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => display(row.name),
      },
      {
        id: 'provider',
        label: 'Provider',
        render: (row) => display(row.provider),
      },
      {
        id: 'totalBets',
        label: 'Total Bets',
        render: (row) => display(row.totalBets),
      },
      {
        id: 'winLoss',
        label: 'Win Loss',
        render: (row) => (
          <Typography
            variant="body2"
            fontWeight={700}
            color={Number(row.winLoss) < 0 ? 'error.main' : 'success.main'}
          >
            {formatAmount(row.winLoss ?? 0)}
          </Typography>
        ),
      },
    ],
    [draftUserId, search],
  );

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          {toDisplayText('Players RTP')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {fromUserReport ? <BackButton /> : null}
          <Button
            variant="outlined"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={() => void load()}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            label="Type"
            size="small"
            value={type}
            onChange={(e) => {
              setType(e.target.value as RtpType);
              setDraftUserId('');
              setDraftGameId('');
              setUserId('');
              setGameId('');
            }}
            sx={fieldSx}
          >
            {TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyDates}
            disabled={loading}
            sx={{ ...orangeBtnSx, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Apply
          </Button>
        </Stack>
      </Paper>

      {type === 'Qtech' ? (
        <CommonTable
          columns={qtechColumns}
          rows={rows as QtechRow[]}
          getRowKey={(row, index) => row.userId || index}
          loading={loading}
          emptyMessage="No RTP data found"
          stickyHeader
          dense
          minWidth={1200}
          maxHeight="calc(100vh - 300px)"
          getRowSx={(row) => rowBgSx((row as QtechRow).combined?.winPercentage)}
        />
      ) : type === 'AAA Exchange' ? (
        <CommonTable
          columns={exchangeColumns}
          rows={rows as ExchangeRow[]}
          getRowKey={(row, index) => row.userId || index}
          loading={loading}
          emptyMessage="No RTP data found"
          stickyHeader
          dense
          minWidth={1000}
          maxHeight="calc(100vh - 300px)"
        />
      ) : (
        <CommonTable
          columns={exchangeColumns}
          rows={[]}
          getRowKey={(_row, index) => index}
          loading={loading}
          emptyMessage={`${type} RTP is not available yet`}
          stickyHeader
          dense
          minWidth={1000}
          maxHeight="calc(100vh - 300px)"
        />
      )}
    </Box>
  );
}
