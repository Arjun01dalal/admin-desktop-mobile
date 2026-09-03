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
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { asList, display } from '@/screens/panel/shared';

type WhatsappMidRow = {
  _id?: string;
  id?: string;
  name?: string;
  mid?: string;
  upiId?: string;
  maxDepositAllowed?: number;
  position?: number;
  isCurrentlyActive?: boolean;
  [key: string]: unknown;
};

type GatewayRow = {
  name?: string;
  displayName?: string;
  mid?: string;
  midArray?: string[];
  [key: string]: unknown;
};

const getRowId = (item: WhatsappMidRow) => String(item._id || item.id || '').trim();

const dedupe = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.filter((value): value is string => !!value)));

const isWhatsappGateway = (item: GatewayRow) =>
  `${item?.name || ''}`.toLowerCase().includes('whatsapp');

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function WhatsappMidPage() {
  const [rows, setRows] = useState<WhatsappMidRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [gatewayNameOptions, setGatewayNameOptions] = useState<string[]>([]);
  const [gatewayMidOptions, setGatewayMidOptions] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [manualMidEntry, setManualMidEntry] = useState(false);

  const [name, setName] = useState('');
  const [mid, setMid] = useState('');
  const [upiId, setUpiId] = useState('');
  const [maxDepositAllowed, setMaxDepositAllowed] = useState('');
  const [position, setPosition] = useState('');

  const [nameError, setNameError] = useState('');
  const [midError, setMidError] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [maxDepositError, setMaxDepositError] = useState('');
  const [positionError, setPositionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<unknown>('whatsappMid.list', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load WhatsApp MIDs');
        setRows([]);
        return;
      }
      setRows(asList<WhatsappMidRow>(res.data));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGateways = useCallback(async () => {
    const res = await secureApi<unknown>('depositProviders.list', {});
    if (!res.ok) return;
    const providers = asList<GatewayRow>(res.data).filter(isWhatsappGateway);
    setGatewayNameOptions(dedupe(providers.map((g) => g.name || g.displayName)));
    setGatewayMidOptions(
      dedupe(providers.flatMap((g) => [g.mid, ...(Array.isArray(g.midArray) ? g.midArray : [])])),
    );
  }, []);

  useEffect(() => {
    void load();
    void loadGateways();
  }, [load, loadGateways]);

  const resetForm = () => {
    setName('');
    setMid('');
    setUpiId('');
    setMaxDepositAllowed('');
    setPosition('');
    setNameError('');
    setMidError('');
    setUpiIdError('');
    setMaxDepositError('');
    setPositionError('');
    setManualMidEntry(false);
  };

  const availablePositions = useMemo(() => {
    const taken = name
      ? rows.filter((item) => (item.name || '') === name).map((item) => Number(item.position))
      : [];
    return Array.from({ length: 15 }, (_, i) => i + 1).filter((pos) => !taken.includes(pos));
  }, [rows, name]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byName = (a.name || '').localeCompare(b.name || '');
        if (byName !== 0) return byName;
        return (Number(a.position) || 0) - (Number(b.position) || 0);
      }),
    [rows],
  );

  /** Group rows under each Name (same as mobile / Laxmi web rowSpan grouping). */
  const groupedByName = useMemo(() => {
    const groups: { name: string; items: WhatsappMidRow[] }[] = [];
    const map = new Map<string, WhatsappMidRow[]>();
    for (const row of sortedRows) {
      const key = String(row.name || '').trim() || 'Untitled';
      const list = map.get(key);
      if (list) list.push(row);
      else {
        const next = [row];
        map.set(key, next);
        groups.push({ name: key, items: next });
      }
    }
    return groups;
  }, [sortedRows]);

  const handleStatus = async (row: WhatsappMidRow, checked: boolean) => {
    const rowId = getRowId(row);
    if (!rowId) return;
    const res = await secureApi('whatsappMid.update', {
      id: rowId,
      isCurrentlyActive: checked,
    });
    if (!res.ok) {
      toast.error(res.message || 'Failed to update status');
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        getRowId(item) === rowId ? { ...item, isCurrentlyActive: checked } : item,
      ),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    let hasError = false;
    if (!name.trim()) {
      setNameError('Enter Name');
      hasError = true;
    }
    if (!mid.trim()) {
      setMidError('Enter MID');
      hasError = true;
    }
    if (!upiId.trim()) {
      setUpiIdError('Enter UPI Id');
      hasError = true;
    }
    if (!maxDepositAllowed.trim()) {
      setMaxDepositError('Enter Max Deposit Allowed');
      hasError = true;
    }
    if (!position.trim()) {
      setPositionError('Enter Position');
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const res = await secureApi('whatsappMid.create', {
        name: name.trim(),
        mid: mid.trim(),
        upiId: upiId.trim(),
        maxDepositAllowed: Number(maxDepositAllowed),
        position: Number(position),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to create WhatsApp MID');
        return;
      }
      toast.success('WhatsApp MID added');
      setAddOpen(false);
      resetForm();
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    setSubmitting(true);
    try {
      const res = await secureApi('whatsappMid.delete', { id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete');
        return;
      }
      setRows((prev) => prev.filter((item) => getRowId(item) !== activeId));
      setDeleteOpen(false);
      setActiveId('');
      toast.success('Deleted');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: CommonTableColumn<WhatsappMidRow>[] = useMemo(
    () => [
      {
        id: 'mid',
        label: 'MID',
        render: (row) => display(row.mid),
      },
      {
        id: 'upiId',
        label: 'UPI Id',
        render: (row) => display(row.upiId),
      },
      {
        id: 'maxDepositAllowed',
        label: 'Max Deposit Allowed',
        render: (row) => display(row.maxDepositAllowed),
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
            onChange={(_, checked) => void handleStatus(row, checked)}
          />
        ),
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setActiveId(getRowId(row));
              setDeleteOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    // handleStatus closes over setRows; stable enough for table

    [],
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Set Whatsapp Mid
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
            sx={orangeBtnSx}
          >
            Add
          </Button>
        </Stack>
      </Stack>

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
            emptyMessage="No WhatsApp MIDs found"
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
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    mb: 1,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    bgcolor: 'rgba(255, 159, 10, 0.12)',
                    border: '1px solid rgba(255, 159, 10, 0.35)',
                  }}
                >
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
                    {group.items.length}
                  </Box>
                </Stack>
                <CommonTable
                  columns={columns}
                  rows={group.items}
                  loading={false}
                  virtualize={false}
                  getRowKey={(row) => getRowId(row) || String(row.mid || Math.random())}
                  paper
                />
              </Box>
            ))}
          </Box>
        )}
      </TablePanel>

      <Dialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetForm();
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add Whatsapp Mid</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleSubmit(e)}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Autocomplete
                freeSolo
                options={gatewayNameOptions}
                value={name}
                onChange={(_e, v) => {
                  setNameError('');
                  setName(v || '');
                  setPosition('');
                }}
                onInputChange={(_e, v) => {
                  setNameError('');
                  setName(v);
                  setPosition('');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Name"
                    size="small"
                    error={Boolean(nameError)}
                    helperText={nameError}
                  />
                )}
              />

              {manualMidEntry ? (
                <TextField
                  label="MID"
                  size="small"
                  fullWidth
                  value={mid}
                  error={Boolean(midError)}
                  helperText={midError}
                  onChange={(e) => {
                    setMidError('');
                    setMid(e.target.value);
                  }}
                />
              ) : (
                <Autocomplete
                  freeSolo
                  options={gatewayMidOptions}
                  value={mid}
                  onChange={(_e, v) => {
                    setMidError('');
                    setMid(v || '');
                  }}
                  onInputChange={(_e, v) => {
                    setMidError('');
                    setMid(v);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="MID"
                      size="small"
                      error={Boolean(midError)}
                      helperText={midError}
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
                  setMid('');
                  setMidError('');
                }}
              >
                {manualMidEntry ? 'Choose from list instead' : 'Enter MID manually'}
              </Typography>

              <TextField
                label="UPI Id"
                size="small"
                fullWidth
                value={upiId}
                error={Boolean(upiIdError)}
                helperText={upiIdError}
                onChange={(e) => {
                  setUpiIdError('');
                  setUpiId(e.target.value);
                }}
              />
              <TextField
                label="Max Deposit Allowed"
                size="small"
                type="number"
                fullWidth
                value={maxDepositAllowed}
                error={Boolean(maxDepositError)}
                helperText={maxDepositError}
                onChange={(e) => {
                  setMaxDepositError('');
                  setMaxDepositAllowed(e.target.value);
                }}
              />
              {name ? (
                <Autocomplete
                  options={availablePositions}
                  getOptionLabel={(o) => String(o)}
                  value={position ? Number(position) : null}
                  onChange={(_e, v) => {
                    setPositionError('');
                    setPosition(v != null ? String(v) : '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Position"
                      size="small"
                      error={Boolean(positionError)}
                      helperText={
                        positionError ||
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
            <Button
              onClick={() => {
                setAddOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete WhatsApp MID?</DialogTitle>
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
