/**
 * Set Gateway Mid — port of admin-panel-domains WhatsappMid / gateway-upi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  EMPTY_GATEWAY_MID_FORM,
  WHATSAPP_UP_RAJ_NUMBER,
  availableGatewayMidPositions,
  buildGatewayMidSavePayload,
  buildGatewayMidStatusPayload,
  dedupeStrings,
  formStateFromGatewayMidRow,
  formatGatewayTypeLabel,
  getGatewayMidRowId,
  groupGatewayMids,
  isWhatsappType,
  isWhatsappUpRajName,
  parseDistinctMidOptions,
  parseGatewayNameOptions,
  parseGatewayUpisResponse,
  setTypeSettingActive,
  validateGatewayMidForm,
  type GatewayMidFormErrors,
  type GatewayMidFormField,
  type GatewayMidFormState,
  type GatewayMidRow,
  type GatewayMidTypeSetting,
} from '@astro/shared/gatewayMid';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const groupHeaderSx = {
  mb: 1,
  px: 1.5,
  py: 1,
  borderRadius: 1,
  bgcolor: 'rgba(255, 159, 10, 0.12)',
  border: '1px solid rgba(255, 159, 10, 0.35)',
};

export function WhatsappMidPage() {
  const [rows, setRows] = useState<GatewayMidRow[]>([]);
  const [apiTypeOptions, setApiTypeOptions] = useState<string[]>([]);
  const [typeSettings, setTypeSettings] = useState<GatewayMidTypeSetting[]>([]);
  const [typeActionKey, setTypeActionKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [gatewayNameOptions, setGatewayNameOptions] = useState<string[]>([]);
  const [gatewayMidOptions, setGatewayMidOptions] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [manualMidEntry, setManualMidEntry] = useState(false);

  const [form, setForm] = useState<GatewayMidFormState>(EMPTY_GATEWAY_MID_FORM);
  const [errors, setErrors] = useState<GatewayMidFormErrors>({});

  const setField = (field: GatewayMidFormField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_GATEWAY_MID_FORM);
    setErrors({});
    setManualMidEntry(false);
    setEditingId('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<unknown>('whatsappMid.list', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load Gateway MIDs');
        setRows([]);
        setApiTypeOptions([]);
        setTypeSettings([]);
        return;
      }
      const { rows: nextRows, types, typeSettings: nextTypeSettings } =
        parseGatewayUpisResponse(res.data);
      setRows(nextRows);
      setApiTypeOptions(types);
      setTypeSettings(nextTypeSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    const [namesRes, midsRes] = await Promise.all([
      secureApi<unknown>('depositProviders.list', {}),
      secureApi<unknown>('depositProviders.distinctMids', {}),
    ]);
    if (namesRes.ok) setGatewayNameOptions(parseGatewayNameOptions(namesRes.data));
    if (midsRes.ok) setGatewayMidOptions(parseDistinctMidOptions(midsRes.data));
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  const nameOptions = useMemo(
    () => dedupeStrings([...gatewayNameOptions, ...rows.map((item) => item.name)]),
    [gatewayNameOptions, rows],
  );

  const midOptions = useMemo(
    () => dedupeStrings([...gatewayMidOptions, ...rows.map((item) => item.mid)]),
    [gatewayMidOptions, rows],
  );

  const typeOptions = useMemo(() => {
    if (apiTypeOptions.length) return apiTypeOptions;
    return dedupeStrings(rows.map((item) => item.type));
  }, [apiTypeOptions, rows]);

  const availablePositions = useMemo(
    () => availableGatewayMidPositions(rows, form.name, editingId),
    [rows, form.name, editingId],
  );

  const { groups: groupedByName, totalUpis, activeCount } = useMemo(
    () => groupGatewayMids(rows),
    [rows],
  );

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
    void secureApi<unknown>('whatsappMid.list', {}).then((res) => {
      if (!res.ok) return;
      const { types } = parseGatewayUpisResponse(res.data);
      if (types.length) setApiTypeOptions(types);
    });
  };

  const openEdit = (row: GatewayMidRow) => {
    const rowId = getGatewayMidRowId(row);
    if (!rowId || submitting) return;
    setEditingId(rowId);
    setForm(formStateFromGatewayMidRow(row));
    setErrors({});
    setManualMidEntry(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleStatus = useCallback(async (row: GatewayMidRow, checked: boolean) => {
    const rowId = getGatewayMidRowId(row);
    if (!rowId) return;
    let snapshot: GatewayMidRow[] = [];
    setRows((prev) => {
      snapshot = prev;
      return prev.map((item) =>
        getGatewayMidRowId(item) === rowId ? { ...item, isCurrentlyActive: checked } : item,
      );
    });
    const res = await secureApi('whatsappMid.update', buildGatewayMidStatusPayload(row, checked));
    if (!res.ok) {
      setRows(snapshot);
      toast.error(res.message || 'Failed to update status');
    }
  }, []);

  const handleTypeAction = useCallback(
    async (type: string, action: 'start' | 'stop') => {
      const typeKey = String(type || '').trim();
      if (!typeKey || submitting || typeActionKey) return;

      const actionKey = `${action}:${typeKey}`;
      const previousSettings = typeSettings;
      const nextActive = action === 'start';
      const label = formatGatewayTypeLabel(typeKey) || typeKey;

      setTypeActionKey(actionKey);
      setSubmitting(true);
      setTypeSettings((list) => setTypeSettingActive(list, typeKey, nextActive));

      try {
        const res = await secureApi(
          action === 'start' ? 'whatsappMid.startType' : 'whatsappMid.stopType',
          { type: typeKey },
        );
        if (!res.ok) {
          setTypeSettings(previousSettings);
          toast.error(res.message || `Failed to ${action} ${label}`);
          return;
        }
        toast.success(`${label} ${action === 'start' ? 'started' : 'stopped'}`);
        await load();
        setTypeSettings((list) => setTypeSettingActive(list, typeKey, nextActive));
      } finally {
        setTypeActionKey('');
        setSubmitting(false);
      }
    },
    [load, submitting, typeActionKey, typeSettings],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateGatewayMidForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || submitting) return;

    const isUpdate = Boolean(editingId);
    const editingRow = isUpdate
      ? rows.find((item) => getGatewayMidRowId(item) === editingId)
      : undefined;
    const payload = buildGatewayMidSavePayload(form, { editingId, editingRow });

    setSubmitting(true);
    try {
      const res = await secureApi(isUpdate ? 'whatsappMid.update' : 'whatsappMid.create', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to save Gateway MID');
        return;
      }
      toast.success(isUpdate ? 'Gateway MID updated' : 'Gateway MID added');
      closeDialog();
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId || submitting) return;
    const row = rows.find((item) => getGatewayMidRowId(item) === activeId);
    let snapshot: GatewayMidRow[] = [];
    setDeleteOpen(false);
    setRows((prev) => {
      snapshot = prev;
      return prev.filter((item) => getGatewayMidRowId(item) !== activeId);
    });
    setSubmitting(true);
    try {
      const res = await secureApi('whatsappMid.delete', {
        name: row?.name || '',
        id: activeId,
      });
      if (!res.ok) {
        setRows(snapshot);
        toast.error(res.message || 'Failed to delete');
        return;
      }
      setActiveId('');
      toast.success('Gateway MID deleted');
    } finally {
      setSubmitting(false);
    }
  };

  const showWhatsappNumber = isWhatsappType(form.type);
  const isUpRaj = isWhatsappUpRajName(form.name);

  const columns: CommonTableColumn<GatewayMidRow>[] = useMemo(
    () => [
      {
        id: 'mid',
        label: 'MID',
        render: (row) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {display(row.mid)}
            </Typography>
            {row.midName && row.midName !== row.mid ? (
              <Typography variant="caption" color="text.secondary">
                {row.midName}
              </Typography>
            ) : null}
          </Box>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        render: (row) => display(formatGatewayTypeLabel(row.type || '') || undefined),
      },
      {
        id: 'upiId',
        label: 'UPI Id',
        render: (row) => display(row.upiId),
      },
      {
        id: 'whatsappNumber',
        label: 'WhatsApp',
        render: (row) => display(row.whatsappNumber || undefined),
      },
      {
        id: 'maxDepositAllowed',
        label: 'Max Deposit',
        render: (row) => Number(row.maxDepositAllowed).toLocaleString('en-IN'),
      },
      {
        id: 'position',
        label: 'Position',
        render: (row) => display(row.position),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.isCurrentlyActive)}
            disabled={submitting}
            onChange={(_, checked) => void handleStatus(row, checked)}
          />
        ),
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              color="primary"
              disabled={submitting}
              onClick={() => openEdit(row)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              disabled={submitting}
              onClick={() => {
                setActiveId(getGatewayMidRowId(row));
                setDeleteOpen(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [handleStatus, submitting],
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: typeSettings.length ? 1 : 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800} noWrap>
            Set Gateway Mid
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {groupedByName.length} names · {totalUpis} UPIs · {activeCount} active
            {typeSettings.length
              ? ` · ${typeSettings.filter((t) => t.isActive).length}/${typeSettings.length} types running`
              : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={loading || submitting}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={openAdd}
            disabled={submitting}
            sx={orangeBtnSx}
          >
            Add
          </Button>
        </Stack>
      </Stack>

      {typeSettings.length > 0 ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            mb: 1.5,
            minHeight: 44,
            maxHeight: 52,
            px: 1,
            py: 0.5,
            borderRadius: 1.5,
            border: '1px solid rgba(255,159,10,0.28)',
            bgcolor: 'rgba(255,159,10,0.06)',
            overflow: 'hidden',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              color: 'rgba(255,204,128,0.95)',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              fontSize: 10,
            }}
          >
            Types
          </Typography>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              overflowX: 'auto',
              overflowY: 'hidden',
              py: 0.25,
              '&::-webkit-scrollbar': { height: 0 },
            }}
          >
            {typeSettings.map(({ type, isActive }) => {
              const starting = typeActionKey === `start:${type}`;
              const stopping = typeActionKey === `stop:${type}`;
              const busy = starting || stopping;
              return (
                <Stack
                  key={type}
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{
                    flexShrink: 0,
                    height: 34,
                    pl: 1,
                    pr: 0.5,
                    borderRadius: 999,
                    border: isActive
                      ? '1px solid rgba(102,187,106,0.45)'
                      : '1px solid rgba(255,255,255,0.12)',
                    bgcolor: isActive ? 'rgba(102,187,106,0.1)' : 'rgba(18,18,24,0.65)',
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: isActive ? '#66bb6a' : 'rgba(255,255,255,0.28)',
                    }}
                  />
                  <Typography variant="caption" fontWeight={700} noWrap sx={{ maxWidth: 110 }}>
                    {formatGatewayTypeLabel(type) || type}
                  </Typography>
                  <Button
                    size="small"
                    disabled={submitting}
                    onClick={() => void handleTypeAction(type, isActive ? 'stop' : 'start')}
                    sx={{
                      minWidth: 58,
                      height: 26,
                      px: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(239,83,80,0.5)' : 'rgba(102,187,106,0.5)',
                      color: isActive ? '#ef9a9a' : '#a5d6a7',
                      bgcolor: isActive ? 'rgba(239,83,80,0.1)' : 'rgba(102,187,106,0.1)',
                      '&:hover': {
                        borderColor: isActive ? '#ef5350' : '#66bb6a',
                        bgcolor: isActive ? 'rgba(239,83,80,0.18)' : 'rgba(102,187,106,0.18)',
                      },
                      '&.Mui-disabled': { opacity: 0.55 },
                    }}
                  >
                    {busy ? '…' : isActive ? 'Stop' : 'Start'}
                  </Button>
                </Stack>
              );
            })}
          </Box>
        </Stack>
      ) : null}

      <TablePanel>
        {loading && rows.length === 0 ? (
          <CommonTable
            columns={columns}
            rows={[]}
            loading
            emptyMessage="Loading…"
            maxHeight="100%"
          />
        ) : groupedByName.length === 0 ? (
          <CommonTable
            columns={columns}
            rows={[]}
            loading={false}
            emptyMessage="No Gateway MIDs found"
            maxHeight="100%"
          />
        ) : (
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              pr: 0.5,
            }}
          >
            {groupedByName.map((group) => (
              <Box key={group.name} sx={{ flexShrink: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={groupHeaderSx}>
                  <Box
                    sx={{
                      width: 4,
                      alignSelf: 'stretch',
                      borderRadius: 1,
                      bgcolor: '#ff9f0a',
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', letterSpacing: 0.6, fontWeight: 600 }}
                    >
                      NAME
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {group.name}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      minWidth: 28,
                      height: 28,
                      px: 1,
                      borderRadius: 999,
                      bgcolor: '#ff9f0a',
                      color: '#1a1200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {group.rows.length}
                  </Box>
                </Stack>
                <CommonTable
                  columns={columns}
                  rows={group.rows}
                  loading={false}
                  virtualize={false}
                  getRowKey={(row) => getGatewayMidRowId(row) || String(row.mid || Math.random())}
                  paper
                />
              </Box>
            ))}
          </Box>
        )}
      </TablePanel>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? 'Update Gateway Mid' : 'Add Gateway Mid'}
        </DialogTitle>
        <Box component="form" onSubmit={(e) => void handleSubmit(e)}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Autocomplete
                freeSolo
                options={typeOptions}
                value={form.type || null}
                getOptionLabel={(option) => formatGatewayTypeLabel(option) || option}
                onChange={(_e, value) => {
                  const nextType = value || '';
                  setField('type', nextType);
                  if (!isWhatsappType(nextType)) setField('whatsappNumber', '');
                  else if (isWhatsappUpRajName(form.name)) {
                    setField('whatsappNumber', WHATSAPP_UP_RAJ_NUMBER);
                  }
                }}
                onInputChange={(_e, value, reason) => {
                  if (reason !== 'input') return;
                  setField('type', value);
                  if (!isWhatsappType(value)) setField('whatsappNumber', '');
                  else if (isWhatsappUpRajName(form.name)) {
                    setField('whatsappNumber', WHATSAPP_UP_RAJ_NUMBER);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Type"
                    size="small"
                    error={Boolean(errors.type)}
                    helperText={
                      errors.type ||
                      (typeOptions.length ? `${typeOptions.length} types from API` : '')
                    }
                  />
                )}
              />

              <Autocomplete
                freeSolo
                options={nameOptions}
                value={form.name}
                onChange={(_e, value) => {
                  const nextName = value || '';
                  setField('name', nextName);
                  setField('position', '');
                  if (isWhatsappUpRajName(nextName)) {
                    setField('whatsappNumber', WHATSAPP_UP_RAJ_NUMBER);
                  }
                }}
                onInputChange={(_e, value) => {
                  setField('name', value);
                  setField('position', '');
                  if (isWhatsappUpRajName(value)) {
                    setField('whatsappNumber', WHATSAPP_UP_RAJ_NUMBER);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Name"
                    size="small"
                    error={Boolean(errors.name)}
                    helperText={errors.name}
                  />
                )}
              />

              {manualMidEntry ? (
                <TextField
                  label="MID"
                  size="small"
                  fullWidth
                  value={form.mid}
                  error={Boolean(errors.mid)}
                  helperText={errors.mid}
                  onChange={(e) => setField('mid', e.target.value)}
                />
              ) : (
                <Autocomplete
                  freeSolo
                  options={midOptions}
                  value={form.mid}
                  onChange={(_e, value) => setField('mid', value || '')}
                  onInputChange={(_e, value) => setField('mid', value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="MID"
                      size="small"
                      error={Boolean(errors.mid)}
                      helperText={errors.mid}
                    />
                  )}
                />
              )}
              <Typography
                variant="caption"
                color="primary"
                sx={{ cursor: 'pointer', alignSelf: 'flex-end', mt: -1 }}
                onClick={() => {
                  setManualMidEntry((p) => !p);
                  setField('mid', '');
                }}
              >
                {manualMidEntry ? 'Choose from list instead' : 'Enter MID manually'}
              </Typography>

              <TextField
                label="UPI Id"
                size="small"
                fullWidth
                value={form.upiId}
                error={Boolean(errors.upiId)}
                helperText={errors.upiId}
                onChange={(e) => setField('upiId', e.target.value)}
              />

              {showWhatsappNumber ? (
                <TextField
                  label="WhatsApp Number"
                  size="small"
                  fullWidth
                  value={form.whatsappNumber}
                  error={Boolean(errors.whatsappNumber)}
                  helperText={
                    errors.whatsappNumber || (isUpRaj ? '' : 'Saved as 91XXXXXXXXXX')
                  }
                  onChange={(e) => setField('whatsappNumber', e.target.value)}
                />
              ) : null}

              <TextField
                label="Max Deposit Allowed"
                size="small"
                type="number"
                fullWidth
                value={form.maxDepositAllowed}
                error={Boolean(errors.maxDepositAllowed)}
                helperText={errors.maxDepositAllowed}
                onChange={(e) => setField('maxDepositAllowed', e.target.value)}
              />

              {form.name ? (
                <Autocomplete
                  options={availablePositions}
                  getOptionLabel={(o) => String(o)}
                  value={form.position ? Number(form.position) : null}
                  onChange={(_e, value) =>
                    setField('position', value != null ? String(value) : '')
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Position"
                      size="small"
                      error={Boolean(errors.position)}
                      helperText={
                        errors.position ||
                        (availablePositions.length === 0
                          ? 'All positions (1-15) are already used for this name'
                          : '')
                      }
                    />
                  )}
                />
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {editingId ? 'Update' : 'Submit'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Gateway MID?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
