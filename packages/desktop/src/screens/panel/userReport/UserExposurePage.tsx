import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { fieldSx } from '@/screens/panel/transactions/shared';

type ProviderKey =
  | 'SattaMatka'
  | 'Falcon'
  | 'Jetfair'
  | 'WCO'
  | 'AAAExchange'
  | 'PlutusGaming';

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
  { value: 'Plutus Gaming', key: 'PlutusGaming' },
];

type ColDef = {
  label: string;
  key: string;
  kind?: 'date' | 'layBack' | 'amount' | 'srNo';
};

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
  /** Fallback only — Plutus columns are built dynamically from row keys. */
  PlutusGaming: [
    { label: 'Created On', key: 'createdOn', kind: 'date' },
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
  for (let i = 0; i < 6; i += 1) {
    if (Array.isArray(cur)) return cur as Row[];
    if (!cur || typeof cur !== 'object') break;
    const o = cur as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Row[];
    if (Array.isArray(o.payload)) return o.payload as Row[];
    if (o.payload != null && typeof o.payload === 'object') {
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

function resolveNested(row: Row, key: string): unknown {
  const direct = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, row);
  if (direct !== undefined) return direct;
  const raw = row.rawPayload;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, raw);
  }
  return undefined;
}

function isPlainNumeric(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'object') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return /^-?\d+(\.\d+)?$/.test(value.trim());
  return false;
}

function cellValue(row: Row, col: ColDef, opts?: { srNo?: number }): string {
  if (col.kind === 'srNo') return String(opts?.srNo ?? '-');
  const raw = resolveNested(row, col.key);
  if (col.kind === 'date') {
    const d = formatDisplayDate(raw);
    const t = formatDisplayTime(raw);
    return d ? `${d} , ${t}` : '-';
  }
  if (col.kind === 'layBack') return raw ? 'Back' : 'Lay';
  if (col.kind === 'amount') return String(formatAmount(Number(raw) || 0));
  if (typeof raw === 'boolean') return String(raw);
  if (isPlainNumeric(raw) && col.kind !== 'date') {
    return String(Math.round(Number(raw)));
  }
  if (raw != null && typeof raw === 'object') {
    const serialized = JSON.stringify(raw);
    return serialized.length > 220 ? `${serialized.slice(0, 220)}...` : serialized;
  }
  if (raw == null || raw === '') return '-';
  return String(raw);
}

const PLUTUS_SKIP_KEYS = new Set([
  'txnState',
  'age',
  'rawPayload',
  '__v',
  '_v',
  '_id',
]);

const PLUTUS_DATE_KEYS = new Set([
  'createdOn',
  'updatedOn',
  'createdAt',
  'updatedAt',
  'CreatedOn',
  'UpdatedOn',
]);

const PLUTUS_AMOUNT_KEYS = new Set([
  'amount',
  'betAmount',
  'winAmount',
  'stake',
  'winning',
  'wining',
]);

function humanizePlutusKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mergePlutusRow(row: Row): Row {
  const merged: Row = { ...row };
  const raw = row.rawPayload;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.assign(merged, raw as Row);
  }
  return merged;
}

/** Field chips for Plutus — same CompactStat look as User Report summary cards. */
function plutusCardFields(row: Row): { label: string; value: string }[] {
  const merged = mergePlutusRow(row);
  const preferred = [
    'gameName',
    'gameId',
    'transactionId',
    'roundId',
    'amount',
    'betAmount',
    'stake',
    'winAmount',
    'status',
    'betStatus',
    'createdOn',
    'updatedOn',
    'createdAt',
    'updatedAt',
  ];
  const keys = [
    ...preferred.filter((k) => merged[k] != null && merged[k] !== ''),
    ...Object.keys(merged).filter(
      (k) =>
        !PLUTUS_SKIP_KEYS.has(k) &&
        !preferred.includes(k) &&
        merged[k] != null &&
        merged[k] !== '',
    ),
  ];
  return keys.map((key) => {
    const kind: ColDef['kind'] = PLUTUS_DATE_KEYS.has(key)
      ? 'date'
      : PLUTUS_AMOUNT_KEYS.has(key)
        ? 'amount'
        : undefined;
    return {
      label: humanizePlutusKey(key),
      value: cellValue(merged, { label: key, key, kind }),
    };
  });
}

function plutusCardSummary(fields: { label: string; value: string }[]): {
  title: string;
  subtitle: string;
} {
  const pick = (...labels: string[]) =>
    fields.find((f) => labels.includes(f.label.toLowerCase()))?.value;
  const title =
    pick('game name', 'gamename') ||
    pick('transaction id', 'transactionid') ||
    fields[0]?.value ||
    'Bet';
  const parts = [
    pick('amount', 'bet amount', 'betamount', 'stake'),
    pick('status', 'bet status', 'betstatus'),
  ].filter((v) => v && v !== '-');
  return { title: String(title), subtitle: parts.join(' · ') || `${fields.length} fields` };
}

function PlutusFieldChips({ fields }: { fields: { label: string; value: string }[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
        gap: 0.5,
      }}
    >
      {fields.map((f) => (
        <Box
          key={f.label}
          sx={{
            minWidth: 0,
            px: 0.6,
            py: 0.35,
            bgcolor: '#f6f7f9',
            border: '1px solid #e5e7eb',
            borderRadius: 1,
          }}
        >
          <Typography
            noWrap
            title={f.label}
            sx={{ fontSize: 10, lineHeight: 1.15, color: '#667085' }}
          >
            {f.label}
          </Typography>
          <Typography
            noWrap
            title={f.value}
            sx={{
              fontSize: 12,
              lineHeight: 1.35,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function buildPlutusColumns(rows: Row[]): ColDef[] {
  if (!rows.length) return TABLE_COLS.PlutusGaming;
  const sample = mergePlutusRow(rows[0]);
  const keys = Object.keys(sample).filter((k) => !PLUTUS_SKIP_KEYS.has(k));
  return [
    { label: 'Sr. No', key: '__srNo', kind: 'srNo' },
    ...keys.map((k) => ({
      label: humanizePlutusKey(k),
      key: k,
      kind: (PLUTUS_DATE_KEYS.has(k)
        ? 'date'
        : PLUTUS_AMOUNT_KEYS.has(k)
          ? 'amount'
          : undefined) as ColDef['kind'] | undefined,
    })),
  ];
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
    PlutusGaming: [],
  });
  const [plutusPage, setPlutusPage] = useState(1);
  const [plutusItemsPerPage, setPlutusItemsPerPage] = useState(20);
  const [plutusDetail, setPlutusDetail] = useState<{
    sr: number;
    fields: { label: string; value: string }[];
  } | null>(null);

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
    setPlutusPage(1);
    setPlutusDetail(null);
    if (next !== 'WCO' && next !== 'AAA Exchange' && next !== 'Plutus Gaming') {
      return;
    }

    setLoading(true);
    try {
      if (next === 'Plutus Gaming') {
        if (!userId) {
          toast.error('User id missing for Plutus Gaming request');
          return;
        }
        const res = await secureApi('userReport.plutusPendingBets', {
          userId,
          itemsPerPage: 100,
          pageNo: 1,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to load Plutus Gaming');
          return;
        }
        setDataMap((prev) => ({
          ...prev,
          PlutusGaming: unpackPendingList(res.data),
        }));
        return;
      }

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
  const isPlutus = provider === 'Plutus Gaming';
  const allRows = dataMap[providerKey] || [];
  const totalPages = isPlutus
    ? Math.max(1, Math.ceil(allRows.length / plutusItemsPerPage))
    : 1;
  const rows = isPlutus
    ? allRows.slice(
        (plutusPage - 1) * plutusItemsPerPage,
        plutusPage * plutusItemsPerPage,
      )
    : allRows;
  const colDefs = isPlutus ? buildPlutusColumns(allRows) : TABLE_COLS[providerKey];

  const columns = useMemo<CommonTableColumn<Row>[]>(
    () =>
      colDefs.map((col) => ({
        id: col.key,
        label: col.label,
        render: (r, index) =>
          cellValue(r, col, {
            srNo: isPlutus
              ? (plutusPage - 1) * plutusItemsPerPage + index + 1
              : undefined,
          }),
      })),
    [colDefs, isPlutus, plutusItemsPerPage, plutusPage],
  );

  return (
    <Box sx={{ p: 1 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        mb={1.5}
        mt={0.5}
        flexWrap="nowrap"
        useFlexGap
        sx={{ overflowX: 'auto', pt: 0.75 }}
      >
        <Typography fontWeight={700} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {toDisplayText('User Exposure')}
        </Typography>
        <TextField
          select
          size="small"
          label="Provider"
          value={provider}
          onChange={(e) => void onProviderChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ ...fieldSx, width: 200, minWidth: 200, flex: '0 0 auto' }}
        >
          {PROVIDERS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {toDisplayText(p.value)}
            </MenuItem>
          ))}
        </TextField>
        {isPlutus ? (
          <TextField
            select
            size="small"
            label="Items / page"
            value={String(plutusItemsPerPage)}
            onChange={(e) => {
              setPlutusItemsPerPage(Number(e.target.value) || 20);
              setPlutusPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ ...fieldSx, width: 140, minWidth: 140, flex: '0 0 auto' }}
          >
            {[10, 20, 50, 100].map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Stack>

      {loading && rows.length === 0 ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : isPlutus ? (
        <Stack spacing={1}>
          {rows.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No data found
            </Typography>
          ) : (
            rows.map((r, i) => {
              const sr = (plutusPage - 1) * plutusItemsPerPage + i + 1;
              const fields = plutusCardFields(r);
              const summary = plutusCardSummary(fields);
              return (
                <Box
                  key={String(r._id || r.transactionId || i)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlutusDetail({ sr, fields })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPlutusDetail({ sr, fields });
                    }
                  }}
                  sx={{
                    px: 1.25,
                    py: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    '&:hover': {
                      borderColor: 'warning.main',
                      bgcolor: '#fffaf3',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      noWrap
                      sx={{ fontSize: 13, fontWeight: 700, color: '#111827' }}
                    >
                      #{sr} · {summary.title}
                    </Typography>
                    {summary.subtitle ? (
                      <Typography
                        noWrap
                        sx={{ fontSize: 11, color: '#667085', mt: 0.15 }}
                      >
                        {summary.subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  <ExpandMoreIcon sx={{ color: '#98a2b3', fontSize: 22, flexShrink: 0 }} />
                </Box>
              );
            })
          )}
          {totalPages > 1 ? (
            <Stack alignItems="center" py={1.5}>
              <Pagination
                count={totalPages}
                page={plutusPage}
                onChange={(_e, p) => setPlutusPage(p)}
                color="secondary"
              />
            </Stack>
          ) : null}

          <Dialog
            open={plutusDetail != null}
            onClose={() => setPlutusDetail(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
              {toDisplayText('Plutus Gaming')} #{plutusDetail?.sr ?? ''}
            </DialogTitle>
            <DialogContent dividers>
              {plutusDetail ? <PlutusFieldChips fields={plutusDetail.fields} /> : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPlutusDetail(null)} sx={{ textTransform: 'none' }}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
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
