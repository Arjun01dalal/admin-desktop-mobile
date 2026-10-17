import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { apiOtpFailed } from '@astro/shared/walletOtp';
import { secureApi } from '@/api/secureClient';
import { resolveBlockOtpMobile } from '@/screens/panel/users/constants';
import { withRegistrationComment } from '@astro/shared/rowComments';
import type { NewRegistersAdmin, UserRow } from './types';

const MAX_REMARK_LENGTH = 500;

export function useNewRegistersActions(
  admin: NewRegistersAdmin | null | undefined,
  setRows: Dispatch<SetStateAction<UserRow[]>>,
) {
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

  /** Open OTP+remark dialog and send OTP (walletToWallet) before block/unblock. */
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
        const res = await secureApi('users.sendWalletOtp', {
          mobile: resolveBlockOtpMobile(admin?.mobile),
        });
        if (apiOtpFailed(res)) {
          toast.error(res.message || 'Failed to send OTP');
          return;
        }
        toast.success(res.message || 'OTP sent successfully');
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
      const res = await secureApi('users.sendWalletOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
      });
      if (apiOtpFailed(res)) {
        toast.error(res.message || 'Failed to resend OTP');
        return;
      }
      toast.success(res.message || 'OTP resent successfully');
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
      if (apiOtpFailed(verify)) {
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

  return {
    addComment,
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
