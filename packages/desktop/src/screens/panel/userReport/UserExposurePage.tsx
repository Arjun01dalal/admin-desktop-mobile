import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type ProviderKey = 'SattaMatka' | 'Falcon' | 'Jetfair' | 'WCO' | 'AAAExchange';

type ExposureNavState = {
  userId?: string;
  returnTo?: string;
};

function resolveUserId(state: unknown): string {
  if (typeof state === 'string') return state;
  if (state && typeof state === 'object') {
    const s = state as ExposureNavState & { User_ID?: string };
    return String(s.userId || s.User_ID || '');
  }
  return '';
}

const PROVIDERS: { value: string; key: ProviderKey }[] = [
  { value: 'SattaMatka', key: 'SattaMatka' },
  { value: 'Falcon', key: 'Falcon' },
  { value: 'Jetfair', key: 'Jetfair' },
  { value: 'WCO', key: 'WCO' },
  { value: 'AAA Exchange', key: 'AAAExchange' },
];

type ColDef = { label: string; key: string; kind?: 'date' | 'layBack' | 'amount' };

const TABLE_COLS: Record<ProviderKey, ColDef[]> = {
  SattaMatka: [
    { label: 'Bazar Name', key: 'bazar_name' },
    { label: 'Bazar ID', key: 'bazar_id' },
    { label: 'Game Name', key: 'gameName' },
    { label: 'Game ID', key: 'game_id' },
    { label: 'Game', key: 'game' },
    { label: 'Game Type', key: 'game_type' },
    { label: 'Result Date', key: 'result_date' },
    { label: 'Transaction ID', key: 'transaction_id' },
    { label: 'Customer ID', key: 'customer_id' },
    { label: 'Point', key: 'point' },
    { label: 'Status', key: 'status' },
    { label: 'Created On', key: 'createdOn', kind: 'date' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
  Falcon: [
    { label: 'Event Name', key: 'Eventname' },
    { label: 'Market Name', key: 'Marketname' },
    { label: 'Market ID', key: 'MarketID' },
    { label: 'Runner Name', key: 'Runnername' },
    { label: 'TransactionID', key: 'TransactionID' },
    { label: 'Amount', key: 'Amount', kind: 'amount' },
    { label: 'NetPL', key: 'NetPL' },
    { label: 'Rate', key: 'Rate' },
    { label: 'Stake', key: 'Stake' },
    { label: 'betStatus', key: 'betStatus' },
    { label: 'Bet Type', key: 'BetType' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
  Jetfair: [
    { label: 'Game Name', key: 'gameName' },
    { label: 'Runner Name', key: 'runnerName' },
    { label: 'Market Name', key: 'marketName' },
    { label: 'Market ID', key: 'marketId' },
    { label: 'Transaction ID', key: 'transactionId' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Rate', key: 'rate' },
    { label: 'Stake', key: 'stake' },
    { label: 'Net P/L', key: 'netPL' },
    { label: 'Status', key: 'betStatus' },
    { label: 'Bet Type', key: 'betType' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
  WCO: [
    { label: 'Provider Name', key: 'providerName' },
    { label: 'Game Name', key: 'gameName' },
    { label: 'Transaction ID', key: 'transactionId' },
    { label: 'Round ID', key: 'roundId' },
    { label: 'Action', key: 'action' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Winning', key: 'wining' },
    { label: 'Status', key: 'status' },
    { label: 'Created On', key: 'createdOn', kind: 'date' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
  AAAExchange: [
    { label: 'User ID', key: 'userId' },
    { label: 'Transaction ID', key: 'transactionId' },
    { label: 'Sport Name', key: 'sportName' },
    { label: 'Game Name', key: 'gameName' },
    { label: 'Market Name', key: 'marketName' },
    { label: 'Bet Type', key: 'isBack', kind: 'layBack' },
    { label: 'Rate', key: 'rate' },
    { label: 'Stake', key: 'stake' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Status', key: 'status' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
};

type Row = Record<string, unknown>;

function unpackExposureLists(data: unknown): {
  SattaMatka: Row[];
  Falcon: Row[];
  Jetfair: Row[];
} {
  let cur: unknown = data;
  for (let i = 0; i < 5; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const o = cur as Record<string, unknown>;
    if (o._sattaMatka != null || o._falcon != null || o._jetfair != null) {
      return {
        SattaMatka: Array.isArray(o._sattaMatka) ? (o._sattaMatka as Row[]) : [],
        Falcon: Array.isArray(o._falcon) ? (o._falcon as Row[]) : [],
        Jetfair: Array.isArray(o._jetfair) ? (o._jetfair as Row[]) : [],
      };
    }
    if (o.payload != null) {
      cur = o.payload;
      continue;
    }
    if (o.data != null) {
      cur = o.data;
      continue;
    }
    break;
  }
  return { SattaMatka: [], Falcon: [], Jetfair: [] };
}

function unpackPendingList(data: unknown): Row[] {
  let cur: unknown = data;
  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(cur)) return cur as Row[];
    if (!cur || typeof cur !== 'object') break;
    const o = cur as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Row[];
    if (o.payload != null) {
      cur = o.payload;
      continue;
    }
    if (o.data != null) {
      cur = o.data;
      continue;
    }
    break;
  }
  return [];
}

function cellValue(row: Row, col: ColDef): string {
  const raw = row[col.key];
  if (col.kind === 'date') {
    const d = formatDisplayDate(raw);
    const t = formatDisplayTime(raw);
    return d ? `${d} , ${t}` : '-';
  }
  if (col.kind === 'layBack') return raw ? 'Back' : 'Lay';
  if (col.kind === 'amount') return String(formatAmount(Number(raw) || 0));
  if (raw == null || raw === '') return '-';
  return String(raw);
}

/** Laxmi UserExposure — opened when User Exposure Total Sum > 0. */
export function UserExposurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = resolveUserId(location.state);

  const [provider, setProvider] = useState('SattaMatka');
  const [loading, setLoading] = useState(false);
  const [dataMap, setDataMap] = useState<Record<ProviderKey, Row[]>>({
    SattaMatka: [],
    Falcon: [],
    Jetfair: [],
    WCO: [],
    AAAExchange: [],
  });

  const loadLists = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await secureApi('userReport.userExposureLists', { _id: userId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load exposure lists');
        return;
      }
      const lists = unpackExposureLists(res.data);
      setDataMap((prev) => ({
        ...prev,
        SattaMatka: lists.SattaMatka,
        Falcon: lists.Falcon,
        Jetfair: lists.Jetfair,
      }));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      navigate('/users', { replace: true });
      return;
    }
    void loadLists();
  }, [userId, loadLists, navigate]);

  const onProviderChange = async (next: string) => {
    setProvider(next);
    if (next !== 'WCO' && next !== 'AAA Exchange') return;

    setLoading(true);
    try {
      const action =
        next === 'WCO'
          ? 'userReport.wcoPendingBet'
          : 'userReport.exchangePendingBet';
      const res = await secureApi(action, { userId });
      if (!res.ok) {
        toast.error(res.message || `Failed to load ${next}`);
        return;
      }
      const key: ProviderKey = next === 'WCO' ? 'WCO' : 'AAAExchange';
      setDataMap((prev) => ({
        ...prev,
        [key]: unpackPendingList(res.data),
      }));
    } finally {
      setLoading(false);
    }
  };

  const providerKey =
    PROVIDERS.find((p) => p.value === provider)?.key || 'SattaMatka';
  const rows = dataMap[providerKey] || [];
  const colDefs = TABLE_COLS[providerKey];

  const columns = useMemo<CommonTableColumn<Row>[]>(
    () =>
      colDefs.map((col) => ({
        id: col.key,
        label: col.label,
        render: (r) => cellValue(r, col),
      })),
    [colDefs],
  );

  return (
    <Box sx={{ p: 1 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        mb={1.5}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography fontWeight={700}>{toDisplayText('User Exposure')}</Typography>
        <TextField
          select
          size="small"
          label="Provider"
          value={provider}
          onChange={(e) => void onProviderChange(e.target.value)}
          sx={{ minWidth: 180, bgcolor: '#fff' }}
        >
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {toDisplayText(p.value)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading && rows.length === 0 ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : (
        <TablePanel>
          <CommonTable
            columns={columns}
            rows={rows}
            getRowKey={(r, i) =>
              String(r._id || r.transactionId || r.TransactionID || i)
            }
            loading={loading}
            emptyMessage="No data found"
            minWidth={1200}
            dense
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
