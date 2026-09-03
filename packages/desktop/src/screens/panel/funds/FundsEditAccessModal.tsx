/**
 * Laxmi Funds ApproveModal — grant/revoke gateway (or MID) access for selected subadmins.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { FUND_EDIT_ACCESS } from './constants';

type SubAdmin = {
  _id?: string;
  name?: string;
  type?: string;
  block?: boolean;
};

type RoleGroup = {
  roleName?: string;
  roleId?: string;
  subAdmins?: SubAdmin[];
};

export type FundsEditTarget = {
  /** Gateway / name from Funds list */
  gatewayName?: string;
  /** When editing from MID list */
  midName?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  target: FundsEditTarget | null;
};

export function FundsEditAccessModal({ open, onClose, target }: Props) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [subadminList, setSubadminList] = useState<SubAdmin[]>([]);
  const [selectedType, setSelectedType] = useState<'add' | 'remove' | ''>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<{ byRole?: RoleGroup[] }>('caller.subadminsByRole', {
        filter: {},
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load users');
        setSubadminList([]);
        return;
      }
      const allowed = new Set(FUND_EDIT_ACCESS.map((r) => r.trim().toLowerCase()));
      const byRole = res.data?.byRole ?? [];
      const filteredRoles = byRole.filter((v) =>
        allowed.has(
          String(v.roleName || '')
            .trim()
            .toLowerCase(),
        ),
      );
      const list = [
        ...new Map(
          filteredRoles
            .flatMap((item) => item.subAdmins || [])
            .map((sub) => [String(sub._id), sub] as const),
        ).values(),
      ].filter((v) => !v.block);
      setSubadminList(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedUsers([]);
    setSelectedType('');
    void loadUsers();
  }, [open, loadUsers]);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleApprove = async () => {
    if (!target) return;
    if (!selectedType) {
      toast.error('Please select Add or Remove');
      return;
    }
    if (!selectedUsers.length) {
      toast.error('Please select a user');
      return;
    }

    const payload: Record<string, unknown> = {
      _id: selectedUsers[0],
      type: selectedType,
    };
    if (target.midName) {
      payload.gatewayName = target.gatewayName;
      payload.midName = target.midName;
    } else {
      payload.gatewayName = target.gatewayName;
    }

    setSubmitting(true);
    try {
      const res = await secureApi('funds.updateGateway', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update access');
        return;
      }
      toast.success(res.message || 'Access updated');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Select Users</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Select Type
        </Typography>
        <RadioGroup
          row
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as 'add' | 'remove')}
        >
          <FormControlLabel value="add" control={<Radio size="small" />} label="Add" />
          <FormControlLabel value="remove" control={<Radio size="small" />} label="Remove" />
        </RadioGroup>

        <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>
          Select Users
        </Typography>
        <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          ) : subadminList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No users found
            </Typography>
          ) : (
            <Stack>
              {subadminList.map((user) => {
                const id = String(user._id || '');
                if (!id) return null;
                return (
                  <FormControlLabel
                    key={id}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedUsers.includes(id)}
                        onChange={() => toggleUser(id)}
                      />
                    }
                    label={`${user.name || id}${user.type ? ` (${user.type})` : ''}`}
                  />
                );
              })}
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={submitting || loading}
          onClick={() => void handleApprove()}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}
