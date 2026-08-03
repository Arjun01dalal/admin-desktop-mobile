import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { asList, display } from '@/screens/panel/shared';

type Responsibility = {
  _id: string;
  Enum?: string;
  Name?: string;
  Group?: string;
};

type Role = {
  _id: string;
  Name?: string;
  Responsibilities?: string[];
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const TRUNCATE_LEN = 100;

export function RolesResponsibilitiesPage() {
  const canEdit = hasPermission(Permissions.Edit_Role);
  const canDelete = hasPermission(Permissions.Delete_Role);
  const canAdd = hasPermission(Permissions.add_new_role_responsibility);
  const canView = hasPermission(Permissions.View_Roles_and_Responsibilities);

  const [roles, setRoles] = useState<Role[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(false);

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneRefId, setCloneRefId] = useState('');
  const [respOpen, setRespOpen] = useState(false);
  const [respName, setRespName] = useState('');
  const [respGroup, setRespGroup] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editRespIds, setEditRespIds] = useState<string[]>([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRoleId, setViewRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const respById = useMemo(() => {
    const map = new Map<string, Responsibility>();
    for (const r of responsibilities) map.set(r._id, r);
    return map;
  }, [responsibilities]);

  const groups = useMemo(() => {
    const names = [...new Set(responsibilities.map((r) => r.Group || 'Other'))];
    return names.sort((a, b) => a.localeCompare(b));
  }, [responsibilities]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, respRes] = await Promise.all([
        secureApi('roles.list', {}),
        secureApi('responsibilities.list', {}),
      ]);
      if (!rolesRes.ok) {
        toast.error(rolesRes.message || 'Failed to load roles');
        setRoles([]);
      } else {
        setRoles(asList<Role>(rolesRes.data));
      }
      if (!respRes.ok) {
        toast.error(respRes.message || 'Failed to load responsibilities');
        setResponsibilities([]);
      } else {
        setResponsibilities(asList<Responsibility>(respRes.data));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const responsibilityNames = useCallback(
    (ids: string[] | undefined) =>
      (ids || [])
        .map((id) => respById.get(id)?.Name)
        .filter(Boolean)
        .join(', '),
    [respById],
  );

  const openEdit = (role: Role) => {
    setEditId(role._id);
    setEditName(role.Name || '');
    setEditRespIds([...(role.Responsibilities || [])]);
    setEditOpen(true);
  };

  const toggleResp = (id: string, checked: boolean) => {
    setEditRespIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((x) => x !== id);
    });
  };

  const handleClone = async (event: FormEvent) => {
    event.preventDefault();
    if (!cloneName.trim()) {
      toast.error('Enter role name');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { Name: cloneName.trim() };
      if (cloneRefId) payload.Reference_Role_ID = cloneRefId;
      const res = await secureApi('roles.clone', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to create role');
        return;
      }
      toast.success('Role created');
      setCloneOpen(false);
      setCloneName('');
      setCloneRefId('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddResponsibility = async (event: FormEvent) => {
    event.preventDefault();
    if (!respName.trim()) {
      toast.error('Name should not be empty');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { Name: respName.trim() };
      if (respGroup.trim()) payload.Group = respGroup.trim();
      const res = await secureApi('responsibilities.add', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to add responsibility');
        return;
      }
      toast.success('Responsibility added');
      setRespOpen(false);
      setRespName('');
      setRespGroup('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editName.trim()) {
      toast.error('Please enter name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('roles.update', {
        _id: editId,
        Name: editName.trim(),
        Responsibilities: editRespIds,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      setEditOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('roles.delete', { Role_ID: deleteId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete role');
        return;
      }
      toast.success('Role deleted');
      setDeleteOpen(false);
      setDeleteId('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const viewNames = useMemo(() => {
    const role = roles.find((r) => r._id === viewRoleId);
    return responsibilityNames(role?.Responsibilities);
  }, [roles, viewRoleId, responsibilityNames]);

  const columns = useMemo<CommonTableColumn<Role>[]>(
    () => [
      {
        id: 'name',
        label: 'Name',
        render: (row) => display(row.Name),
      },
      {
        id: 'responsibilities',
        label: 'Responsibilities',
        render: (row) => {
          const full = responsibilityNames(row.Responsibilities);
          const truncated =
            full.length > TRUNCATE_LEN ? `${full.slice(0, TRUNCATE_LEN)}…` : full;
          return (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontSize: 13 }}>{truncated || '—'}</Typography>
              {full ? (
                <Button
                  size="small"
                  onClick={() => {
                    setViewRoleId(row._id);
                    setViewOpen(true);
                  }}
                  sx={{ textTransform: 'none', color: '#ff9f0a', minWidth: 0, px: 0.5 }}
                >
                  View
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 120,
        render: (row) => (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            {canEdit ? (
              <IconButton size="small" onClick={() => openEdit(row)} sx={{ color: '#ff9f0a' }}>
                <EditIcon fontSize="small" />
              </IconButton>
            ) : null}
            {canDelete ? (
              <IconButton
                size="small"
                onClick={() => {
                  setDeleteId(row._id);
                  setDeleteOpen(true);
                }}
                sx={{ color: '#ef5350' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            ) : null}
            {!canEdit && !canDelete ? '—' : null}
          </Stack>
        ),
      },
    ],
    [canEdit, canDelete, responsibilityNames],
  );

  if (!canView) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography color="text.secondary">You do not have permission to view this page.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
        {canAdd && (
          <>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setCloneName('');
                setCloneRefId('');
                setCloneOpen(true);
              }}
              sx={orangeBtnSx}
            >
              Add Role
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setRespName('');
                setRespGroup('');
                setRespOpen(true);
              }}
              sx={orangeBtnSx}
            >
              Add Responsibility
            </Button>
          </>
        )}
      </Stack>

      <CommonTable
        columns={columns}
        rows={roles}
        loading={loading}
        getRowKey={(row) => row._id}
        emptyMessage="No roles found"
        virtualize={false}
        stickyHeader
        dense
        minWidth={800}
      />

      <Dialog open={cloneOpen} onClose={() => !submitting && setCloneOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={(e) => void handleClone(e)}>
          <DialogTitle>Add Role</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Role Name"
                size="small"
                fullWidth
                required
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                autoFocus
              />
              <TextField
                select
                label="Reference Role"
                size="small"
                fullWidth
                value={cloneRefId}
                onChange={(e) => setCloneRefId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Create Empty Role</em>
                </MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role._id} value={role._id}>
                    {role.Name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCloneOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? 'Creating…' : 'Create Role'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={respOpen} onClose={() => !submitting && setRespOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={(e) => void handleAddResponsibility(e)}>
          <DialogTitle>Add Responsibility</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                required
                value={respName}
                onChange={(e) => setRespName(e.target.value)}
                autoFocus
              />
              <TextField
                label="Group"
                size="small"
                fullWidth
                value={respGroup}
                onChange={(e) => setRespGroup(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRespOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !submitting && setEditOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(e) => void handleUpdate(e)}>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Typography variant="subtitle2" fontWeight={700}>
                Responsibilities
              </Typography>
              {groups.map((group) => (
                <Box key={group}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {group}
                  </Typography>
                  <FormGroup row sx={{ gap: 0.5 }}>
                    {responsibilities
                      .filter((r) => (r.Group || 'Other') === group)
                      .map((r) => (
                        <FormControlLabel
                          key={r._id}
                          control={
                            <Checkbox
                              size="small"
                              checked={editRespIds.includes(r._id)}
                              onChange={(e) => toggleResp(r._id, e.target.checked)}
                              sx={{ color: '#ff9f0a', '&.Mui-checked': { color: '#ff9f0a' } }}
                            />
                          }
                          label={r.Name || r._id}
                          sx={{ mr: 1.5 }}
                        />
                      ))}
                  </FormGroup>
                </Box>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => !submitting && setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Are You Sure?</DialogTitle>
        <DialogContent>Do you want to delete this role?</DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Responsibilities</DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
            {viewNames || '—'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
