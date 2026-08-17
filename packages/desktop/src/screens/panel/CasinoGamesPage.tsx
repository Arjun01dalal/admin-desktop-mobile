import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HideImageOutlinedIcon from '@mui/icons-material/HideImageOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { display } from '@/screens/panel/shared';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type CasinoGameRow = {
  _id: string;
  Name?: string;
  gameId?: string;
  Game_Code?: string;
  tableId?: string;
  category?: string;
  Category_ID?: string;
  provider?: { id?: string; name?: string };
  Provider_ID?: string;
  images?: Array<{ url?: string }>;
  Thumbnail?: string;
  status?: boolean;
  [key: string]: unknown;
};

type MiraiType = 'mirai casino' | 'mirai helix' | 'mirai catfish';

const PROVIDER_OPTIONS = ['QTECH', 'WACS'] as const;
type CasinoProvider = (typeof PROVIDER_OPTIONS)[number];

const GAME_CATEGORIES = [
  'Andar Bahar',
  'Roulette',
  'Dragon Tiger',
  'Lucky Sevens',
  'Poker',
  'Teen Patti',
  'BlackJack',
] as const;

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const headerFieldSx = {
  minWidth: 180,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
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

function gameCode(row: CasinoGameRow): string {
  return display(row.gameId || row.Game_Code);
}

function providerId(row: CasinoGameRow): string {
  return display(row.provider?.id || row.Provider_ID);
}

function category(row: CasinoGameRow): string {
  return display(row.category || row.Category_ID);
}

function imageUrl(row: CasinoGameRow): string | null {
  return row.images?.[0]?.url || row.images?.[1]?.url || row.Thumbnail || null;
}

function asProvider(value: unknown): CasinoProvider {
  return value === 'WACS' ? 'WACS' : 'QTECH';
}

/** Normalize `/Qtech/Get-provider` payload into selectable name strings. */
function asProviderNames(data: unknown): string[] {
  const fromArray = (items: unknown[]): string[] =>
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          const name = o.name ?? o.Name ?? o.providerName ?? o.id;
          return name != null ? String(name).trim() : '';
        }
        return '';
      })
      .filter(Boolean);

  if (Array.isArray(data)) return fromArray(data);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return fromArray(obj.payload);
    if (Array.isArray(obj.items)) return fromArray(obj.items);
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      const nested = obj.payload as Record<string, unknown>;
      if (Array.isArray(nested.items)) return fromArray(nested.items);
    }
  }
  return [];
}

export function CasinoGamesPage() {
  useRevealCodes();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [nameSearch, setNameSearch] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [appliedId, setAppliedId] = useState('');
  const [gameCategory, setGameCategory] = useState('');
  const [providerNameSearch, setProviderNameSearch] = useState('');
  const [providerOptions, setProviderOptions] = useState<string[]>([]);

  const [activeProvider, setActiveProvider] = useState<CasinoProvider>('QTECH');
  const pendingProvider = useRef<CasinoProvider>('QTECH');
  const [providerConfirmOpen, setProviderConfirmOpen] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);

  const [miraiOpen, setMiraiOpen] = useState(false);
  const [lobbySwitch, setLobbySwitch] = useState(false);
  const [helixSwitch, setHelixSwitch] = useState(false);
  const [catfishSwitch, setCatfishSwitch] = useState(false);

  const [tableIdOpen, setTableIdOpen] = useState(false);
  const [tableIdGameName, setTableIdGameName] = useState('');
  const [tableIdGameId, setTableIdGameId] = useState('');
  const [tableIdValue, setTableIdValue] = useState('');
  const [tableIdError, setTableIdError] = useState('');
  const [tableIdSaving, setTableIdSaving] = useState(false);

  const [rows, setRows] = useState<CasinoGameRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const loadConfig = useCallback(async () => {
    const res = await secureApi<{ activeCasinoProvider?: string }>('ops.casinoGetConfig');
    if (!res.ok) return;
    const provider = asProvider(
      (res.data as { activeCasinoProvider?: string } | undefined)?.activeCasinoProvider,
    );
    setActiveProvider(provider);
  }, []);

  const loadProviderOptions = useCallback(async () => {
    const res = await secureApi('ops.casinoGetProviders', {});
    if (!res.ok) return;
    setProviderOptions(asProviderNames(res.data));
  }, []);

  const loadMiraiStatus = useCallback(async () => {
    const res = await secureApi<Array<{ type?: string; status?: boolean }>>('ops.casinoMiraiGet', {});
    if (!res.ok || !Array.isArray(res.data)) return;
    for (const item of res.data) {
      switch (item.type) {
        case 'mirai casino':
          setLobbySwitch(Boolean(item.status));
          break;
        case 'mirai helix':
          setHelixSwitch(Boolean(item.status));
          break;
        case 'mirai catfish':
          setCatfishSwitch(Boolean(item.status));
          break;
        default:
          break;
      }
    }
  }, []);

  const load = useCallback(
    async (
      pageNo = page,
      nameOverride = appliedName,
      idOverride = appliedId,
      categoryOverride = gameCategory,
      providerOverride = activeProvider,
      providerNameOverride = providerNameSearch,
    ) => {
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filters: Record<string, string> = {};
        const nameFilter = categoryOverride.trim() || nameOverride.trim();
        if (nameFilter) filters.Name = nameFilter;
        if (idOverride.trim()) {
          if (providerOverride === 'QTECH') filters.gameId = idOverride.trim();
          else filters.Game_Code = idOverride.trim();
        }
        if (providerOverride === 'QTECH' && providerNameOverride.trim()) {
          filters['provider.name'] = providerNameOverride.trim();
        }

        const res = await secureApi('ops.casinoGetData', {
          pageNo,
          itemsPerPage: pageSize,
          Filters: filters,
        });
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load casino games';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.items) ? (data.items as CasinoGameRow[]) : [];
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      page,
      pageSize,
      appliedName,
      appliedId,
      gameCategory,
      activeProvider,
      providerNameSearch,
      next,
      begin,
      end,
      isCurrent,
    ],
  );

  useEffect(() => {
    void loadConfig();
    void loadMiraiStatus();
    void loadProviderOptions();
  }, [loadConfig, loadMiraiStatus, loadProviderOptions]);

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, activeProvider, gameCategory, providerNameSearch]);

  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedName(nameSearch);
    setAppliedId(idSearch);
    setPage(1);
    void load(1, nameSearch, idSearch, gameCategory, activeProvider, providerNameSearch);
  }, [nameSearch, idSearch, gameCategory, activeProvider, providerNameSearch, load]);

  const confirmProviderChange = useCallback(async () => {
    setProviderSaving(true);
    try {
      const nextProvider = pendingProvider.current;
      const res = await secureApi('ops.casinoSetActiveProvider', {
        casinoActiveProvider: nextProvider,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update casino provider');
        return;
      }
      setActiveProvider(nextProvider);
      setProviderNameSearch('');
      setProviderConfirmOpen(false);
      setPage(1);
      toast.success(`Active provider set to ${nextProvider}`);
    } finally {
      setProviderSaving(false);
    }
  }, []);

  const setMiraiStatus = useCallback(async (type: MiraiType, status: boolean) => {
    const res = await secureApi('ops.casinoMiraiStatus', { type, status });
    if (!res.ok) {
      toast.error(res.message || 'Failed to update Mirai status');
      void loadMiraiStatus();
    }
  }, [loadMiraiStatus]);

  const openTableIdDialog = useCallback((row: CasinoGameRow) => {
    setTableIdGameName(row.Name || '');
    setTableIdGameId(row.gameId || '');
    setTableIdValue(row.tableId || '');
    setTableIdError('');
    setTableIdOpen(true);
  }, []);

  const closeTableIdDialog = useCallback(() => {
    setTableIdOpen(false);
    setTableIdError('');
    setTableIdValue('');
    setTableIdGameName('');
    setTableIdGameId('');
  }, []);

  const submitTableId = useCallback(async () => {
    if (!tableIdValue.trim()) {
      setTableIdError('Please Enter Table Id');
      return;
    }
    if (!tableIdGameId) {
      toast.error('Game ID missing');
      return;
    }
    setTableIdSaving(true);
    try {
      const res = await secureApi('ops.casinoAddTableId', {
        tableId: tableIdValue.trim(),
        gameId: tableIdGameId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to save table id');
        return;
      }
      setRows((prev) =>
        prev.map((item) =>
          item.gameId === tableIdGameId
            ? { ...item, tableId: tableIdValue.trim() }
            : item,
        ),
      );
      toast.success('Table Id uploaded successfully');
      closeTableIdDialog();
    } finally {
      setTableIdSaving(false);
    }
  }, [tableIdValue, tableIdGameId, closeTableIdDialog]);

  const toggleStatus = useCallback(async (row: CasinoGameRow) => {
    const nextStatus = !row.status;
    setTogglingId(row._id);
    try {
      const res = await secureApi('ops.casinoEditGame', {
        gameId: row.gameId ?? row._id,
        _id: row._id,
        status: nextStatus,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update game status');
        return;
      }
      setRows((prev) =>
        prev.map((item) => (item._id === row._id ? { ...item, status: nextStatus } : item)),
      );
      toast.success(nextStatus ? 'Game enabled' : 'Game disabled');
    } finally {
      setTogglingId(null);
    }
  }, []);

  const columns = useMemo<CommonTableColumn<CasinoGameRow>[]>(() => {
    const cols: CommonTableColumn<CasinoGameRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'id',
        label: 'ID',
        render: (row) => (
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
            {row._id || '—'}
          </Typography>
        ),
      },
      {
        id: 'name',
        label: 'Game Name',
        filter: (
          <ColumnSearch
            value={nameSearch}
            onChange={setNameSearch}
            onSearch={search}
            placeholder="Search game name"
          />
        ),
        render: (row) => (
          <Typography variant="body2" fontWeight={600}>
            {display(row.Name)}
          </Typography>
        ),
      },
      {
        id: 'gameId',
        label: activeProvider === 'WACS' ? 'Game Code' : 'Game ID',
        filter: (
          <ColumnSearch
            value={idSearch}
            onChange={setIdSearch}
            onSearch={search}
            placeholder={activeProvider === 'WACS' ? 'Search game code' : 'Search game id'}
          />
        ),
        render: (row) => gameCode(row),
      },
    ];

    if (activeProvider === 'QTECH') {
      cols.push({
        id: 'tableId',
        label: 'Table ID',
        width: 140,
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.tableId)}</Typography>
            <Button
              size="small"
              onClick={() => openTableIdDialog(row)}
              sx={{
                minWidth: 28,
                width: 28,
                height: 28,
                p: 0,
                color: '#ff9f0a',
              }}
              aria-label="Add table id"
            >
              <AddIcon fontSize="small" />
            </Button>
          </Stack>
        ),
      });
    }

    cols.push(
      {
        id: 'providerId',
        label: 'Provider ID',
        render: (row) => providerId(row),
      },
      {
        id: 'category',
        label: 'Category',
        render: (row) => category(row),
      },
      {
        id: 'image',
        label: 'Image',
        width: 100,
        render: (row) => {
          const src = imageUrl(row);
          return src ? (
            <Box
              component="img"
              src={src}
              alt={row.Name || 'game'}
              sx={{
                height: 40,
                width: 64,
                objectFit: 'cover',
                borderRadius: 1,
                display: 'block',
                mx: 'auto',
              }}
            />
          ) : (
            <HideImageOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: 120,
        render: (row) => (
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
            <Switch
              size="small"
              checked={Boolean(row.status)}
              disabled={togglingId === row._id}
              onChange={() => void toggleStatus(row)}
              color="warning"
            />
            <Chip
              size="small"
              label={row.status ? 'Active' : 'Inactive'}
              color={row.status ? 'success' : 'default'}
              sx={{ fontWeight: 600, fontSize: 11 }}
            />
          </Stack>
        ),
      },
    );

    return cols;
  }, [
    page,
    pageSize,
    nameSearch,
    idSearch,
    search,
    togglingId,
    toggleStatus,
    activeProvider,
    openTableIdDialog,
  ]);

  return (
    <Box>
      <CollapsibleFilterPanel
        title={toDisplayText('Casino Games')}
        summary={`${toDisplayText(activeProvider)} · ${gameCategory || 'All categories'} · ${pageSize} per page`}
        headerActions={
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={(event) => {
              event.stopPropagation();
              void load(page);
            }}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        }
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
          <TextField
            select
            label={toDisplayText('Active Casino Provider')}
            size="small"
            value={activeProvider}
            onChange={(e) => {
              const nextProvider = asProvider(e.target.value);
              if (nextProvider === activeProvider) return;
              pendingProvider.current = nextProvider;
              setProviderConfirmOpen(true);
            }}
            sx={headerFieldSx}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {toDisplayText(opt)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={() => {
              void loadMiraiStatus();
              setMiraiOpen(true);
            }}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5, flexShrink: 0 }}
          >
            Mirai Games
          </Button>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, minWidth: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Game Category"
            size="small"
            value={gameCategory}
            onChange={(e) => {
              setGameCategory(e.target.value);
              setPage(1);
            }}
            sx={{ ...headerFieldSx, minWidth: 200 }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {GAME_CATEGORIES.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          {activeProvider === 'QTECH' ? (
            <TextField
              select
              label="Provider Name"
              size="small"
              value={providerNameSearch}
              onChange={(e) => {
                setProviderNameSearch(e.target.value);
                setPage(1);
              }}
              sx={{ ...headerFieldSx, minWidth: 200 }}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {providerOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          <Pagination
            count={Math.max(1, totalPages)}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
            disabled={loading}
          />
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No casino games found"
          stickyHeader
          dense
          minWidth={1100}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={providerConfirmOpen} onClose={() => setProviderConfirmOpen(false)}>
        <DialogTitle>Are You Sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Change active {toDisplayText('casino')} provider to{' '}
            <strong>{toDisplayText(pendingProvider.current)}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProviderConfirmOpen(false)} disabled={providerSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void confirmProviderChange()}
            disabled={providerSaving}
            sx={orangeBtnSx}
          >
            {providerSaving ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={miraiOpen} onClose={() => setMiraiOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mirai Games</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} pt={1}>
            <FormControlLabel
              control={
                <Switch
                  color="warning"
                  checked={lobbySwitch}
                  onChange={(e) => {
                    const nextStatus = e.target.checked;
                    setLobbySwitch(nextStatus);
                    void setMiraiStatus('mirai casino', nextStatus);
                  }}
                />
              }
              label="Lobby"
            />
            <FormControlLabel
              control={
                <Switch
                  color="warning"
                  checked={helixSwitch}
                  onChange={(e) => {
                    const nextStatus = e.target.checked;
                    setHelixSwitch(nextStatus);
                    void setMiraiStatus('mirai helix', nextStatus);
                  }}
                />
              }
              label="Helix"
            />
            <FormControlLabel
              control={
                <Switch
                  color="warning"
                  checked={catfishSwitch}
                  onChange={(e) => {
                    const nextStatus = e.target.checked;
                    setCatfishSwitch(nextStatus);
                    void setMiraiStatus('mirai catfish', nextStatus);
                  }}
                />
              }
              label="Catfish"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMiraiOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tableIdOpen} onClose={closeTableIdDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Add Table ID</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <TextField
              size="small"
              fullWidth
              label="Game Name"
              value={tableIdGameName}
              disabled
            />
            <TextField
              size="small"
              fullWidth
              label="Enter Table Id"
              value={tableIdValue}
              error={Boolean(tableIdError)}
              helperText={tableIdError || ' '}
              onChange={(e) => {
                setTableIdError('');
                setTableIdValue(e.target.value);
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTableIdDialog} disabled={tableIdSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitTableId()}
            disabled={tableIdSaving}
            sx={orangeBtnSx}
          >
            {tableIdSaving ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
