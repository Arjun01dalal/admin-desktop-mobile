import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { NewRegistersAdmin, UserRow } from './types';

const MAX_REMARK_LENGTH = 500;

export function useNewRegistersActions(
  admin: NewRegistersAdmin | null | undefined,
  load: (pageNo?: number) => Promise<void>,
  page: number,
) {
  const [dialerLoading, setDialerLoading] = useState(false);

  const toggleBlock = useCallback(
    async (blockTarget: UserRow | null, remark: string) => {
      if (!blockTarget?._id || !remark.trim()) {
        toast.error('Remark is required');
        return false;
      }
      const currentlyBlocked = Boolean(blockTarget.blockUser || blockTarget.block);
      const res = await secureApi('users.blockUnblock', {
        _id: blockTarget._id,
        blockUser: !currentlyBlocked,
        blockUserReason: remark.trim().slice(0, MAX_REMARK_LENGTH),
      });
      if (!res.ok) {
        toast.error(res.message || 'Action failed');
        return false;
      }
      toast.success(currentlyBlocked ? 'User unblocked' : 'User blocked');
      await load(page);
      return true;
    },
    [load, page],
  );

  const addToDialer = useCallback(
    async (campaignName: string, rows: UserRow[]) => {
      if (!campaignName) {
        toast.error('Campaign Name should not be empty');
        return false;
      }
      if (rows.length === 0) {
        toast.error('No users to add to dialer');
        return false;
      }

      setDialerLoading(true);
      try {
        // Whitelist only dialer-needed fields (data minimization).
        const res = await secureApi('users.addToDialer', {
          campaignName,
          users: rows.map((row) => ({
            _id: row._id,
            name: row.name,
            mobile: row.mobile,
            city: row.city,
            state: row.state,
            clientName: row.clientName,
          })),
          extensionId: admin?.extensionId || [],
          adminName: admin?.name || 'ADMIN',
          serverId: admin?.serverId,
        });

        if (!res.ok) {
          toast.error(res.message || 'Failed to add to dialer');
          return false;
        }

        toast.success(res.message || 'Added to dialer');
        return true;
      } finally {
        setDialerLoading(false);
      }
    },
    [admin?.extensionId, admin?.name, admin?.serverId],
  );

  return { dialerLoading, toggleBlock, addToDialer };
}
