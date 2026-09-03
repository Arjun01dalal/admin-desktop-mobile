import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { invalidateSecureReadCache, secureApi } from '@/api/secureClient';
import { canEditMidLimits, canViewMidLimits } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { formatAmount, getStoredUser } from '@/utils/dates';
import { display } from '@/screens/panel/shared';
import {
  applyMidLimitUpsert,
  buildAlertRecipientDisplayList,
  buildRecipientsSavePayload,
  buildSubAdminOptions,
  buildTelegramChatIdsDraftFromConfig,
  collectMidLimitsMap,
  filterMidLimitRows,
  filterSubAdminOptions,
  formatAlertRecipientsSummary,
  getSubAdminTelegramLabel,
  mergeMidLimitRows,
  mergeSavedRecipientSelection,
  parseAlertRecipientsFromLimitsGet,
  parseLimitDraft,
  parseMidOptions,
  parseRecipientsConfig,
  resolveMidLimitRecord,
  type AlertRecipientDisplay,
  type MidLimitRow,
  type RecipientsConfig,
  type RoleGroup,
  type SubAdminOption,
} from '@astro/shared/midLimits';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const ghostBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 700,
  borderColor: 'rgba(255,255,255,0.24)',
  color: '#e8e8ea',
};

export function MidLimitsPage() {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const canView = canViewMidLimits(user);
  const canEdit = canEditMidLimits(user);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<MidLimitRow[]>([]);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsSaving, setRecipientsSaving] = useState(false);
  const [subAdminOptions, setSubAdminOptions] = useState<SubAdminOption[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedSubAdminIds, setSelectedSubAdminIds] = useState<string[]>([]);
  const [telegramChatIdsDraft, setTelegramChatIdsDraft] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertRecipients, setAlertRecipients] = useState<RecipientsConfig | null>(null);
  const [alertRecipientDisplays, setAlertRecipientDisplays] = useState<AlertRecipientDisplay[]>([]);
  const [activeRow, setActiveRow] = useState<MidLimitRow | null>(null);
  const [limitDraft, setLimitDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [midRes, limitsRes, subRes] = await Promise.all([
        secureApi('deposits.mids', {}),
        secureApi('midLimits.get', {}),
        secureApi<{ byRole?: RoleGroup[] }>('caller.subadminsByRole', { filter: {} }),
      ]);

      if (!limitsRes.ok) {
        toast.error(limitsRes.message || 'Failed to load MID limits');
      }
      if (!midRes.ok) {
        toast.error(midRes.message || 'Failed to load MID names');
      }

      const midData = midRes.ok ? midRes.data : [];
      const limitsData = limitsRes.ok ? limitsRes.data : null;
      const subOptions = subRes.ok ? buildSubAdminOptions(subRes.data) : [];
      setSubAdminOptions(subOptions);

      const recipientsConfig = parseAlertRecipientsFromLimitsGet(limitsData);
      setAlertRecipients(recipientsConfig);
      setAlertRecipientDisplays(buildAlertRecipientDisplayList(recipientsConfig, subOptions));

      const options = parseMidOptions(midData);
      const limitsMap = await collectMidLimitsMap(limitsData, options, async (mid) => {
        const res = await secureApi('midLimits.get', { mid });
        return res.ok ? res.data : null;
      });

      setRows(mergeMidLimitRows(midData, limitsMap));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => filterMidLimitRows(rows, search), [rows, search]);

  const openEdit = useCallback((row: MidLimitRow) => {
    setActiveRow(row);
    setLimitDraft(row.limit != null ? String(row.limit) : '');
    setEditOpen(true);
  }, []);

  const loadSubAdminOptions = useCallback(async () => {
    if (subAdminOptions.length) return subAdminOptions;

    const res = await secureApi<{ byRole?: RoleGroup[] }>('caller.subadminsByRole', {
      filter: {},
    });
    if (!res.ok) {
      toast.error(res.message || 'Failed to load sub-admins');
      setSubAdminOptions([]);
      return [];
    }
    const list = buildSubAdminOptions(res.data);
    setSubAdminOptions(list);
    return list;
  }, [subAdminOptions]);

  const openRecipientsDialog = useCallback(async () => {
    setRecipientsOpen(true);
    setRecipientsLoading(true);
    setRecipientSearch('');
    try {
      const [recipientsRes, subAdminList] = await Promise.all([
        secureApi('midLimits.getRecipients', {}),
        loadSubAdminOptions(),
      ]);

      if (!recipientsRes.ok) {
        toast.error(recipientsRes.message || 'Failed to load alert recipients');
        setSelectedSubAdminIds([]);
        setTelegramChatIdsDraft('');
        setAlertsEnabled(true);
        return;
      }

      const config = parseRecipientsConfig(recipientsRes.data);
      const selected = mergeSavedRecipientSelection(config, subAdminList);
      setSelectedSubAdminIds(selected);
      setTelegramChatIdsDraft(buildTelegramChatIdsDraftFromConfig(config));
      setAlertsEnabled(config.enabled !== false);
    } finally {
      setRecipientsLoading(false);
    }
  }, [loadSubAdminOptions]);

  const toggleSubAdminId = useCallback((id: string) => {
    setSelectedSubAdminIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const filteredSubAdminOptions = useMemo(
    () => filterSubAdminOptions(subAdminOptions, recipientSearch),
    [recipientSearch, subAdminOptions],
  );

  const handleSaveRecipients = useCallback(async () => {
    const built = buildRecipientsSavePayload(
      selectedSubAdminIds,
      subAdminOptions,
      alertsEnabled,
      telegramChatIdsDraft,
    );
    if (!built.ok) {
      toast.error(built.error);
      return;
    }

    setRecipientsSaving(true);
    try {
      const res = await secureApi('midLimits.setRecipients', built.payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to save alert recipients');
        return;
      }
      toast.success('Alert recipients saved');
      setRecipientsOpen(false);
      void load();
    } finally {
      setRecipientsSaving(false);
    }
  }, [alertsEnabled, selectedSubAdminIds, subAdminOptions, telegramChatIdsDraft, load]);

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!activeRow) return;

      const limit = parseLimitDraft(limitDraft);
      if (limit == null) {
        toast.error('Enter a valid limit (0 or greater)');
        return;
      }

      setSubmitting(true);
      try {
        const res = await secureApi('midLimits.upsert', {
          mid: activeRow.mid,
          limit,
          updatedBy: {
            userId: user?._id || '',
            userName: user?.name || '',
          },
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update MID limit');
          return;
        }

        invalidateSecureReadCache('midLimits.get');
        const getRes = await secureApi('midLimits.get', { mid: activeRow.mid });
        const record = resolveMidLimitRecord(
          getRes.ok ? getRes.data : res.data,
          activeRow.mid,
          limit,
        );
        record.updatedBy = record.updatedBy ?? {
          userId: user?._id || '',
          userName: user?.name || '',
        };

        setRows((prev) => applyMidLimitUpsert(prev, record));
        toast.success(`Limit updated for ${activeRow.mid}`);
        setEditOpen(false);
        setActiveRow(null);
      } finally {
        setSubmitting(false);
      }
    },
    [activeRow, limitDraft, user?._id, user?.name],
  );

  const columns = useMemo<CommonTableColumn<MidLimitRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'mid',
        label: 'MID',
        filter: (
          <TableSearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search MID"
            width={160}
          />
        ),
        render: (row) => (
          <Typography variant="body2" fontWeight={700}>
            {row.mid}
          </Typography>
        ),
      },
      {
        id: 'gatewayName',
        label: 'Gateway',
        render: (row) => display(row.gatewayName),
      },
      {
        id: 'limit',
        label: 'Limit',
        render: (row) =>
          row.limit != null ? (
            <Typography variant="body2" fontWeight={700}>
              {formatAmount(row.limit)}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not set
            </Typography>
          ),
      },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) => display(row.updatedBy?.userName),
      },
      {
        id: 'actions',
        label: 'Action',
        width: 88,
        render: (row) =>
          canEdit ? (
            <IconButton
              size="small"
              aria-label={`Edit limit for ${row.mid}`}
              onClick={() => openEdit(row)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          ) : (
            '—'
          ),
      },
    ],
    [canEdit, openEdit, search],
  );

  if (!canView) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography color="text.secondary">
          You do not have permission to view MID Limits.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0.5 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.5}
        mb={2}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Payin
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            MID Limits
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View all MIDs and set or update deposit limits.
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
          {canEdit ? (
            <Button
              startIcon={<NotificationsActiveIcon />}
              onClick={() => void openRecipientsDialog()}
              disabled={loading || submitting || recipientsLoading}
              sx={orangeBtnSx}
            >
              Alert Recipients
            </Button>
          ) : null}
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={loading || submitting || recipientsLoading}
            variant="outlined"
            sx={ghostBtnSx}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          mb: 2,
          p: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'rgba(255,159,10,0.06)',
        }}
      >
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} mb={1}>
          <NotificationsActiveIcon
            fontSize="small"
            sx={{ color: alertRecipients?.enabled === false ? 'text.disabled' : '#ff9f0a' }}
          />
          <Typography variant="subtitle2" fontWeight={700}>
            Alert notifications
          </Typography>
          <Chip
            size="small"
            label={alertRecipients?.enabled === false ? 'Disabled' : 'Enabled'}
            color={alertRecipients?.enabled === false ? 'default' : 'warning'}
            variant="outlined"
          />
        </Stack>
        {alertRecipientDisplays.length ? (
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {alertRecipientDisplays.map((item) => (
              <Chip
                key={item.key}
                size="small"
                label={item.detail ? `${item.label} · ${item.detail}` : item.label}
                sx={{ maxWidth: '100%' }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {formatAlertRecipientsSummary(alertRecipients, alertRecipientDisplays)}
          </Typography>
        )}
      </Box>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          getRowKey={(row) => row.mid}
          emptyMessage="No MIDs found"
          dense
          virtualize
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={editOpen}
        onClose={() => !submitting && setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <Box component="form" onSubmit={handleSave}>
          <DialogTitle>Set MID Limit</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={0.5}>
              <TextField
                label="MID"
                value={activeRow?.mid || ''}
                InputProps={{ readOnly: true }}
                fullWidth
                size="small"
              />
              <TextField
                label="Limit"
                type="number"
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                inputProps={{ min: 0, step: 1 }}
                placeholder="e.g. 500000"
                fullWidth
                size="small"
                autoFocus
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? <CircularProgress size={18} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={recipientsOpen}
        onClose={() => !recipientsSaving && setRecipientsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>MID Limit Alert Recipients</DialogTitle>
        <DialogContent>
          {recipientsLoading ? (
            <Stack direction="row" alignItems="center" gap={1} py={2}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading recipients…
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2} pt={0.5}>
              <Typography variant="body2" color="text.secondary">
                Select sub-admins. Telegram Chat IDs are optional — sent only when entered.
              </Typography>
              <TextField
                size="small"
                label="Telegram Chat IDs (optional)"
                value={telegramChatIdsDraft}
                onChange={(e) => setTelegramChatIdsDraft(e.target.value)}
                placeholder="1234567890, 9876543210"
                helperText="Optional comma-separated numeric chat IDs"
                fullWidth
                multiline
                minRows={2}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={alertsEnabled}
                    onChange={(e) => setAlertsEnabled(e.target.checked)}
                  />
                }
                label="Alerts enabled"
              />
              <TextField
                size="small"
                placeholder="Search name, emp code, or Telegram ID"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                fullWidth
              />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Sub-admins ({selectedSubAdminIds.length} selected)
                </Typography>
                {filteredSubAdminOptions.length ? (
                  <Stack
                    sx={{
                      maxHeight: 320,
                      overflow: 'auto',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    {filteredSubAdminOptions.map((sub) => {
                      const id = String(sub._id);
                      const telegramLabel = getSubAdminTelegramLabel(sub);
                      const selected = selectedSubAdminIds.includes(id);
                      return (
                        <Stack
                          key={id}
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          sx={{
                            px: 1,
                            py: 0.75,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': { borderBottom: 'none' },
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={selected}
                            onChange={() => toggleSubAdminId(id)}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {sub.name || id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              Profile: {telegramLabel || 'Not set'}
                              {sub.empCode ? ` · Emp: ${sub.empCode}` : ''}
                            </Typography>
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No sub-admins found
                  </Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecipientsOpen(false)} disabled={recipientsSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSaveRecipients()}
            disabled={recipientsSaving || recipientsLoading}
            sx={orangeBtnSx}
          >
            {recipientsSaving ? <CircularProgress size={18} color="inherit" /> : 'Save Recipients'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
