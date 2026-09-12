import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  formatGgrDateTime,
  formatGgrMoney,
  ggrTone,
  normalizeGgrLogs,
  normalizeGgrRecipients,
  resolveGgrGameParts,
  todayIstDate,
  unpackSubAdminOptions,
  type GgrAlertGame,
  type GgrAlertLogRow,
  type GgrAlertType,
  type GgrSubAdminOption,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { getSessionUser } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CopyText } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const cardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: '#121218',
  border: '1px solid rgba(255,255,255,0.08)',
};

const fieldSx = {
  '& .MuiInputBase-root': { bgcolor: '#0e0e14' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const LOG_POLL_MS = 15 * 60 * 1000;

const thSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 800,
  fontSize: 12,
  whiteSpace: 'nowrap',
  borderBottom: 'none',
  py: 1.1,
  px: 1.25,
};

const tdSx = {
  borderColor: 'rgba(255,255,255,0.06)',
  color: '#e8e8ea',
  fontSize: 12.5,
  py: 1.1,
  px: 1.25,
  verticalAlign: 'middle',
};

function ggrColor(value: unknown): string {
  const tone = ggrTone(value);
  if (tone === 'neg') return '#f87171';
  if (tone === 'pos') return '#6ee7b7';
  return '#c8cdd8';
}

function Metric({ label, value, emphasize }: { label: string; value: unknown; emphasize?: boolean }) {
  return (
    <Box
      sx={{
        minWidth: 88,
        px: 1,
        py: 0.6,
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Typography sx={{ color: '#8b93a7', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.15,
          fontSize: 12.5,
          fontWeight: emphasize ? 800 : 600,
          color: emphasize ? ggrColor(value) : '#e8e8ea',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatGgrMoney(value)}
      </Typography>
    </Box>
  );
}

function GameSubRows({
  games,
  colSpan,
}: {
  games: GgrAlertGame[];
  colSpan: number;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ ...tdSx, bgcolor: 'rgba(255,159,10,0.04)', py: 1.25, px: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' },
            gap: 1,
          }}
        >
          {games.map((game, gi) => {
            const { gameId, gameName } = resolveGgrGameParts(game);
            return (
              <Box
                key={`g-${gi}`}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: '#16161e',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, color: '#f3f4f6', fontSize: 13 }} noWrap>
                    {gameName || gameId || '—'}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
                    {gameId ? (
                      <Typography sx={{ color: '#9aa3b5', fontSize: 11 }}>ID {gameId}</Typography>
                    ) : null}
                    {game.providerName ? (
                      <Chip
                        size="small"
                        label={String(game.providerName)}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: 'rgba(148,163,184,0.12)',
                          color: '#cbd5e1',
                        }}
                      />
                    ) : null}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Metric label="Bet" value={game.totalBetAmount} />
                  <Metric label="Win" value={game.totalWinAmount} />
                  <Metric label="GGR" value={game.ggr} emphasize />
                </Stack>
              </Box>
            );
          })}
        </Box>
      </TableCell>
    </TableRow>
  );
}

export function GgrAlertPage() {
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subAdminOptions, setSubAdminOptions] = useState<GgrSubAdminOption[]>([]);
  const [selectedSubAdmins, setSelectedSubAdmins] = useState<GgrSubAdminOption[]>([]);
  const [telegramChatIds, setTelegramChatIds] = useState<number[]>([]);
  const [telegramInput, setTelegramInput] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [meta, setMeta] = useState<{
    updatedBy?: { userId?: string; userName?: string };
    updatedAt?: string;
  }>({});

  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<GgrAlertLogRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [startDate, setStartDate] = useState(todayIstDate);
  const [endDate, setEndDate] = useState(todayIstDate);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType] = useState<GgrAlertType>('');
  const [applied, setApplied] = useState({
    startDate: todayIstDate(),
    endDate: todayIstDate(),
    userId: '',
    clientName: '',
    type: '' as GgrAlertType,
  });

  const [runCheckLoading, setRunCheckLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunOk, setLastRunOk] = useState<boolean | null>(null);
  const runInFlight = useRef(false);
  const appliedRef = useRef(applied);
  const pageRef = useRef({ page, pageSize });
  appliedRef.current = applied;
  pageRef.current = { page, pageSize };

  const loadSubAdmins = useCallback(async () => {
    const res = await secureApi('users.getSubAdmins', { pageNo: 1, itemPerPage: 1000 });
    if (!res.ok) {
      toast.error(res.message || 'Failed to load sub-admins');
      setSubAdminOptions([]);
      return [] as GgrSubAdminOption[];
    }
    const options = unpackSubAdminOptions(res.data);
    setSubAdminOptions(options);
    return options;
  }, []);

  const applyRecipients = useCallback((config: ReturnType<typeof normalizeGgrRecipients>, options: GgrSubAdminOption[]) => {
    const map = new Map(options.map((o) => [o.id, o]));
    setSelectedSubAdmins(config.subAdminIds.map((id) => map.get(id) || { id, label: id }));
    setTelegramChatIds(config.telegramChatIds);
    setEnabled(config.enabled);
    setMeta({ updatedBy: config.updatedBy, updatedAt: config.updatedAt });
  }, []);

  const loadRecipients = useCallback(
    async (options?: GgrSubAdminOption[]) => {
      setRecipientsLoading(true);
      try {
        const res = await secureApi('ops.ggrAlertRecipientsGet', {});
        if (!res.ok) {
          toast.error(res.message || 'Failed to load recipients');
          return;
        }
        applyRecipients(normalizeGgrRecipients(res.data), options ?? subAdminOptions);
      } finally {
        setRecipientsLoading(false);
      }
    },
    [applyRecipients, subAdminOptions],
  );

  const loadLogs = useCallback(
    async (
      nextPage: number,
      nextSize: number,
      filters: typeof applied,
      opts?: { silent?: boolean },
    ) => {
      if (!opts?.silent) setLogsLoading(true);
      try {
        const filter: Record<string, string> = {};
        if (filters.userId.trim()) filter.userId = filters.userId.trim();
        if (filters.clientName.trim()) filter.clientName = filters.clientName.trim();
        if (filters.type) filter.type = filters.type;
        const payload: Record<string, unknown> = {
          pageNo: nextPage,
          itemsPerPage: nextSize,
        };
        if (filters.startDate) payload.startDate = filters.startDate;
        if (filters.endDate) payload.endDate = filters.endDate;
        if (Object.keys(filter).length) payload.filter = filter;

        const res = await secureApi('ops.ggrAlertLogsGetAll', payload);
        if (!res.ok) {
          if (!opts?.silent) {
            toast.error(res.message || 'Failed to load alert logs');
            setLogs([]);
            setTotalPages(1);
            setTotal(0);
          }
          return;
        }
        const parsed = normalizeGgrLogs(res.data, nextSize);
        setLogs(parsed.rows);
        setTotalPages(parsed.totalPages);
        setTotal(parsed.total);
        if (nextPage > parsed.totalPages) setPage(parsed.totalPages);
      } finally {
        if (!opts?.silent) setLogsLoading(false);
      }
    },
    [],
  );

  const runCheck = useCallback(
    async (manual = false) => {
      if (runInFlight.current) return;
      runInFlight.current = true;
      if (manual) setRunCheckLoading(true);
      try {
        const res = await secureApi('ops.ggrAlertRunCheck', {});
        setLastRunAt(new Date().toISOString());
        if (!res.ok) {
          setLastRunOk(false);
          if (manual) toast.error(res.message || 'GGR check failed');
          return;
        }
        setLastRunOk(true);
        if (manual) toast.success('GGR check completed');
        const { page: p, pageSize: s } = pageRef.current;
        await loadLogs(p, s, appliedRef.current, { silent: true });
      } finally {
        runInFlight.current = false;
        if (manual) setRunCheckLoading(false);
      }
    },
    [loadLogs],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const options = await loadSubAdmins();
      if (cancelled) return;
      await loadRecipients(options);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per session token
  }, []);

  useEffect(() => {
    void loadLogs(page, pageSize, applied);
  }, [page, pageSize, applied, loadLogs]);

  // Silent log refresh only (no auto run-check spam on mount)
  useEffect(() => {
    const id = window.setInterval(() => {
      const { page: p, pageSize: s } = pageRef.current;
      void loadLogs(p, s, appliedRef.current, { silent: true });
    }, LOG_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadLogs]);

  const saveRecipients = useCallback(async () => {
    const user = getSessionUser();
    setSaving(true);
    try {
      const res = await secureApi('ops.ggrAlertRecipientsSet', {
        subAdminIds: selectedSubAdmins.map((s) => s.id).filter(Boolean),
        telegramChatIds,
        enabled,
        updatedBy: {
          userId: user?._id || '',
          userName: user?.name || '',
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to save recipients');
        return;
      }
      toast.success('Recipients saved');
      await loadRecipients(subAdminOptions);
    } finally {
      setSaving(false);
    }
  }, [selectedSubAdmins, telegramChatIds, enabled, loadRecipients, subAdminOptions]);

  const addTelegramId = useCallback(() => {
    const n = Number(telegramInput.trim());
    if (!Number.isFinite(n)) {
      toast.error('Enter a valid Telegram chat ID (number)');
      return;
    }
    setTelegramChatIds((prev) => (prev.includes(n) ? prev : [...prev, n]));
    setTelegramInput('');
  }, [telegramInput]);

  const colCount = 11;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#e8e8ea' }}>GGR Alert</Typography>
          <Typography sx={{ color: '#9aa3b5', fontSize: 13, mt: 0.35 }}>
            Configure who gets notified and review casino / satta matka GGR alert history.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: '#9aa3b5', fontSize: 12 }}>
            {lastRunAt
              ? `Last run ${formatGgrDateTime(lastRunAt)}${lastRunOk === false ? ' (failed)' : ''}`
              : 'No check run yet'}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={
              runCheckLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
            }
            disabled={runCheckLoading}
            onClick={() => void runCheck(true)}
            sx={orangeBtnSx}
          >
            Manual Run Check
          </Button>
        </Stack>
      </Stack>

      <CollapsibleFilterPanel
        title="Recipients & Config"
        defaultOpen={false}
        summary={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={enabled ? 'Live' : 'Paused'}
              sx={{
                height: 22,
                fontWeight: 700,
                color: enabled ? '#6ee7b7' : '#94a3b8',
                bgcolor: enabled ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.12)',
              }}
            />
            <Typography component="span" sx={{ color: '#9aa3b5', fontSize: 12 }}>
              {selectedSubAdmins.length} sub-admins · {telegramChatIds.length} telegram
            </Typography>
          </Stack>
        }
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
          <Box sx={{ ...cardSx, flex: 1.4, position: 'relative', mb: 0 }}>
            {recipientsLoading ? (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.35)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 1,
                  borderRadius: 2,
                }}
              >
                <CircularProgress size={28} />
              </Box>
            ) : null}
            <Typography sx={{ fontWeight: 700, color: '#e8e8ea', mb: 0.5 }}>Recipients</Typography>
            <Typography sx={{ color: '#9aa3b5', fontSize: 12, mb: 1.5 }}>
              Sub-admins and Telegram chat IDs that receive GGR alerts.
            </Typography>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                mb: 2,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                bgcolor: enabled ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.08)',
                border: '1px solid',
                borderColor: enabled ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#e8e8ea', fontSize: 13 }}>
                  Alerts {enabled ? 'enabled' : 'disabled'}
                </Typography>
                <Typography sx={{ color: '#9aa3b5', fontSize: 11 }}>
                  Toggle delivery without clearing recipients.
                </Typography>
              </Box>
              <Switch
                checked={enabled}
                onChange={(_e, checked) => setEnabled(checked)}
                color="warning"
              />
            </Stack>

            <Typography sx={{ color: '#9aa3b5', fontSize: 12, mb: 0.75 }}>Sub-Admins</Typography>
            <Autocomplete
              multiple
              freeSolo
              options={subAdminOptions}
              value={selectedSubAdmins}
              onChange={(_e, value) => {
                const next = value
                  .map((item) => {
                    if (typeof item === 'string') {
                      const id = item.trim();
                      return id ? { id, label: id } : null;
                    }
                    return item;
                  })
                  .filter(Boolean) as GgrSubAdminOption[];
                setSelectedSubAdmins(next);
              }}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
              isOptionEqualToValue={(a, b) => {
                const aId = typeof a === 'string' ? a : a.id;
                const bId = typeof b === 'string' ? b : b.id;
                return aId === bId;
              }}
              filterSelectedOptions
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search & select sub-admins"
                  sx={fieldSx}
                />
              )}
              sx={{ mb: 2 }}
            />

            <Typography sx={{ color: '#9aa3b5', fontSize: 12, mb: 0.75 }}>Telegram Chat IDs</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {telegramChatIds.length === 0 ? (
                <Typography sx={{ color: '#6b7280', fontSize: 12 }}>No chat IDs added</Typography>
              ) : (
                telegramChatIds.map((id) => (
                  <Chip
                    key={id}
                    size="small"
                    label={id}
                    onDelete={() => setTelegramChatIds((prev) => prev.filter((x) => x !== id))}
                  />
                ))
              )}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. 123456789"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTelegramId();
                  }
                }}
                sx={fieldSx}
              />
              <Button variant="outlined" onClick={addTelegramId} sx={{ textTransform: 'none' }}>
                Add
              </Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                disabled={recipientsLoading || saving}
                startIcon={<RefreshIcon />}
                onClick={() => void loadSubAdmins().then((opts) => loadRecipients(opts))}
                sx={{ textTransform: 'none' }}
              >
                Reload
              </Button>
              <Button
                variant="contained"
                disabled={saving || recipientsLoading}
                onClick={() => void saveRecipients()}
                sx={orangeBtnSx}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Recipients'}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ ...cardSx, flex: 0.8, minWidth: 240, mb: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#e8e8ea' }}>Config Summary</Typography>
              <Chip
                size="small"
                label={enabled ? 'Live' : 'Paused'}
                sx={{
                  fontWeight: 700,
                  color: enabled ? '#6ee7b7' : '#94a3b8',
                  bgcolor: enabled ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.12)',
                }}
              />
            </Stack>
            {[
              ['Sub-Admins', String(selectedSubAdmins.length)],
              ['Telegram Chats', String(telegramChatIds.length)],
              ['Last Updated By', meta.updatedBy?.userName || meta.updatedBy?.userId || '—'],
              ['Last Updated', formatGgrDateTime(meta.updatedAt)],
            ].map(([k, v]) => (
              <Stack
                key={k}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Typography sx={{ color: '#9aa3b5', fontSize: 12 }}>{k}</Typography>
                <Typography sx={{ color: '#e8e8ea', fontSize: 13, fontWeight: 600 }}>{v}</Typography>
              </Stack>
            ))}
          </Box>
        </Stack>
      </CollapsibleFilterPanel>

      <CollapsibleFilterPanel
        title="Alert Logs"
        summary={`${total.toLocaleString('en-IN')} alerts`}
        defaultOpen
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            label="Start"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            label="End"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            label="User ID"
            size="small"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            sx={{ ...fieldSx, width: 180 }}
          />
          <TextField
            label="Client"
            size="small"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            sx={{ ...fieldSx, width: 150 }}
          />
          <TextField
            select
            label="Type"
            size="small"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as GgrAlertType)}
            sx={{ ...fieldSx, width: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="casino">Casino</MenuItem>
            <MenuItem value="sattamatka">Satta Matka</MenuItem>
          </TextField>
          <TextField
            select
            label="Per page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...fieldSx, width: 110 }}
          >
            {[10, 20, 50, 100].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={() => {
              setApplied({
                startDate,
                endDate,
                userId: filterUserId.trim(),
                clientName: filterClient.trim(),
                type: filterType,
              });
              setPage(1);
            }}
            sx={{ ...orangeBtnSx, height: 40 }}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const today = todayIstDate();
              setStartDate(today);
              setEndDate(today);
              setFilterUserId('');
              setFilterClient('');
              setFilterType('');
              setApplied({
                startDate: today,
                endDate: today,
                userId: '',
                clientName: '',
                type: '',
              });
              setPage(1);
            }}
            sx={{ height: 40, textTransform: 'none', color: '#e8e8ea', borderColor: 'rgba(255,255,255,0.28)' }}
          >
            Clear
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          logs.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ color: '#9aa3b5' }}>
                Page {page} / {Math.max(1, totalPages)} · {total.toLocaleString('en-IN')} alerts
              </Typography>
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, next) => setPage(next)}
                color="secondary"
                size="small"
              />
            </>
          ) : undefined
        }
      >
        <TableContainer
          sx={{
            flex: 1,
            minHeight: 0,
            borderRadius: 1.5,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#0f0f14',
            position: 'relative',
          }}
        >
          {logsLoading ? (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(0,0,0,0.35)',
              }}
            >
              <CircularProgress size={28} />
            </Box>
          ) : null}
          <Table stickyHeader size="small" sx={{ minWidth: 1080 }}>
            <TableHead>
              <TableRow>
                {['#', 'Time', 'Type', 'User', 'Client', 'Bank', 'Balance', 'Bet', 'Win', 'GGR', 'Games'].map(
                  (label) => (
                    <TableCell key={label} sx={thSx} align={['Balance', 'Bet', 'Win', 'GGR'].includes(label) ? 'right' : 'left'}>
                      {label}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {!logsLoading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} sx={{ ...tdSx, py: 6, textAlign: 'center', color: '#9aa3b5' }}>
                    No GGR alerts found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((row, index) => {
                  const key = String(row._id || `${row.userId}-${index}`);
                  const games = Array.isArray(row.games) ? row.games : [];
                  const open = Boolean(expanded[key]);
                  const type = String(row.type || '');
                  const t = type.toLowerCase();
                  const casino = t === 'casino';
                  const satta = t.includes('satta');
                  return (
                    <Fragment key={key}>
                      <TableRow
                        hover
                        sx={{
                          bgcolor: open ? 'rgba(255,159,10,0.05)' : index % 2 ? 'rgba(255,255,255,0.015)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                        }}
                      >
                        <TableCell sx={{ ...tdSx, color: '#9aa3b5', width: 44 }}>
                          {(page - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell sx={{ ...tdSx, whiteSpace: 'nowrap', color: '#c8cdd8' }}>
                          {formatGgrDateTime(String(row.createdOn || row.createdAt || ''))}
                        </TableCell>
                        <TableCell sx={tdSx}>
                          <Chip
                            size="small"
                            label={type || '—'}
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              color: casino ? '#93c5fd' : satta ? '#fcd34d' : '#c8cdd8',
                              bgcolor: casino
                                ? 'rgba(59,130,246,0.14)'
                                : satta
                                  ? 'rgba(245,158,11,0.14)'
                                  : 'rgba(148,163,184,0.12)',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={tdSx}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6' }} noWrap>
                            {row.name || '—'}
                          </Typography>
                          {row.userId ? <CopyText value={String(row.userId)} breakAll /> : null}
                        </TableCell>
                        <TableCell sx={tdSx}>{row.clientName || '—'}</TableCell>
                        <TableCell sx={tdSx}>{row.userBankName || '—'}</TableCell>
                        <TableCell sx={{ ...tdSx, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatGgrMoney(row.balance)}
                        </TableCell>
                        <TableCell sx={{ ...tdSx, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatGgrMoney(row.totalBetAmount)}
                        </TableCell>
                        <TableCell sx={{ ...tdSx, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatGgrMoney(row.totalWinAmount)}
                        </TableCell>
                        <TableCell
                          sx={{
                            ...tdSx,
                            textAlign: 'right',
                            fontWeight: 800,
                            color: ggrColor(row.ggr),
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatGgrMoney(row.ggr)}
                        </TableCell>
                        <TableCell sx={tdSx}>
                          {games.length ? (
                            <Button
                              size="small"
                              endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              onClick={() =>
                                setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
                              }
                              sx={{
                                textTransform: 'none',
                                color: '#ff9f0a',
                                fontWeight: 700,
                                border: '1px solid rgba(255,159,10,0.35)',
                                bgcolor: open ? 'rgba(255,159,10,0.12)' : 'transparent',
                                px: 1,
                                minWidth: 0,
                                '&:hover': { bgcolor: 'rgba(255,159,10,0.16)' },
                              }}
                            >
                              {games.length} game{games.length > 1 ? 's' : ''}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                      {open && games.length ? <GameSubRows games={games} colSpan={colCount} /> : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TablePanel>
    </Box>
  );
}
