import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { canUpdateCallerAllotmentEmpCode } from '@/auth/permissions';
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

type CallerRow = SubAdmin;

type CallerHeadOption = { id: string; name: string };

type EditDraft = {
  location: string;
  extensionNo: string;
  botNo: string;
  serverIds: string;
  telegramUserId: string;
  headIds: string[];
};

const fieldSx = {
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 13 },
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

function formatIdList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ') || '—';
  if (value == null || value === '') return '—';
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

function draftFromRow(row: CallerRow): EditDraft {
  return {
    location: row.officeLocation || '',
    extensionNo: '',
    botNo: '',
    serverIds: row.serverId || '',
    telegramUserId: row.telegram_username || '',
    headIds: [],
  };
}

/**
 * Caller Allotment — read-only table + edit dialog.
 * Inline inputs on every row made scroll janky; editors live in one dialog.
 */
export function CallerAllotmentPage() {
  const [rows, setRows] = useState<CallerRow[]>([]);
  const [callerHeadOptions, setCallerHeadOptions] = useState<CallerHeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<'head' | 'removeHead' | 'other' | 'empCode' | null>(null);
  const [editing, setEditing] = useState<CallerRow | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [empCodeEdit, setEmpCodeEdit] = useState<{ id: string; value: string } | null>(null);
  const canEditEmpCode = canUpdateCallerAllotmentEmpCode();
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<{ byRole?: RoleGroup[] }>('ops.callerAllotmentSubadmins', {
        filter: {},
      });
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
          (group.subAdmins ?? []).map((subAdmin) => ({
            ...subAdmin,
            block: subAdmin.block ?? group.block ?? false,
          })),
        )
        .sort((a, b) => Number(a.block) - Number(b.block));

      setCallerHeadOptions(
        heads.filter((h) => !h.block).map((h) => ({ id: h._id, name: h.name || h._id })),
      );
      setRows(callers);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = useCallback((row: CallerRow) => {
    setEditing(row);
    setDraft(draftFromRow(row));
  }, []);

  const closeEdit = useCallback(() => {
    setEditing(null);
    setDraft(null);
  }, []);

  const setDraftField = useCallback(<K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const selectedHeads = useMemo(() => {
    if (!draft) return [];
    return callerHeadOptions.filter((opt) => draft.headIds.includes(opt.id));
  }, [callerHeadOptions, draft]);

  const updateCallerHead = useCallback(async () => {
    if (!editing) return;
    if (!selectedHeads.length) {
      toast.info('Select at least one caller head');
      return;
    }
    setSaving('head');
    try {
      const res = await secureApi('ops.updateCallerHead', {
        _id: editing._id,
        callerHead: selectedHeads.map((h) => h.name),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update caller head');
        return;
      }
      toast.success('Caller head updated');
      closeEdit();
      void load();
    } finally {
      setSaving(null);
    }
  }, [editing, selectedHeads, closeEdit, load]);

  const removeCallerHead = useCallback(async () => {
    if (!editing) return;
    if (!selectedHeads.length) {
      toast.error('Please select caller head to remove');
      return;
    }
    setSaving('removeHead');
    try {
      const results = await Promise.all(
        selectedHeads.map((item) =>
          secureApi('ops.removeCallerHead', {
            _id: editing._id,
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
      closeEdit();
      void load();
    } finally {
      setSaving(null);
    }
  }, [editing, selectedHeads, closeEdit, load]);

  const updateOtherData = useCallback(async () => {
    if (!editing || !draft) return;

    setSaving('other');
    try {
      const requests: Promise<{ ok: boolean; message?: string }>[] = [];

      if (draft.location.trim()) {
        requests.push(
          secureApi('ops.updateOfficeLocation', {
            _id: editing._id,
            officeLocation: draft.location.trim(),
          }),
        );
      }

      const extensionId = parseExtensionIds(draft.extensionNo);
      const botIds = parseBotIds(draft.botNo);

      const attrPayload: Record<string, unknown> = { userId: editing._id };
      if (extensionId.length) attrPayload.extensionId = extensionId;
      if (draft.serverIds.trim()) attrPayload.serverId = draft.serverIds.trim();
      if (botIds.length) attrPayload.botIds = botIds;
      if (draft.telegramUserId.trim()) attrPayload.telegramUsername = draft.telegramUserId.trim();

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
        closeEdit();
        void load();
      }
    } finally {
      setSaving(null);
    }
  }, [editing, draft, closeEdit, load]);

  const updateEmpCode = useCallback(async () => {
    if (!empCodeEdit) return;
    const updatedEmpCode = empCodeEdit.value.trim();
    if (!updatedEmpCode) {
      toast.error('Please enter emp code');
      return;
    }
    setSaving('empCode');
    try {
      const res = await secureApi('ops.assignSubadminEmpcode', {
        _id: empCodeEdit.id,
        empCode: updatedEmpCode,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update emp code');
        return;
      }
      toast.success('Emp code updated successfully');
      setEmpCodeEdit(null);
      void load();
    } finally {
      setSaving(null);
    }
  }, [empCodeEdit, load]);

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
        width: 120,
        render: (row) => (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.25}>
            <span>{display(row.empCode)}</span>
            {canEditEmpCode ? (
              <Tooltip title="Update Emp Code">
                <IconButton
                  size="small"
                  aria-label="Update Emp Code"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEmpCodeEdit({ id: row._id, value: String(row.empCode || '') });
                  }}
                  sx={{ color: 'text.secondary', p: 0.25 }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'callerHead',
        label: 'Caller Head',
        render: (row) => display(row.callerHead),
      },
      {
        id: 'location',
        label: 'Location',
        render: (row) => display(row.officeLocation),
      },
      {
        id: 'extension',
        label: 'Extension No',
        render: (row) => formatIdList(row.extensionId),
      },
      {
        id: 'botId',
        label: 'Bot ID',
        render: (row) => formatIdList(row.botIds),
      },
      {
        id: 'serverId',
        label: 'Server ID',
        render: (row) => display(row.serverId),
      },
      {
        id: 'telegramId',
        label: 'Telegram ID',
        render: (row) => display(row.telegram_username),
      },
      {
        id: 'action',
        label: 'Action',
        width: 88,
        cellSx: { whiteSpace: 'nowrap' },
        render: (row) => {
          if (row.block) {
            return (
              <Typography variant="caption" color="error.light">
                Blocked
              </Typography>
            );
          }
          return (
            <Tooltip title="Edit caller">
              <IconButton
                size="small"
                aria-label="Edit caller"
                onClick={() => openEdit(row)}
                sx={actionIconBtnSx}
              >
                <EditOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          );
        },
      },
    ],
    [canEditEmpCode, openEdit],
  );

  const busy = saving != null;

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
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
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
          minWidth={1100}
          maxHeight="100%"
          getRowSx={(row) =>
            row.block
              ? { bgcolor: 'rgba(244,67,54,0.12)', '&:hover': { bgcolor: 'rgba(244,67,54,0.18)' } }
              : undefined
          }
        />
      </TablePanel>

      <Dialog open={Boolean(editing && draft)} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit — {editing?.name || editing?.empCode || 'Caller'}
        </DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Caller Head
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Current: {display(editing?.callerHead)}
                </Typography>
                <TextField
                  select
                  SelectProps={{ multiple: true }}
                  size="small"
                  fullWidth
                  label="Select caller head(s)"
                  value={draft.headIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDraftField(
                      'headIds',
                      typeof value === 'string' ? value.split(',') : (value as string[]),
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
                <Stack direction="row" spacing={1} mt={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      saving === 'head' ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <ManageAccountsOutlinedIcon />
                      )
                    }
                    disabled={busy || !selectedHeads.length}
                    onClick={() => void updateCallerHead()}
                  >
                    Assign Head
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={
                      saving === 'removeHead' ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <PersonRemoveOutlinedIcon />
                      )
                    }
                    disabled={busy || !selectedHeads.length}
                    onClick={() => void removeCallerHead()}
                  >
                    Remove Head
                  </Button>
                </Stack>
              </Box>

              <TextField
                select
                size="small"
                fullWidth
                label="Location"
                value={draft.location}
                onChange={(e) => setDraftField('location', e.target.value)}
                sx={fieldSx}
              >
                <MenuItem value="">Select</MenuItem>
                {OFFICE_LOCATIONS.map((loc) => (
                  <MenuItem key={loc} value={loc}>
                    {loc}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                fullWidth
                label="Extension No"
                placeholder="Comma separated"
                helperText={`Current: ${formatIdList(editing?.extensionId)}`}
                value={draft.extensionNo}
                onChange={(e) => setDraftField('extensionNo', e.target.value)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="Bot ID"
                placeholder="e.g. 1,2,3"
                helperText={`Current: ${formatIdList(editing?.botIds)}`}
                value={draft.botNo}
                onChange={(e) => setDraftField('botNo', e.target.value)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="Server ID"
                helperText={`Current: ${display(editing?.serverId)}`}
                value={draft.serverIds}
                onChange={(e) => setDraftField('serverIds', e.target.value)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="Telegram ID"
                helperText={`Current: ${display(editing?.telegram_username)}`}
                value={draft.telegramUserId}
                onChange={(e) => setDraftField('telegramUserId', e.target.value)}
                sx={fieldSx}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={closeEdit} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => void updateOtherData()}
          >
            {saving === 'other' ? 'Saving…' : 'Save Location / IDs'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(empCodeEdit)}
        onClose={() => setEmpCodeEdit(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Update Emp Code</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            required
            fullWidth
            label="Emp Code"
            margin="dense"
            value={empCodeEdit?.value ?? ''}
            onChange={(e) =>
              setEmpCodeEdit((prev) => (prev ? { ...prev, value: e.target.value } : prev))
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEmpCodeEdit(null)} disabled={saving === 'empCode'}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void updateEmpCode()}
            disabled={saving === 'empCode'}
          >
            {saving === 'empCode' ? 'Updating…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
