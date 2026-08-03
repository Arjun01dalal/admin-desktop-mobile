import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { mapUsersToDialerLeads } from '@/screens/panel/users/toolbarHelpers';
import { CAMPAIGN_LIST } from './campaignList';
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
    async (campaignId: string, rows: UserRow[]) => {
      const selectedCampaignId = String(campaignId || '').trim();
      if (!selectedCampaignId) {
        toast.error('Campaign Name should not be empty');
        return false;
      }
      if (rows.length === 0) {
        toast.error('No users to add to dialer');
        return false;
      }

      // Match web NewRegisterUsers: resolve campaign by id or name.
      const campaign = CAMPAIGN_LIST.find(
        (c) =>
          c.id.trim() === selectedCampaignId ||
          c.name.trim() === selectedCampaignId,
      );
      if (!campaign?.id) {
        toast.error('Please select a valid campaign');
        return false;
      }

      const leads = mapUsersToDialerLeads(rows).filter((l) =>
        String(l.phone_number || '').replace(/\D/g, ''),
      );
      if (!leads.length) {
        toast.error('No valid phone numbers to add to dialer');
        return false;
      }

      setDialerLoading(true);
      try {
        // Same payload shape as admin-panel-domains NewRegisterUsers.addToDialer:
        // campaign_id = campaign.id, list_name = campaign.name, random list_id,
        // server from campaign.serverId (49.206.26.7 → api2, 3.200 → api).
        const res = await secureApi('callLogs.externalDialerBatch', {
          campaignId: campaign.id,
          campaign_id: campaign.id,
          listName: campaign.name,
          list_name: campaign.name,
          leads,
          serverId: campaign.serverId,
        });

        if (!res.ok) {
          toast.error(res.message || 'Failed to add to dialer');
          return false;
        }

        const listId =
          res.data &&
          typeof res.data === 'object' &&
          'list_id' in res.data
            ? String((res.data as { list_id?: string | number }).list_id ?? '')
            : '';
        const inserted =
          res.data &&
          typeof res.data === 'object' &&
          'inserted' in res.data
            ? Number((res.data as { inserted?: number }).inserted)
            : leads.length;

        toast.success(
          res.message ||
            `${Number.isFinite(inserted) ? inserted : leads.length} inserted successfully.`,
        );
        if (listId) {
          toast.info(`Data pushed on ${listId} List ID`);
        }
        return true;
      } finally {
        setDialerLoading(false);
      }
    },
    [],
  );

  return { dialerLoading, toggleBlock, addToDialer };
}
