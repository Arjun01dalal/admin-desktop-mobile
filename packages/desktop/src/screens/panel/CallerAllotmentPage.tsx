import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { display } from './shared';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  OFFICE_LOCATIONS,
} from './callerResponsibility/constants';

type SubAdmin = {
  _id: string;
  name?: string;
  realName?: string;
  empCode?: string;
  Role_ID?: string;
  block?: boolean;
  callerHead?: string;
  officeLocation?: string;
  extensionId?: string[] | string;
  botIds?: string[] | string;
  serverId?: string;
  telegram_username?: string;
};

type RoleGroup = {
  roleId: string;
  block?: boolean;
  subAdmins?: SubAdmin[];
};

type CallerRow = SubAdmin & {
  location: string;
  extensionNo: string;
  botNo: string;
  serverIds: string;
  telegramUserId: string;
};

type CallerHeadOption = { id: string; name: string };

const fieldSx = {
  minWidth: 110,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const actionIconBtnSx = {
  width: 32,
  height: 32,
  border: '1px solid',
  borderColor: '#64b5f6',
  color: '#64b5f6',
  borderRadius: '8px',
  '&:hover': {
    borderColor: '#90caf9',
    bgcolor: 'rgba(100,181,246,0.12)',
  },
  '&.Mui-disabled': {
    borderColor: 'rgba(100,181,246,0.35)',
    color: 'rgba(100,181,246,0.45)',
  },
};

const removeIconBtnSx = {
  ...actionIconBtnSx,
  borderColor: '#ef5350',
  color: '#ef5350',
  '&:hover': {
    borderColor: '#e57373',
    bgcolor: 'rgba(239,83,80,0.12)',
  },
  '&.Mui-disabled': {
    borderColor: 'rgba(239,83,80,0.35)',
    color: 'rgba(239,83,80,0.45)',
  },
};

function formatIdList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(',');
  if (value == null || value === '') return '';
  return String(value);
}

/** Bot IDs must be numbers — matches laxminarayan `normalizeToArray`. */
function parseBotIds(value: string): number[] {
  const ids = value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n));
  return Array.from(new Set(ids));
}

function parseExtensionIds(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toRow(subAdmin: SubAdmin, blockFallback?: boolean): CallerRow {
  return {
    ...subAdmin,
    block: subAdmin.block ?? blockFallback ?? false,
    location: subAdmin.officeLocation || '',
    extensionNo: '',
    botNo: '',
    serverIds: subAdmin.serverId || '',
    telegramUserId: subAdmin.telegram_username || '',
  };
}

/** Caller Allotment — assign caller heads and office/bot/server/telegram attributes. */
export function CallerAllotmentPage() {
  const [rows, setRows] = useState<CallerRow[]>([]);
  const [callerHeadOptions, setCallerHeadOptions] = useState<CallerHeadOption[]>([]);
  const [callerHeadMap, setCallerHeadMap] = useState<Record<string, CallerHeadOption[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<{ byRole?: RoleGroup[] }>(
        'ops.callerAllotmentSubadmins',
        { filter: {} },
      );
      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load caller allotment data');
        setRows([]);
        setCallerHeadOptions([]);
        return;
      }

      const byRole = res.data?.byRole ?? [];

      const heads = byRole
        .filter((group) => CALLER_HEAD_ROLE_IDS.has(group.roleId))
        .flatMap((group) => group.subAdmins ?? []);

      const callers = byRole
        .filter((group) => CALLER_ROLE_IDS.has(group.roleId))
        .flatMap((group) =>
          (group.subAdmins ?? []).map((subAdmin) => toRow(subAdmin, group.block)),
        )
        .sort((a, b) => Number(a.block) - Number(b.block));

      setCallerHeadOptions(
        heads
          .filter((h) => !h.block)
          .map((h) => ({ id: h._id, name: h.name || h._id })),
      );
      setRows(callers);
      setCallerHeadMap({});
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRowChange = useCallback(
    <K extends keyof CallerRow>(id: string, field: K, value: CallerRow[K]) => {
      setRows((prev) =>
        prev.map((row) => (row._id === id ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const handleCallerHeadChange = useCallback(
    (id: string, selectedIds: string[]) => {
      const selected = callerHeadOptions.filter((opt) => selectedIds.includes(opt.id));
      setCallerHeadMap((prev) => ({ ...prev, [id]: selected }));
    },
    [callerHeadOptions],
  );

  const updateCallerHead = useCallback(
    async (row: CallerRow) => {
      const selectedHeads = callerHeadMap[row._id];
      if (!selectedHeads?.length) {
        toast.info('Select at least one caller head');
        return;
      }
      const key = `${row._id}:head`;
      setSavingKey(key);
      try {
        const res = await secureApi('ops.updateCallerHead', {
          _id: row._id,
          callerHead: selectedHeads.map((h) => h.name),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update caller head');
          return;
        }
        toast.success('Caller head updated');
        void load();
      } finally {
        setSavingKey(null);
      }
    },
    [callerHeadMap, load],
  );

  /** admin-panel-domains removeCallerHead — one API call per selected head name. */
  const removeCallerHead = useCallback(
    async (row: CallerRow) => {
      const selectedHeads = callerHeadMap[row._id] ?? [];
      if (!selectedHeads.length) {
        toast.error('Please select caller head to remove');
        return;
      }
      const key = `${row._id}:removeHead`;
      setSavingKey(key);
      try {
        const results = await Promise.all(
          selectedHeads.map((item) =>
            secureApi('ops.removeCallerHead', {
              _id: row._id,
              callerHead: item.name,
            }),
          ),
        );
        const failed = results.find((r) => !r.ok);
        if (failed) {
          toast.error(failed.message || 'Failed to remove caller head');
          return;
        }
        toast.success('Caller head removed successfully');
        setCallerHeadMap((prev) => ({ ...prev, [row._id]: [] }));
        void load();
      } finally {
        setSavingKey(null);
      }
    },
    [callerHeadMap, load],
  );

  const updateOtherData = useCallback(
    async (rowId: string) => {
      const row = rowsRef.current.find((r) => r._id === rowId);
      if (!row) return;

      const key = `${row._id}:other`;
      setSavingKey(key);
      try {
        const requests: Promise<{ ok: boolean; message?: string }>[] = [];

        if (row.location.trim()) {
          requests.push(
            secureApi('ops.updateOfficeLocation', {
              _id: row._id,
              officeLocation: row.location.trim(),
            }),
          );
        }

        const extensionId = parseExtensionIds(row.extensionNo);
        const botIds = parseBotIds(row.botNo);

        const attrPayload: Record<string, unknown> = { userId: row._id };
        if (extensionId.length) attrPayload.extensionId = extensionId;
        if (row.serverIds.trim()) attrPayload.serverId = row.serverIds.trim();
        if (botIds.length) attrPayload.botIds = botIds;
        if (row.telegramUserId.trim()) attrPayload.telegramUsername = row.telegramUserId.trim();

        if (Object.keys(attrPayload).length > 1) {
          requests.push(secureApi('ops.updateSubadminAttributes', attrPayload));
        }

        if (requests.length === 0) {
          toast.info('Enter Extension No, Bot ID, Server ID, Telegram ID, or Location');
          return;
        }

        const results = await Promise.all(requests);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          toast.error(failed.message || 'Some updates failed to save');
        } else {
          toast.success('Data updated successfully');
        }
        void load();
      } finally {
        setSavingKey(null);
      }
    },
    [load],
  );

  const columns = useMemo<CommonTableColumn<CallerRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'pseudo',
        label: 'Pseudo Name',
        render: (row) => display(row.name),
      },
      {
        id: 'realName',
        label: 'Real Name',
        render: (row) => display(row.realName),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        render: (row) => display(row.empCode),
      },
      {
        id: 'callerHead',
        label: 'Caller Head',
        width: 220,
        render: (row) => (
          <Stack spacing={0.75} alignItems="stretch" sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" textAlign="left">
              Current: {display(row.callerHead)}
            </Typography>
            <TextField
              select
              SelectProps={{ multiple: true }}
              size="small"
              value={(callerHeadMap[row._id] || []).map((h) => h.id)}
              onChange={(e) => {
                const value = e.target.value;
                handleCallerHeadChange(
                  row._id,
                  typeof value === 'string' ? value.split(',') : value,
                );
              }}
              sx={fieldSx}
            >
              {callerHeadOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ),
      },
      {
        id: 'location',
        label: 'Location',
        width: 140,
        render: (row) => (
          <TextField
            select
            size="small"
            value={row.location}
            onChange={(e) => handleRowChange(row._id, 'location', e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">Select</MenuItem>
            {OFFICE_LOCATIONS.map((loc) => (
              <MenuItem key={loc} value={loc}>
                {loc}
              </MenuItem>
            ))}
          </TextField>
        ),
      },
      {
        id: 'extension',
        label: 'Extension No',
        width: 160,
        render: (row) => (
          <Stack spacing={0.75} alignItems="stretch" sx={{ minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary" textAlign="left">
              Extn ID:- {formatIdList(row.extensionId) || '—'}
            </Typography>
            <TextField
              size="small"
              placeholder="Extension No"
              value={row.extensionNo}
              onChange={(e) => handleRowChange(row._id, 'extensionNo', e.target.value)}
              sx={fieldSx}
            />
          </Stack>
        ),
      },
      {
        id: 'botId',
        label: 'Bot ID (e.g 1,2,3 ...)',
        width: 160,
        render: (row) => (
          <Stack spacing={0.75} alignItems="stretch" sx={{ minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary" textAlign="left">
              Bot ID:- {formatIdList(row.botIds) || '—'}
            </Typography>
            <TextField
              size="small"
              placeholder="e.g. 1,2,3"
              value={row.botNo}
              onChange={(e) => handleRowChange(row._id, 'botNo', e.target.value)}
              sx={fieldSx}
            />
          </Stack>
        ),
      },
      {
        id: 'serverId',
        label: 'Server ID',
        width: 140,
        render: (row) => (
          <Stack spacing={0.75} alignItems="stretch" sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary" textAlign="left">
              Server ID:- {display(row.serverId)}
            </Typography>
            <TextField
              size="small"
              placeholder="Server ID"
              value={row.serverIds}
              onChange={(e) => handleRowChange(row._id, 'serverIds', e.target.value)}
              sx={fieldSx}
            />
          </Stack>
        ),
      },
      {
        id: 'telegramId',
        label: 'Telegram ID',
        width: 150,
        render: (row) => (
          <Stack spacing={0.75} alignItems="stretch" sx={{ minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary" textAlign="left">
              Telegram ID:- {display(row.telegram_username)}
            </Typography>
            <TextField
              size="small"
              placeholder="Telegram ID"
              value={row.telegramUserId}
              onChange={(e) => handleRowChange(row._id, 'telegramUserId', e.target.value)}
              sx={fieldSx}
            />
          </Stack>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        width: 130,
        cellSx: { whiteSpace: 'nowrap' },
        render: (row) => {
          if (row.block) {
            return (
              <Typography variant="caption" color="error.light">
                Blocked
              </Typography>
            );
          }
          const headSaving = savingKey === `${row._id}:head`;
          const removeSaving = savingKey === `${row._id}:removeHead`;
          const otherSaving = savingKey === `${row._id}:other`;
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Tooltip title="Update Caller Head">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Update Caller Head"
                    disabled={headSaving}
                    onClick={() => void updateCallerHead(row)}
                    sx={actionIconBtnSx}
                  >
                    {headSaving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <ManageAccountsOutlinedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Remove Caller Head">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Remove Caller Head"
                    disabled={removeSaving}
                    onClick={() => void removeCallerHead(row)}
                    sx={removeIconBtnSx}
                  >
                    {removeSaving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Update Other Data">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Update Other Data"
                    disabled={otherSaving}
                    onClick={() => void updateOtherData(row._id)}
                    sx={actionIconBtnSx}
                  >
                    {otherSaving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <EditNoteOutlinedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [
      callerHeadMap,
      callerHeadOptions,
      handleCallerHeadChange,
      handleRowChange,
      savingKey,
      updateCallerHead,
      removeCallerHead,
      updateOtherData,
    ],
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
          Caller Allotment
        </Typography>
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

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row._id}
          loading={loading}
          emptyMessage="No callers found"
          stickyHeader
          dense
          minWidth={1500}
          maxHeight="100%"
          getRowSx={(row) =>
            row.block
              ? { bgcolor: 'rgba(244,67,54,0.12)', '&:hover': { bgcolor: 'rgba(244,67,54,0.18)' } }
              : undefined
          }
        />
      </TablePanel>
    </Box>
  );
}
