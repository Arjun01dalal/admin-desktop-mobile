import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  groupInitials,
  parseMidGroupsPayload,
  type MidGroupMap,
} from '@/screens/panel/funds/midGroupsHelpers';

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

export function MidGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<MidGroupMap>({});
  const [whatsappMids, setWhatsappMids] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [draftMids, setDraftMids] = useState<Record<string, string>>({});
  const [selectedMids, setSelectedMids] = useState<Record<string, string>>({});
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [selectedWhatsappMid, setSelectedWhatsappMid] = useState('');

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<unknown>('funds.midGroupsGet', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load MID groups');
        setGroups({});
        setWhatsappMids([]);
        return;
      }
      const parsed = parseMidGroupsPayload(res.data);
      setGroups(parsed.groups);
      setWhatsappMids(parsed.whatsapp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMids = useMemo(
    () => Object.values(groups).reduce((sum, mids) => sum + mids.length, 0),
    [groups],
  );

  const filteredGroupNames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .filter((name) => {
        if (!q) return true;
        if (name.toLowerCase().includes(q)) return true;
        return (groups[name] || []).some((mid) => mid.toLowerCase().includes(q));
      });
  }, [groups, search]);

  const runMutation = async (
    action:
      | 'funds.midGroupsAddGroup'
      | 'funds.midGroupsRemoveGroup'
      | 'funds.midGroupsAddMid'
      | 'funds.midGroupsRemoveMid'
      | 'funds.midGroupsWhatsappAdd'
      | 'funds.midGroupsWhatsappRemove',
    payload: Record<string, unknown>,
    successMsg: string,
  ) => {
    setBusy(true);
    try {
      const res = await secureApi(action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Action failed');
        return;
      }
      toast.success(successMsg);
      await load();
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  };

  const openConfirm = (title: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const handleAddGroup = () => {
    const group = newGroupName.trim();
    if (!group) {
      toast.error('Enter group name');
      return;
    }
    setAddGroupOpen(false);
    setNewGroupName('');
    void runMutation(
      'funds.midGroupsAddGroup',
      { group, mids: [] },
      `Group "${group}" added`,
    );
  };

  return (
    <Box sx={{ p: 0.5 }}>
      {(loading || busy) && (
        <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {busy ? 'Saving…' : 'Loading…'}
          </Typography>
        </Stack>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.5}
        mb={2}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Funds
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            MID Groups
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organize payin groups, assign MIDs, and manage WhatsApp global list.
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search group or MID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={busy}
            variant="outlined"
            sx={ghostBtnSx}
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setAddGroupOpen(true)}
            sx={orangeBtnSx}
          >
            Add Group
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1.5} mb={2}>
        {[
          { label: 'Groups', value: Object.keys(groups).length },
          { label: 'Total MIDs', value: totalMids },
          { label: 'WhatsApp Global', value: whatsappMids.length },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={0}
            sx={{
              px: 2,
              py: 1.25,
              minWidth: 140,
              bgcolor: 'background.paper',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {stat.label}
            </Typography>
            <Typography fontWeight={700} fontSize={20}>
              {stat.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography fontWeight={700} mb={1}>
        WhatsApp Global Only
      </Typography>
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          border: '1px solid rgba(255,159,10,0.35)',
          bgcolor: 'rgba(255,159,10,0.06)',
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5} mb={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: '#ff9f0a',
              color: '#1a1200',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
            }}
          >
            WA
          </Box>
          <Box>
            <Typography fontWeight={700}>WhatsApp Global MIDs</Typography>
            <Typography variant="body2" color="text.secondary">
              {whatsappMids.length} MID{whatsappMids.length === 1 ? '' : 's'} in global-only list
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mb={1.5}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add WhatsApp MID"
            value={whatsappDraft}
            onChange={(e) => setWhatsappDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const mid = whatsappDraft.trim();
                if (!mid) {
                  toast.error('Enter MID');
                  return;
                }
                setWhatsappDraft('');
                void runMutation(
                  'funds.midGroupsWhatsappAdd',
                  { mids: [mid] },
                  'WhatsApp global MID added',
                );
              }
            }}
          />
          <Button
            sx={orangeBtnSx}
            disabled={busy}
            onClick={() => {
              const mid = whatsappDraft.trim();
              if (!mid) {
                toast.error('Enter MID');
                return;
              }
              setWhatsappDraft('');
              void runMutation(
                'funds.midGroupsWhatsappAdd',
                { mids: [mid] },
                'WhatsApp global MID added',
              );
            }}
          >
            Add MID
          </Button>
        </Stack>
        {whatsappMids.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No WhatsApp global MIDs yet
          </Typography>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              select
              size="small"
              fullWidth
              label={`Select MID (${whatsappMids.length})`}
              value={whatsappMids.includes(selectedWhatsappMid) ? selectedWhatsappMid : ''}
              onChange={(e) => setSelectedWhatsappMid(e.target.value)}
            >
              <MenuItem value="">Select MID</MenuItem>
              {whatsappMids.map((mid) => (
                <MenuItem key={`wa-${mid}`} value={mid}>
                  {mid}
                </MenuItem>
              ))}
            </TextField>
            <Button
              color="error"
              variant="outlined"
              disabled={busy || !selectedWhatsappMid}
              onClick={() => {
                if (!selectedWhatsappMid) return;
                openConfirm(`Remove WhatsApp global MID "${selectedWhatsappMid}"?`, () => {
                  void runMutation(
                    'funds.midGroupsWhatsappRemove',
                    { mids: [selectedWhatsappMid] },
                    'WhatsApp global MID removed',
                  );
                  setSelectedWhatsappMid('');
                });
              }}
            >
              Remove MID
            </Button>
          </Stack>
        )}
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
        <Typography fontWeight={700}>Payin Groups</Typography>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredGroupNames.length} of {Object.keys(groups).length}
        </Typography>
      </Stack>

      {filteredGroupNames.length === 0 ? (
        <Paper
          elevation={0}
          sx={{ p: 3, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.2)' }}
        >
          <Typography fontWeight={700}>No groups found</Typography>
          <Typography variant="body2" color="text.secondary">
            Add a group to start assigning MIDs.
          </Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {filteredGroupNames.map((groupName) => {
            const mids = groups[groupName] || [];
            const selected = mids.includes(selectedMids[groupName] || '')
              ? selectedMids[groupName]
              : '';
            return (
              <Paper
                key={groupName}
                elevation={0}
                sx={{
                  p: 2,
                  border: '1px solid rgba(255,255,255,0.12)',
                  bgcolor: 'background.paper',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1}
                  mb={1.5}
                >
                  <Stack direction="row" gap={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,159,10,0.2)',
                        color: '#ff9f0a',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {groupInitials(groupName)}
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>{groupName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {mids.length} MID{mids.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={busy}
                    onClick={() =>
                      openConfirm(`Remove group "${groupName}" and all its MIDs?`, () =>
                        void runMutation(
                          'funds.midGroupsRemoveGroup',
                          { group: groupName },
                          `Group "${groupName}" removed`,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </Stack>

                <Stack direction="row" gap={1} mb={1.5}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Add MID"
                    value={draftMids[groupName] || ''}
                    onChange={(e) =>
                      setDraftMids((prev) => ({ ...prev, [groupName]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const mid = (draftMids[groupName] || '').trim();
                      if (!mid) {
                        toast.error('Enter MID');
                        return;
                      }
                      setDraftMids((prev) => ({ ...prev, [groupName]: '' }));
                      void runMutation(
                        'funds.midGroupsAddMid',
                        { group: groupName, mids: [mid] },
                        `MID added to ${groupName}`,
                      );
                    }}
                  />
                  <Button
                    size="small"
                    sx={orangeBtnSx}
                    disabled={busy}
                    onClick={() => {
                      const mid = (draftMids[groupName] || '').trim();
                      if (!mid) {
                        toast.error('Enter MID');
                        return;
                      }
                      setDraftMids((prev) => ({ ...prev, [groupName]: '' }));
                      void runMutation(
                        'funds.midGroupsAddMid',
                        { group: groupName, mids: [mid] },
                        `MID added to ${groupName}`,
                      );
                    }}
                  >
                    Add
                  </Button>
                </Stack>

                {mids.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No MIDs in this group
                  </Typography>
                ) : (
                  <Stack direction="row" gap={1}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      label={`Select MID (${mids.length})`}
                      value={selected}
                      onChange={(e) =>
                        setSelectedMids((prev) => ({
                          ...prev,
                          [groupName]: e.target.value,
                        }))
                      }
                    >
                      <MenuItem value="">Select MID</MenuItem>
                      {mids.map((mid) => (
                        <MenuItem key={`${groupName}-${mid}`} value={mid}>
                          {mid}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={busy || !selected}
                      onClick={() => {
                        if (!selected) return;
                        openConfirm(`Remove MID "${selected}" from ${groupName}?`, () =>
                          void runMutation(
                            'funds.midGroupsRemoveMid',
                            { group: groupName, mids: [selected] },
                            `MID removed from ${groupName}`,
                          ),
                        );
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Box>
      )}

      <Dialog open={addGroupOpen} onClose={() => setAddGroupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddGroup();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddGroupOpen(false)}>Cancel</Button>
          <Button sx={orangeBtnSx} onClick={handleAddGroup}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <Typography>{confirmTitle}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmAction?.()}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
