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
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { UserReportTablePanel } from './UserReportTablePanel';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
} from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

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

const EXPOSURE_FIELD_SX = {
  width: '100%',
  minWidth: 0,
  flex: '0 0 auto',
  '& .MuiInputLabel-root': {
    fontSize: 13,
    color: '#667085',
    '&.Mui-focused': { color: '#344054' },
  },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: '#111',
    fontSize: 13,
    '& fieldset': { borderColor: '#b8c2cf' },
    '&:hover fieldset': { borderColor: '#98a2b3' },
    '&.Mui-focused fieldset': { borderColor: '#1976d2' },
  },
  '& .MuiSelect-select': {
    color: '#111 !important',
    WebkitTextFillColor: '#111 !important',
  },
  '& .MuiSelect-icon': { color: '#667085' },
};

const EXPOSURE_STATUS: Record<string, { value: string; label: string }[]> = {
  SattaMatka: [
    { value: 'w', label: 'Win' },
    { value: 'l', label: 'Loss' },
  ],
  Falcon: [
    { value: 'C', label: 'Cancel' },
    { value: 'W', label: 'Win' },
    { value: 'L', label: 'Loss' },
  ],
  Jetfair: [
    { value: 'settle', label: 'Settle' },
    { value: 'Cancel', label: 'Cancel' },
  ],
  WCO: [
    { value: 'L', label: 'Loss' },
    { value: 'W', label: 'Win' },
    { value: 'R', label: 'Rollback' },
    { value: 'C', label: 'Completed' },
  ],
  AAAExchange: [
    { value: 'Cancel', label: 'Cancel' },
    { value: 'Resettle Market', label: 'Resettle Market' },
    { value: 'C', label: 'Completed' },
  ],
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
    { label: 'Event Type Name', key: 'Eventtypename' },
    { label: 'Market ID', key: 'MarketID' },
    { label: 'Market Name', key: 'Marketname' },
    { label: 'Market Type', key: 'Markettype' },
    { label: 'Runner ID', key: 'RunnerID' },
    { label: 'Runner Name', key: 'Runnername' },
    { label: 'TransactionID', key: 'TransactionID' },
    { label: 'Amount', key: 'Amount', kind: 'amount' },
    { label: 'Commission Amount', key: 'CommissionAmount', kind: 'amount' },
    { label: 'Cashout Amount', key: 'cashoutAmount', kind: 'amount' },
    { label: 'Payable Amount', key: 'PayableAmount', kind: 'amount' },
    { label: 'Session Point', key: 'SessionPoint' },
    { label: 'Point', key: 'Point' },
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
    { label: 'Transaction Code', key: 'transactionCode' },
    { label: 'Transaction Type', key: 'transactionType' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Commission', key: 'commissionAmount', kind: 'amount' },
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
    { label: 'Name', key: 'Name' },
    { label: 'Transaction ID', key: 'transactionId' },
    { label: 'Provider Transaction ID', key: 'providerTransactionId' },
    { label: 'Round ID', key: 'roundId' },
    { label: 'Action', key: 'action' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Winning', key: 'wining', kind: 'amount' },
    { label: 'Status', key: 'status' },
    { label: 'Created On', key: 'createdOn', kind: 'date' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
  ],
  AAAExchange: [
    { label: 'User ID', key: 'userId' },
    { label: 'Transaction ID', key: 'transactionId' },
    { label: 'Transaction Type', key: 'transactionType' },
    { label: 'Sport Name', key: 'sportName' },
    { label: 'Tournament Name', key: 'tournamentName' },
    { label: 'Game ID', key: 'gameId' },
    { label: 'Game Name', key: 'gameName' },
    { label: 'Game Name Exch', key: 'gameNameExchange' },
    { label: 'Market ID', key: 'marketId' },
    { label: 'Market Name', key: 'marketName' },
    { label: 'Market Type', key: 'marketType' },
    { label: 'Runner', key: 'runner' },
    { label: 'Bet Type', key: 'isBack', kind: 'layBack' },
    { label: 'Rate', key: 'rate' },
    { label: 'Run', key: 'run' },
    { label: 'Amount', key: 'amount', kind: 'amount' },
    { label: 'Balance', key: 'balance', kind: 'amount' },
    { label: 'Updated On', key: 'updatedOn', kind: 'date' },
    { label: 'Status', key: 'status' },
    { label: 'Action', key: 'action' },
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

function statusOptionsFor(providerKey: ProviderKey) {
  return EXPOSURE_STATUS[providerKey] ?? [];
}

/** Laxmi UserExposure — opened when User Exposure Total Sum > 0. */
export function UserExposurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = resolveUserId(location.state);
  const admin = getStoredUser<{ _id?: string; name?: string; mobile?: string }>();

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
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editWinning, setEditWinning] = useState('0');
  const [saving, setSaving] = useState(false);

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
    setEditOpen(false);
    setEditRow(null);
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

  const reloadCurrentProvider = useCallback(async () => {
    if (provider === 'Plutus Gaming' || provider === 'WCO' || provider === 'AAA Exchange') {
      await onProviderChange(provider);
      return;
    }
    await loadLists();
  }, [provider, loadLists]);

  const providerKey =
    PROVIDERS.find((p) => p.value === provider)?.key || 'SattaMatka';
  const isPlutus = provider === 'Plutus Gaming';
  const statusOptions = statusOptionsFor(providerKey);
  const showWinningField =
    provider === 'WCO' && (editStatus === 'W' || editStatus === 'R');
  const showAmountField = provider === 'SattaMatka' && editStatus === 'w';

  const openEdit = useCallback(
    (row: Row) => {
      if (provider === 'Plutus Gaming') return;
      setEditRow(row);
      setEditStatus(providerKey === 'SattaMatka' ? 'l' : '');
      setEditAmount('');
      setEditWinning('0');
      setEditOpen(true);
    },
    [provider, providerKey],
  );

  const submitEdit = useCallback(async () => {
    if (!editRow || !userId || provider === 'Plutus Gaming') return;
    const status = editStatus.trim();
    if (!status) {
      toast.error('Please select a status');
      return;
    }
    setSaving(true);
    try {
      const updatedBy = {
        _id: admin?._id,
        name: admin?.name,
        mobile: admin?.mobile,
      };
      let action:
        | 'userReport.updateBetsAdmin'
        | 'userReport.updateBetsFalcon'
        | 'userReport.updateBetsJetfair'
        | 'userReport.updateWcoWinning'
        | 'userReport.updateExchangePendingBet';
      let payload: Record<string, unknown>;

      if (provider === 'WCO') {
        action = 'userReport.updateWcoWinning';
        payload = {
          userId,
          transactionId: editRow.transactionId ?? editRow.TransactionID,
          wining: Number(editWinning) || 0,
          status,
          updatedBy,
        };
      } else if (provider === 'AAA Exchange') {
        action = 'userReport.updateExchangePendingBet';
        payload = {
          userId,
          transactionId: editRow.transactionId ?? editRow.TransactionID,
          status,
          updatedBy,
        };
      } else if (provider === 'Falcon') {
        action = 'userReport.updateBetsFalcon';
        payload = { status, _id: editRow._id, updatedBy };
      } else if (provider === 'Jetfair') {
        action = 'userReport.updateBetsJetfair';
        payload = { status, _id: editRow._id, updatedBy };
      } else {
        action = 'userReport.updateBetsAdmin';
        payload = {
          _id: editRow._id,
          status,
          amount: editAmount,
          updatedBy: { _id: admin?._id, name: admin?.name },
        };
      }

      const res = await secureApi(action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Could not update this bet');
        return;
      }
      toast.success(`${provider} updated successfully`);
      setEditOpen(false);
      setEditRow(null);
      await reloadCurrentProvider();
    } finally {
      setSaving(false);
    }
  }, [
    admin,
    editAmount,
    editRow,
    editStatus,
    editWinning,
    provider,
    reloadCurrentProvider,
    userId,
  ]);

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

  const columns = useMemo<CommonTableColumn<Row>[]>(() => {
    const dataCols: CommonTableColumn<Row>[] = colDefs.map((col) => ({
      id: col.key,
      label: col.label,
      render: (r, index) =>
        cellValue(r, col, {
          srNo: isPlutus
            ? (plutusPage - 1) * plutusItemsPerPage + index + 1
            : undefined,
        }),
    }));
    if (isPlutus) return dataCols;
    return [
      ...dataCols,
      {
        id: 'edit',
        label: 'Edit',
        width: 64,
        render: (row) => (
          <IconButton
            size="small"
            aria-label="Edit exposure row"
            onClick={() => openEdit(row)}
            sx={{ color: 'warning.main' }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        ),
      },
    ];
  }, [colDefs, isPlutus, openEdit, plutusItemsPerPage, plutusPage]);

  return (
    <Box sx={{ p: 1 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        mb={1.5}
        mt={0.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ pt: 0.75 }}
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
          SelectProps={{
            renderValue: (value) => toDisplayText(String(value)),
          }}
          sx={{ ...EXPOSURE_FIELD_SX, width: 220, minWidth: 220 }}
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
            fullWidth={false}
            value={String(plutusItemsPerPage)}
            onChange={(e) => {
              setPlutusItemsPerPage(Number(e.target.value) || 20);
              setPlutusPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ ...EXPOSURE_FIELD_SX, width: 140, minWidth: 140 }}
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
      ) : (
        <UserReportTablePanel
          footer={
            isPlutus && totalPages > 1 ? (
              <Pagination
                count={totalPages}
                page={plutusPage}
                onChange={(_e, p) => setPlutusPage(p)}
                color="secondary"
              />
            ) : undefined
          }
          footerJustify="center"
        >
          <CommonTable
            columns={columns}
            rows={rows}
            getRowKey={(r, i) =>
              String(r._id || r.transactionId || r.TransactionID || i)
            }
            loading={loading}
            emptyMessage="No data found"
            minWidth={isPlutus ? 1800 : 1400}
            dense
            maxHeight="100%"
          />
        </UserReportTablePanel>
      )}

      <Dialog
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {['WCO', 'AAA Exchange'].includes(provider)
            ? `Update ${toDisplayText(provider)}`
            : 'Update Record'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Select Status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
            sx={EXPOSURE_FIELD_SX}
          >
            <MenuItem value="">Select Status</MenuItem>
            {statusOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {showWinningField ? (
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Winning Amount"
              value={editWinning}
              onChange={(e) => setEditWinning(e.target.value)}
              sx={EXPOSURE_FIELD_SX}
            />
          ) : null}
          {showAmountField ? (
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Enter Amount"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              sx={EXPOSURE_FIELD_SX}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={() => setEditOpen(false)}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => void submitEdit()}
            sx={{ textTransform: 'none' }}
          >
            {saving ? 'Updating…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
