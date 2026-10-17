/**
 * C2C Campaign Data — desktop port of admin-panel-domains C2cCampaignData.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
import { toast } from 'react-toastify';
import {
  CALLER_ROLE_IDS,
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignDataQuery,
  buildC2cCampaignListQuery,
  canShowGtelC2c,
  extractC2cCampaign,
  extractC2cCampaignCustomers,
  extractC2cCampaignList,
  formatC2cAssignedLabel,
  formatC2cCallerChipLabel,
  formatC2cCreatorLabel,
  type C2cCallerOption,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { display } from '@/screens/panel/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';

function formatCreatedStamp(value?: string): string {
  if (!value) return '—';
  const date = formatDisplayDate(value);
  const time = formatDisplayTime(value);
  if (date && time) return `${date} ${time}`;
  return date || time || '—';
}

export function C2cCampaignDataPage() {
  const admin = useMemo(() => getSessionUser(), []);
  const canShowMobile = hasPermission('show_mobile', admin);
  const canShowC2c = canShowGtelC2c(admin);

  const [campaigns, setCampaigns] = useState<C2cCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [applied, setApplied] = useState({ search: '', isActive: '' as '' | 'true' | 'false' });

  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<C2cCampaign | null>(null);
  const [customers, setCustomers] = useState<C2cCampaignCustomer[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatus, setCustomerStatus] = useState<C2cCustomerStatus>('');

  const [callers, setCallers] = useState<C2cCallerOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formName, setFormName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formCallerIds, setFormCallerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [duplicateChoiceOpen, setDuplicateChoiceOpen] = useState(false);
  const [duplicateFormOpen, setDuplicateFormOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<C2cCampaign | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupActive, setDupActive] = useState(true);
  const [dupCallerIds, setDupCallerIds] = useState<string[]>([]);
  const [duplicating, setDuplicating] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / C2C_CAMPAIGN_PAGE_SIZE));
  const customerTotalPages = Math.max(1, Math.ceil(customerTotal / C2C_CAMPAIGN_PAGE_SIZE));

  useEffect(() => {
    void (async () => {
      const res = await secureApi<{ byRole?: Array<{ roleId?: string; subAdmins?: unknown[] }> }>(
        'caller.subadminsByRole',
        { filter: {} },
      );
      if (!res.ok) return;
      const byRole = Array.isArray(res.data?.byRole) ? res.data.byRole : [];
      const options: C2cCallerOption[] = [];
      for (const role of byRole) {
        if (!CALLER_ROLE_IDS.has(String(role.roleId || ''))) continue;
        for (const row of role.subAdmins || []) {
          const r = row as Record<string, unknown>;
          if (r.block === true || r.Block === true) continue;
          const id = String(r._id || r.id || '').trim();
          if (!id) continue;
          const name = String(r.name || r.userName || '').trim();
          const empCode = String(r.empCode || '').trim();
          options.push({
            id,
            name: empCode ? `${name} (${empCode})` : name || 'Caller',
            empCode,
          });
        }
      }
      const deduped = new Map(options.map((o) => [o.id, o]));
      setCallers(Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi(
        'campaign.list',
        buildC2cCampaignListQuery({
          pageNo: page,
          itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
          search: applied.search || undefined,
          isActive:
            applied.isActive === 'true' ? true : applied.isActive === 'false' ? false : '',
        }),
      );
      if (!res.ok) {
        toast.error(res.message || 'Failed to load campaigns');
        setCampaigns([]);
        setTotal(0);
        return;
      }
      const parsed = extractC2cCampaignList(res.data);
      setCampaigns(parsed.items);
      setTotal(parsed.total);
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    if (selectedId) return;
    void loadCampaigns();
  }, [loadCampaigns, selectedId]);

  const openCampaign = useCallback(async (id: string) => {
    setSelectedId(id);
    setCustomerPage(1);
    const res = await secureApi('campaign.get', { campaignId: id });
    if (!res.ok) {
      toast.error(res.message || 'Failed to open campaign');
      setSelectedId('');
      return;
    }
    setSelected(extractC2cCampaign(res.data));
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!selectedId) return;
    setCustomersLoading(true);
    try {
      const res = await secureApi('campaign.listData', {
        campaignId: selectedId,
        ...buildC2cCampaignDataQuery({
          pageNo: customerPage,
          itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
          search: customerSearch.trim() || undefined,
          status: customerStatus || undefined,
        }),
      });
      if (!res.ok) {
        setCustomers([]);
        setCustomerTotal(0);
        return;
      }
      const parsed = extractC2cCampaignCustomers(res.data);
      setCustomers(parsed.items);
      setCustomerTotal(parsed.total);
    } finally {
      setCustomersLoading(false);
    }
  }, [selectedId, customerPage, customerSearch, customerStatus]);

  useEffect(() => {
    if (!selectedId) return;
    void loadCustomers();
  }, [selectedId, loadCustomers]);

  const resetDuplicateState = useCallback(() => {
    setDuplicateChoiceOpen(false);
    setDuplicateFormOpen(false);
    setDuplicateSource(null);
    setDupName('');
    setDupActive(true);
    setDupCallerIds([]);
  }, []);

  const closeDuplicateFlow = useCallback(() => {
    if (duplicating) return;
    resetDuplicateState();
  }, [duplicating, resetDuplicateState]);

  const openDuplicate = useCallback(
    (campaign: C2cCampaign) => {
      if (!campaign._id || duplicating) return;
      setDuplicateSource(campaign);
      setDuplicateChoiceOpen(true);
      setDuplicateFormOpen(false);
    },
    [duplicating],
  );

  const runDuplicate = useCallback(
    async (payload?: {
      campaignName?: string;
      callerIds?: string[];
      isActive?: boolean;
    }) => {
      const campaignId = String(duplicateSource?._id || '').trim();
      if (!campaignId || duplicating) return;
      setDuplicating(true);
      try {
        const res = await secureApi('campaign.duplicate', {
          campaignId,
          ...(payload || {}),
        });
        if (!res.ok) {
          toast.error(res.message || 'Duplicate failed');
          return;
        }
        toast.success('Campaign duplicated');
        resetDuplicateState();
        setPage(1);
        void loadCampaigns();
      } finally {
        setDuplicating(false);
      }
    },
    [duplicateSource?._id, duplicating, loadCampaigns, resetDuplicateState],
  );

  const openDuplicateForm = useCallback(() => {
    if (!duplicateSource) return;
    const baseName = String(duplicateSource.campaignName || 'Campaign').trim();
    setDupName(`${baseName} (copy)`);
    setDupActive(Boolean(duplicateSource.isActive));
    setDupCallerIds(
      (duplicateSource.callers || []).map((c) => String(c?._id || '').trim()).filter(Boolean),
    );
    setDuplicateChoiceOpen(false);
    setDuplicateFormOpen(true);
  }, [duplicateSource]);

  const submitDuplicateForm = useCallback(async () => {
    const name = dupName.trim();
    if (!name) {
      toast.error('Campaign name is required');
      return;
    }
    if (!dupCallerIds.length) {
      toast.error('Select at least one caller');
      return;
    }
    await runDuplicate({
      campaignName: name,
      callerIds: dupCallerIds,
      isActive: dupActive,
    });
  }, [dupActive, dupCallerIds, dupName, runDuplicate]);

  const campaignColumns = useMemo<CommonTableColumn<C2cCampaign>[]>(
    () => [
      { id: 'name', label: 'Campaign', render: (r) => display(r.campaignName) },
      {
        id: 'active',
        label: 'Status',
        render: (r) => (
          <Chip
            size="small"
            label={r.isActive ? 'Active' : 'Inactive'}
            color={r.isActive ? 'success' : 'default'}
          />
        ),
      },
      {
        id: 'stats',
        label: 'Stats',
        render: (r) =>
          `${r.data.total} · P ${r.data.pending} · A ${r.data.assigned} · D ${r.data.completed}`,
      },
      {
        id: 'callers',
        label: 'Callers',
        render: (r) =>
          r.callers.length ? (
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5 }}>
              {r.callers.map((c) => (
                <Chip key={c._id || c.name} size="small" label={formatC2cCallerChipLabel(c)} />
              ))}
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        id: 'created',
        label: 'Created by',
        render: (r) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {formatC2cCreatorLabel(r)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCreatedStamp(r.createdAt)}
            </Typography>
          </Box>
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        render: (r) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" sx={orangeBtnSx} onClick={() => void openCampaign(r._id)}>
              Open
            </Button>
            <Button size="small" onClick={() => openDuplicate(r)} disabled={duplicating}>
              Duplicate
            </Button>
          </Stack>
        ),
      },
    ],
    [duplicating, openCampaign, openDuplicate],
  );

  const customerColumns = useMemo<CommonTableColumn<C2cCampaignCustomer>[]>(
    () => [
      { id: 'name', label: 'Name', render: (r) => display(r.name) },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => (canShowMobile ? display(r.mobile || r.phone) : '**********'),
      },
      { id: 'status', label: 'Status', render: (r) => display(r.status) },
      {
        id: 'assigned',
        label: 'Assigned',
        render: (r) => display(formatC2cAssignedLabel(r.assignedTo) || '—'),
      },
      { id: 'app', label: 'App', render: (r) => display(r.appName) },
    ],
    [canShowMobile],
  );

  const saveForm = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error('Campaign name is required');
      return;
    }
    setSaving(true);
    try {
      if (formMode === 'create') {
        const res = await secureApi('campaign.create', {
          campaignName: name,
          isActive: formActive,
          callerIds: formCallerIds,
        });
        if (!res.ok) {
          toast.error(res.message || 'Create failed');
          return;
        }
        toast.success('Campaign created');
        setFormOpen(false);
        setPage(1);
        void loadCampaigns();
      } else if (selectedId) {
        const res = await secureApi('campaign.update', {
          campaignId: selectedId,
          campaignName: name,
          isActive: formActive,
          callerIds: formCallerIds,
        });
        if (!res.ok) {
          toast.error(res.message || 'Update failed');
          return;
        }
        toast.success('Campaign updated');
        setFormOpen(false);
        void openCampaign(selectedId);
      }
    } finally {
      setSaving(false);
    }
  };

  if (selectedId) {
    return (
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box>
            <Button size="small" onClick={() => { setSelectedId(''); setSelected(null); }}>
              ‹ Campaigns
            </Button>
            <Typography variant="h6" fontWeight={800}>
              {selected?.campaignName || 'Campaign'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selected?.isActive ? 'Active' : 'Inactive'} · {customerTotal} customers
              {canShowC2c ? ' · Use mobile Call Start for dialer flow' : ''}
            </Typography>
          </Box>
          <Button
            size="small"
            sx={orangeBtnSx}
            onClick={() => {
              if (!selected) return;
              setFormMode('edit');
              setFormName(selected.campaignName);
              setFormActive(selected.isActive);
              setFormCallerIds(selected.callers.map((c) => c._id).filter(Boolean));
              setFormOpen(true);
            }}
          >
            Edit
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            label="Search"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={customerStatus}
            onChange={(e) => {
              setCustomerStatus(e.target.value as C2cCustomerStatus);
              setCustomerPage(1);
            }}
            sx={{ ...fieldSx, width: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="assigned">Assigned</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>
          <Button size="small" sx={orangeBtnSx} onClick={() => { setCustomerPage(1); void loadCustomers(); }}>
            Apply
          </Button>
        </Stack>

        <TablePanel>
          <CommonTable
            rows={customers}
            columns={customerColumns}
            loading={customersLoading}
            getRowKey={(r) => r._id}
            emptyMessage="No customers found"
            dense
          />
        </TablePanel>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
          <Pagination
            page={customerPage}
            count={customerTotalPages}
            onChange={(_, p) => setCustomerPage(p)}
            color="primary"
            size="small"
          />
        </Stack>

        <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                fullWidth
              />
              <FormControlLabel
                control={<Switch checked={formActive} onChange={(_, v) => setFormActive(v)} />}
                label="Active"
              />
              <TextField
                select
                SelectProps={{ multiple: true }}
                label="Callers"
                value={formCallerIds}
                onChange={(e) =>
                  setFormCallerIds(
                    typeof e.target.value === 'string'
                      ? e.target.value.split(',')
                      : (e.target.value as string[]),
                  )
                }
                fullWidth
              >
                {callers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button sx={orangeBtnSx} onClick={() => void saveForm()} disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            C2C Campaign Data
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {total.toLocaleString('en-IN')} campaigns
          </Typography>
        </Box>
        <Button
          size="small"
          sx={orangeBtnSx}
          onClick={() => {
            setFormMode('create');
            setFormName('');
            setFormActive(true);
            setFormCallerIds([]);
            setFormOpen(true);
          }}
        >
          Create
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={fieldSx}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as '' | 'true' | 'false')}
          sx={{ ...fieldSx, width: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <Button
          size="small"
          sx={orangeBtnSx}
          onClick={() => {
            setApplied({ search: search.trim(), isActive: activeFilter });
            setPage(1);
          }}
        >
          Search
        </Button>
      </Stack>

      <TablePanel>
        <CommonTable
          rows={campaigns}
          columns={campaignColumns}
          loading={loading}
          getRowKey={(r) => r._id}
          emptyMessage="No campaigns found"
          dense
        />
      </TablePanel>
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
        <Pagination
          page={page}
          count={totalPages}
          onChange={(_, p) => setPage(p)}
          color="primary"
          size="small"
        />
      </Stack>

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={formActive} onChange={(_, v) => setFormActive(v)} />}
              label="Active"
            />
            <TextField
              select
              SelectProps={{ multiple: true }}
              label="Callers"
              value={formCallerIds}
              onChange={(e) =>
                setFormCallerIds(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : (e.target.value as string[]),
                )
              }
              fullWidth
            >
              {callers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button sx={orangeBtnSx} onClick={() => void saveForm()} disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateChoiceOpen} onClose={closeDuplicateFlow} fullWidth maxWidth="xs">
        <DialogTitle>Duplicate campaign</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {duplicateSource?.campaignName
              ? `Duplicate "${duplicateSource.campaignName}" with the same details, or change name / callers / status first?`
              : 'Keep the same details, or change name / callers / status first?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDuplicateFlow} disabled={duplicating}>
            Cancel
          </Button>
          <Button onClick={() => void runDuplicate()} disabled={duplicating}>
            {duplicating ? 'Duplicating…' : 'Keep same'}
          </Button>
          <Button sx={orangeBtnSx} onClick={openDuplicateForm} disabled={duplicating}>
            Change details
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateFormOpen} onClose={closeDuplicateFlow} fullWidth maxWidth="sm">
        <DialogTitle>Duplicate campaign — change details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={dupActive} onChange={(_, v) => setDupActive(v)} />}
              label="Active"
            />
            <TextField
              select
              SelectProps={{ multiple: true }}
              label="Callers"
              value={dupCallerIds}
              onChange={(e) =>
                setDupCallerIds(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : (e.target.value as string[]),
                )
              }
              fullWidth
            >
              {callers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDuplicateFlow} disabled={duplicating}>
            Cancel
          </Button>
          <Button sx={orangeBtnSx} onClick={() => void submitDuplicateForm()} disabled={duplicating}>
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
