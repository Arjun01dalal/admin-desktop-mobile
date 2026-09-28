import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { mapUsersToDialerLeads } from '@/screens/panel/users/toolbarHelpers';
import { resolveBlockOtpMobile } from '@/screens/panel/users/constants';
import { CAMPAIGN_LIST } from './campaignList';
import { withRegistrationComment } from '@astro/shared/rowComments';
import type { NewRegistersAdmin, UserRow } from './types';

const MAX_REMARK_LENGTH = 500;

export function useNewRegistersActions(
  admin: NewRegistersAdmin | null | undefined,
  setRows: Dispatch<SetStateAction<UserRow[]>>,
) {
  const [dialerLoading, setDialerLoading] = useState(false);
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);
  const [blockNextStatus, setBlockNextStatus] = useState(false);
  const [remark, setRemark] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');

  const closeBlockDialog = useCallback(() => {
    setBlockTarget(null);
    setRemark('');
    setOtp('');
    setBlockNextStatus(false);
  }, []);

  /** Open OTP+remark dialog and send OTP to SuperAdmin (Users / Laxmi flow). */
  const startBlockWithOtp = useCallback(
    async (row: UserRow) => {
      if (!row._id) return;
      const currentlyBlocked = Boolean(row.blockUser || row.block);
      const nextBlocked = !currentlyBlocked;
      setBlockTarget(row);
      setBlockNextStatus(nextBlocked);
      setRemark('');
      setOtp('');
      setOtpSending(true);
      setActionBusyId(row._id);
      try {
        const res = await secureApi('users.sendBlockOtp', {
          mobile: resolveBlockOtpMobile(admin?.mobile),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to send OTP');
          return;
        }
        toast.success('OTP sent successfully to SuperAdmin');
      } finally {
        setOtpSending(false);
        setActionBusyId('');
      }
    },
    [admin?.mobile],
  );

  const resendBlockOtp = useCallback(async () => {
    setOtpSending(true);
    try {
      const res = await secureApi('users.sendBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to resend OTP');
        return;
      }
      toast.success('OTP resent successfully to SuperAdmin');
    } finally {
      setOtpSending(false);
    }
  }, [admin?.mobile]);

  const confirmBlock = useCallback(async () => {
    if (!blockTarget?._id) return;
    if (!otp.trim()) {
      toast.error('Please enter OTP');
      return;
    }
    if (!remark.trim()) {
      toast.error('Please enter remark');
      return;
    }

    const targetId = blockTarget._id;
    const nextBlocked = blockNextStatus;
    const reason = remark.trim().slice(0, MAX_REMARK_LENGTH);

    setActionBusyId(targetId);
    try {
      const verify = await secureApi('users.verifyBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
        otp: Number.parseInt(otp.trim(), 10),
      });
      if (!verify.ok) {
        toast.error(verify.message || 'Invalid OTP');
        return;
      }

      const res = await secureApi('users.blockUnblock', {
        _id: targetId,
        blockUser: nextBlocked,
        blockUserReason: reason,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update block status');
        return;
      }
      toast.success(nextBlocked ? 'User blocked' : 'User unblocked');
      setRows((prev) =>
        prev.map((row) =>
          row._id === targetId
            ? { ...row, blockUser: nextBlocked, block: nextBlocked, blockUserReason: reason }
            : row,
        ),
      );
      closeBlockDialog();
    } finally {
      setActionBusyId('');
    }
  }, [admin?.mobile, blockNextStatus, blockTarget, closeBlockDialog, otp, remark, setRows]);

  const addComment = useCallback(
    async (userId: string, comment: string) => {
      if (!userId || !comment.trim()) {
        toast.error('Please enter a comment');
        return false;
      }
      const res = await secureApi('users.addNewRegistrationComment', {
        _id: userId,
        comment: comment.trim(),
        who: {
          userId: admin?._id,
          userName: admin?.name,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add comment');
        return false;
      }
      const text = comment.trim();
      setRows((prev) =>
        prev.map((row) =>
          row._id === userId
            ? withRegistrationComment(row, {
                comment: text,
                who: { userId: admin?._id, userName: admin?.name },
                date: new Date().toISOString(),
              })
            : row,
        ),
      );
      toast.success('Comment added successfully');
      return true;
    },
    [admin?._id, admin?.name, setRows],
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

      const campaign = CAMPAIGN_LIST.find(
        (c) => c.id.trim() === selectedCampaignId || c.name.trim() === selectedCampaignId,
      ) ?? {
        id: selectedCampaignId,
        name: selectedCampaignId,
        serverId: String(admin?.serverId ?? ''),
        location: '',
      };

      const leads = mapUsersToDialerLeads(rows).filter((l) =>
        String(l.phone_number || '').replace(/\D/g, ''),
      );
      if (!leads.length) {
        toast.error('No valid phone numbers to add to dialer');
        return false;
      }

      setDialerLoading(true);
      try {
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
          res.data && typeof res.data === 'object' && 'list_id' in res.data
            ? String((res.data as { list_id?: string | number }).list_id ?? '')
            : '';
        const inserted =
          res.data && typeof res.data === 'object' && 'inserted' in res.data
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
    [admin?.serverId],
  );

  return {
    dialerLoading,
    addComment,
    addToDialer,
    block: {
      target: blockTarget,
      nextStatus: blockNextStatus,
      remark,
      setRemark,
      otp,
      setOtp,
      otpSending,
      actionBusyId,
      maxRemark: MAX_REMARK_LENGTH,
      start: startBlockWithOtp,
      resendOtp: resendBlockOtp,
      confirm: confirmBlock,
      close: closeBlockDialog,
    },
  };
}
