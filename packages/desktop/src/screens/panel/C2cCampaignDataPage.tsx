/**
 * C2C Campaign Data — orchestrator (list + detail + dialogs).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Pagination, Stack, TextField, Typography, MenuItem } from '@mui/material';
import { toast } from 'react-toastify';
import {
  CALLER_ROLE_IDS,
  canShowGtelC2c,
  createGtelCallId,
  sanitizeGtelPhone,
  type C2cCallerOption,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';
import { C2cCallersModal } from '@/screens/panel/c2c/C2cCallersModal';
import { C2cCampaignDetailView } from '@/screens/panel/c2c/C2cCampaignDetailView';
import { C2cCampaignFormDialog } from '@/screens/panel/c2c/C2cCampaignFormDialog';
import { C2cDuplicateDialogs } from '@/screens/panel/c2c/C2cDuplicateDialogs';
import { useC2cCampaignColumns } from '@/screens/panel/c2c/useC2cCampaignColumns';
import {
  useC2cCampaignCustomersQuery,
  useC2cCampaignGetQuery,
} from '@/screens/panel/c2c/useC2cCampaignCustomersQuery';
import { useC2cCampaignListQuery } from '@/screens/panel/c2c/useC2cCampaignListQuery';
import { useC2cCustomerColumns } from '@/screens/panel/c2c/useC2cCustomerColumns';
import { secureApi } from '@/api/secureClient';
import { canAccessNavItem, getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable } from '@/components/CommonTable';
import { PanelAccessDenied } from '@/components/PanelAccessDenied';
import { TablePanel } from '@/components/TablePanel';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';

export function C2cCampaignDataPage() {
  const admin = useMemo(() => getSessionUser(), []);
  const canViewPage = canAccessNavItem(
    { id: 'c2cCampaignData', permission: Permissions.c2c_campaign_data },
    admin,
  );
  const canShowMobile = hasPermission('show_mobile', admin);
  const canShowC2c = canShowGtelC2c(admin);
  const callingLockRef = useRef(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [applied, setApplied] = useState({ search: '', isActive: '' as '' | 'true' | 'false' });

  const [selectedId, setSelectedId] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [customerStatus, setCustomerStatus] = useState<C2cCustomerStatus>('');
  const [customerAssignedTo, setCustomerAssignedTo] = useState('');
  const [customerApplied, setCustomerApplied] = useState<{
    search: string;
    status: C2cCustomerStatus;
    assignedTo: string;
  }>({ search: '', status: '', assignedTo: '' });
  const [callingId, setCallingId] = useState('');

  const [callers, setCallers] = useState<C2cCallerOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formName, setFormName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formIsLead, setFormIsLead] = useState(false);
  const [formCallerIds, setFormCallerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [duplicateChoiceOpen, setDuplicateChoiceOpen] = useState(false);
  const [duplicateFormOpen, setDuplicateFormOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<C2cCampaign | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupActive, setDupActive] = useState(true);
  const [dupCallerIds, setDupCallerIds] = useState<string[]>([]);
  const [duplicating, setDuplicating] = useState(false);
  const [callersModal, setCallersModal] = useState<C2cCampaign | null>(null);

  const listQuery = useC2cCampaignListQuery({
    page,
    search: applied.search,
    isActive: applied.isActive,
    enabled: canViewPage && !selectedId,
  });
  const { campaigns, total, totalPages, loading } = listQuery;
  const loadCampaigns = listQuery.refetch;

  const getQuery = useC2cCampaignGetQuery(selectedId);
  const selected = getQuery.campaign;
  const customersQuery = useC2cCampaignCustomersQuery({
    campaignId: selectedId,
    page: customerPage,
    search: customerApplied.search,
    status: customerApplied.status,
    assignedTo: customerApplied.assignedTo,
    enabled: canViewPage && Boolean(selectedId),
  });
  const {
    customers,
    total: customerTotal,
    totalPages: customerTotalPages,
    loading: customersLoading,
  } = customersQuery;
  const loadCustomers = customersQuery.refetch;

  useEffect(() => {
    if (!listQuery.error) return;
    toast.error(listQuery.error);
  }, [listQuery.error]);

  useEffect(() => {
    if (!selectedId || !getQuery.error) return;
    toast.error(getQuery.error);
    setSelectedId('');
  }, [getQuery.error, selectedId]);

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

  const openCampaign = useCallback((id: string) => {
    setSelectedId(id);
    setCustomerPage(1);
    setCustomerSearchInput('');
    setCustomerStatus('');
    setCustomerAssignedTo('');
    setCustomerApplied({ search: '', status: '', assignedTo: '' });
  }, []);

  const applyCustomerFilters = useCallback(() => {
    setCustomerPage(1);
    setCustomerApplied({
      search: customerSearchInput.trim(),
      status: customerStatus,
      assignedTo: customerAssignedTo,
    });
  }, [customerAssignedTo, customerSearchInput, customerStatus]);

  const clearCustomerFilters = useCallback(() => {
    setCustomerSearchInput('');
    setCustomerStatus('');
    setCustomerAssignedTo('');
    setCustomerPage(1);
    setCustomerApplied({ search: '', status: '', assignedTo: '' });
  }, []);

  const closeCampaign = useCallback(() => {
    setSelectedId('');
    setCustomerPage(1);
    setCustomerSearchInput('');
    setCustomerStatus('');
    setCustomerAssignedTo('');
    setCustomerApplied({ search: '', status: '', assignedTo: '' });
  }, []);

  const callCustomer = useCallback(
    async (row: C2cCampaignCustomer) => {
      if (callingLockRef.current) return;
      const phone = sanitizeGtelPhone(row.mobile || row.phone);
      const campaignDataId = String(row._id || '').trim();
      if (!phone || !campaignDataId) {
        toast.error('Phone or campaign row missing');
        return;
      }
      callingLockRef.current = true;
      setCallingId(campaignDataId);
      try {
        const callId = createGtelCallId();
        const res = await secureApi('gtel.clickToCall', {
          callId,
          phoneNumber: phone,
          campaignDataId,
          source: 'Campaign',
          userId: String(row.userId || row.dp_id || ''),
        });
        if (!res.ok || res.success === false) {
          toast.error(res.message || 'Call could not be initiated');
          return;
        }
        toast.success('Call initiated');
        void loadCustomers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Call failed');
      } finally {
        callingLockRef.current = false;
        setCallingId('');
      }
    },
    [loadCustomers],
  );

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

  const campaignColumns = useC2cCampaignColumns({
    duplicating,
    openCampaign,
    openDuplicate,
    onViewCallers: setCallersModal,
  });

  const customerColumns = useC2cCustomerColumns({
    canShowMobile,
    canShowC2c,
    callingId,
    callCustomer,
  });

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
          ...(formIsLead ? { type: 'lead' as const } : {}),
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
        void getQuery.refetch();
      }
    } finally {
      setSaving(false);
    }
  };

  const formDialog = (
    <C2cCampaignFormDialog
      open={formOpen}
      mode={formMode}
      name={formName}
      active={formActive}
      isLead={formIsLead}
      callerIds={formCallerIds}
      callers={callers}
      saving={saving}
      onClose={() => setFormOpen(false)}
      onName={setFormName}
      onActive={setFormActive}
      onIsLead={setFormIsLead}
      onCallerIds={setFormCallerIds}
      onSave={() => void saveForm()}
    />
  );

  if (!canViewPage) {
    return <PanelAccessDenied title="C2C Campaign Data" />;
  }

  if (selectedId) {
    return (
      <C2cCampaignDetailView
        selectedId={selectedId}
        selected={selected}
        customers={customers}
        customerColumns={customerColumns}
        customerTotal={customerTotal}
        customerPage={customerPage}
        customerTotalPages={customerTotalPages}
        customersLoading={customersLoading}
        customerSearchInput={customerSearchInput}
        customerStatus={customerStatus}
        customerAssignedTo={customerAssignedTo}
        saving={saving}
        onBack={closeCampaign}
        onEdit={() => {
          if (!selected) return;
          setFormMode('edit');
          setFormName(selected.campaignName);
          setFormActive(selected.isActive);
          setFormIsLead(Boolean(selected.isLead));
          setFormCallerIds(selected.callers.map((c) => c._id).filter(Boolean));
          setFormOpen(true);
        }}
        onRefreshCustomers={() => void loadCustomers()}
        onCustomerPage={setCustomerPage}
        onCustomerSearchInput={setCustomerSearchInput}
        onCustomerStatus={setCustomerStatus}
        onCustomerAssignedTo={setCustomerAssignedTo}
        onApplyCustomerFilters={applyCustomerFilters}
        onClearCustomerFilters={clearCustomerFilters}
        onReloadCampaign={() => void getQuery.refetch()}
        formDialog={formDialog}
      />
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 0,
        height: '100%',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexShrink={0}>
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
            setFormIsLead(false);
            setFormCallerIds([]);
            setFormOpen(true);
          }}
        >
          Create
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        alignItems="center"
        flexWrap="nowrap"
        flexShrink={0}
        sx={{ overflowX: 'auto' }}
      >
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ...fieldSx, width: 260, flexShrink: 0 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as '' | 'true' | 'false')}
          sx={{ ...fieldSx, width: 140, flexShrink: 0 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <Button
          size="small"
          sx={{ ...orangeBtnSx, flexShrink: 0 }}
          onClick={() => {
            setApplied({ search: search.trim(), isActive: activeFilter });
            setPage(1);
          }}
        >
          Search
        </Button>
      </Stack>

      <TablePanel
        footer={
          <>
            <Typography variant="caption" color="text.secondary">
              {total.toLocaleString('en-IN')} total
            </Typography>
            <Pagination
              page={page}
              count={totalPages}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
            />
          </>
        }
      >
        <CommonTable
          rows={campaigns}
          columns={campaignColumns}
          loading={loading}
          getRowKey={(r) => r._id}
          emptyMessage="No campaigns found"
          maxHeight="100%"
          size="small"
          dense
        />
      </TablePanel>

      {formDialog}

      <C2cCallersModal campaign={callersModal} onClose={() => setCallersModal(null)} />

      <C2cDuplicateDialogs
        choiceOpen={duplicateChoiceOpen}
        formOpen={duplicateFormOpen}
        source={duplicateSource}
        name={dupName}
        active={dupActive}
        callerIds={dupCallerIds}
        callers={callers}
        duplicating={duplicating}
        onClose={closeDuplicateFlow}
        onKeepSame={() => void runDuplicate()}
        onOpenForm={openDuplicateForm}
        onName={setDupName}
        onActive={setDupActive}
        onCallerIds={setDupCallerIds}
        onSubmitForm={() => void submitDuplicateForm()}
      />
    </Box>
  );
}
