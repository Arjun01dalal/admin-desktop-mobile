import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { IconButton, Stack, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  getRoleName,
  hasPermission,
  Permissions,
} from '@/auth/permissions';
import { SHOW_EDIT_EMP_CODE, resolveBlockOtpMobile } from './constants';
import {
  MAX_REMARK,
  type RoleOption,
  type SubAdminEditType,
} from './usersHelpers';
import type { UsersAdmin } from './useUsersQuery';
import type { UserRow } from './utils';

type Params = {
  load: (pageNo?: number) => Promise<void>;
  admin: UsersAdmin | null | undefined;
  isCaller: boolean;
  page: number;
  appliedBlockStatus: string;
  setRows: Dispatch<SetStateAction<UserRow[]>>;
};

export function useUsersActions({
  load,
  admin,
  isCaller,
  page,
  appliedBlockStatus,
  setRows,
}: Params) {
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);
  const [blockNextStatus, setBlockNextStatus] = useState(false);
  const [dumpTarget, setDumpTarget] = useState<UserRow | null>(null);
  const [remark, setRemark] = useState('');
  const [otp, setOtp] = useState('');
  const [dumpReason, setDumpReason] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');

  // Sub_Admin edit / actions (admin-panel-domains Users.tsx)
  const [subEdit, setSubEdit] = useState<{
    id: string;
    type: SubAdminEditType;
  } | null>(null);
  const [subEditValue, setSubEditValue] = useState('');
  const [subEditBusy, setSubEditBusy] = useState(false);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState('');
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [roleEditBusy, setRoleEditBusy] = useState(false);
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>(
    {},
  );
  const [locationBusyId, setLocationBusyId] = useState('');
  const [realNameTargetId, setRealNameTargetId] = useState<string | null>(null);
  const [realNameValue, setRealNameValue] = useState('');
  const [realNameBusy, setRealNameBusy] = useState(false);
  const [blockCallerTarget, setBlockCallerTarget] = useState<UserRow | null>(
    null,
  );
  const [blockCallerNext, setBlockCallerNext] = useState(false);
  const [blockCallerRemark, setBlockCallerRemark] = useState('');
  const [blockCallerOtp, setBlockCallerOtp] = useState('');
  const [blockCallerBusy, setBlockCallerBusy] = useState(false);

  const canEditSubAdminRole = useMemo(() => {
    if (hasPermission(Permissions.Edit_Role)) return true;
    const name = String(getRoleName(admin) || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
    return (
      name === 'full_access' ||
      name === 'dev_full_access' ||
      name.endsWith('_full_access')
    );
  }, [admin]);

  const canEditEmpCode = useMemo(() => {
    const mobile = String(admin?.mobile || '').trim();
    return (SHOW_EDIT_EMP_CODE as readonly string[]).includes(mobile);
  }, [admin?.mobile]);

  const closeBlockDialog = useCallback(() => {
    setBlockTarget(null);
    setRemark('');
    setOtp('');
    setBlockNextStatus(false);
  }, []);

  /** Open OTP+remark dialog, then send OTP to SuperAdmin (always asks OTP). */
  const startBlockWithOtp = useCallback(
    async (row: UserRow) => {
      if (isCaller) return;
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
    [admin?.mobile, isCaller],
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
    if (!blockTarget) return;
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
    const reason = remark.trim();

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

      // Immediate UI update (don't wait for list refetch)
      setRows((prev) => {
        const leaveList =
          (appliedBlockStatus === 'unblock' && nextBlocked) ||
          (appliedBlockStatus === 'block' && !nextBlocked);
        if (leaveList) return prev.filter((row) => row._id !== targetId);
        return prev.map((row) =>
          row._id === targetId
            ? {
                ...row,
                blockUser: nextBlocked,
                block: nextBlocked,
                blockUserReason: reason,
              }
            : row,
        );
      });
      closeBlockDialog();
      // Force fresh list from API
      await load(page);
    } finally {
      setActionBusyId('');
    }
  }, [
    admin?.mobile,
    appliedBlockStatus,
    blockNextStatus,
    blockTarget,
    closeBlockDialog,
    load,
    otp,
    page,
    remark,
    setRows,
  ]);

  const confirmDump = useCallback(async () => {
    if (!dumpTarget) return;
    if (!dumpReason.trim()) {
      toast.error('Reason is Required');
      return;
    }
    setActionBusyId(dumpTarget._id);
    try {
      // Match laxminarayan: IST date as YYYY-MM-DD
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const res = await secureApi('ops.dumpUsersUpdate', {
        _id: dumpTarget._id,
        dump: true,
        dumpReason: {
          name: admin?.name || '',
          reason: dumpReason.trim(),
          Date: istDate,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to dump user');
        return;
      }
      toast.success('User dumped');
      setDumpTarget(null);
      setDumpReason('');
      void load(page);
    } finally {
      setActionBusyId('');
    }
  }, [admin?.name, dumpReason, dumpTarget, load, page]);

  const openSubEdit = useCallback((id: string, type: SubAdminEditType, current?: string) => {
    setSubEdit({ id, type });
    setSubEditValue(String(current || ''));
  }, []);

  const submitSubEdit = useCallback(async () => {
    if (!subEdit) return;
    const value = subEditValue.trim();
    if (!value) {
      toast.error('Value is required');
      return;
    }
    setSubEditBusy(true);
    try {
      if (subEdit.type === 'telegram') {
        const res = await secureApi('ops.updateSubadminAttributes', {
          userId: subEdit.id,
          telegramUsername: value,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update telegram');
          return;
        }
      } else if (subEdit.type === 'empCode') {
        const res = await secureApi('users.setUserEmpCode', {
          _id: subEdit.id,
          empCode: value,
          modifiedBy: admin?._id,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update emp code');
          return;
        }
      } else {
        const res = await secureApi('users.updateSubAdminName', {
          _id: subEdit.id,
          ...(subEdit.type === 'name' ? { name: value } : { mobile: value }),
          updatedBy: { _id: admin?._id, name: admin?.name },
          reason:
            subEdit.type === 'name'
              ? 'Correcting wrong Name'
              : 'Correcting wrong Mobile Number',
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update');
          return;
        }
      }
      toast.success('Updated successfully');
      setSubEdit(null);
      setSubEditValue('');
      void load(page);
    } finally {
      setSubEditBusy(false);
    }
  }, [admin?._id, admin?.name, load, page, subEdit, subEditValue]);

  const renderEmpCodeCell = useCallback(
    (r: UserRow) => (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={0.5}
        sx={{ width: '100%' }}
      >
        <Typography variant="body2" noWrap>
          {String(r.empCode || '001')}
        </Typography>
        {canEditEmpCode ? (
          <IconButton
            size="small"
            title="Edit emp code"
            onClick={() => openSubEdit(r._id, 'empCode', String(r.empCode || '001'))}
            sx={{ color: '#ff9f0a' }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ) : null}
      </Stack>
    ),
    [canEditEmpCode, openSubEdit],
  );

  const openRoleEdit = useCallback(
    async (row: UserRow) => {
      setRoleEditId(row._id);
      setRoleEditValue(String(row.Role_ID || ''));
      try {
        const res = await secureApi('roles.list', {});
        if (!res.ok) {
          toast.error(res.message || 'Failed to load roles');
          return;
        }
        const data = res.data as
          | RoleOption[]
          | { items?: RoleOption[]; payload?: RoleOption[] }
          | undefined;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.payload)
              ? data.payload
              : [];
        setRoleOptions(list);
      } catch {
        toast.error('Failed to load roles');
      }
    },
    [],
  );

  const submitRoleEdit = useCallback(async () => {
    if (!roleEditId || !roleEditValue) {
      toast.error('Please select a role');
      return;
    }
    setRoleEditBusy(true);
    try {
      const res = await secureApi('users.updateSubAdminRole', {
        subAdminId: roleEditId,
        updatedBy: admin?._id,
        roleId: roleEditValue,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      setRoleEditId(null);
      void load(page);
    } finally {
      setRoleEditBusy(false);
    }
  }, [admin?._id, load, page, roleEditId, roleEditValue]);

  const updateSubAdminLocation = useCallback(
    async (row: UserRow) => {
      const loc = (locationDraft[row._id] || row.officeLocation || '').toString().trim();
      if (!loc) {
        toast.error('Please select a location');
        return;
      }
      setLocationBusyId(row._id);
      try {
        const res = await secureApi('ops.updateOfficeLocation', {
          _id: row._id,
          officeLocation: loc,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update location');
          return;
        }
        toast.success('Location updated successfully');
        void load(page);
      } finally {
        setLocationBusyId('');
      }
    },
    [load, locationDraft, page],
  );

  const openRealName = useCallback((row: UserRow) => {
    setRealNameTargetId(row._id);
    setRealNameValue(String(row.realName || ''));
  }, []);

  const submitRealName = useCallback(async () => {
    if (!realNameTargetId) return;
    if (!realNameValue.trim()) {
      toast.error('Please enter Real Name');
      return;
    }
    setRealNameBusy(true);
    try {
      const res = await secureApi('users.updateRealName', {
        _id: realNameTargetId,
        realName: realNameValue.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update real name');
        return;
      }
      toast.success(res.message || 'Real name updated');
      setRealNameTargetId(null);
      setRealNameValue('');
      void load(page);
    } finally {
      setRealNameBusy(false);
    }
  }, [load, page, realNameTargetId, realNameValue]);

  const startBlockCaller = useCallback(
    async (row: UserRow) => {
      const next = !Boolean(row.block);
      setBlockCallerBusy(true);
      try {
        const res = await secureApi('users.sendBlockOtp', {
          mobile: resolveBlockOtpMobile(admin?.mobile),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to send OTP');
          return;
        }
        toast.success('OTP sent successfully to SuperAdmin');
        setBlockCallerTarget(row);
        setBlockCallerNext(next);
        setBlockCallerRemark('');
        setBlockCallerOtp('');
      } finally {
        setBlockCallerBusy(false);
      }
    },
    [admin?.mobile],
  );

  const confirmBlockCaller = useCallback(async () => {
    if (!blockCallerTarget) return;
    if (!blockCallerOtp.trim()) {
      toast.error('Please enter OTP');
      return;
    }
    if (!blockCallerRemark.trim()) {
      toast.error('Please enter remark');
      return;
    }
    setBlockCallerBusy(true);
    try {
      const verify = await secureApi('users.verifyBlockOtp', {
        mobile: resolveBlockOtpMobile(admin?.mobile),
        otp: Number(blockCallerOtp.trim()),
      });
      if (!verify.ok) {
        toast.error(verify.message || 'Invalid OTP');
        return;
      }
      const res = await secureApi('ops.blockCaller', {
        _id: blockCallerTarget._id,
        Role_ID: blockCallerTarget.Role_ID,
        status: blockCallerNext,
        blockReason: blockCallerRemark.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update caller block');
        return;
      }
      toast.success(res.message || 'Updated successfully');
      setBlockCallerTarget(null);
      void load(page);
    } finally {
      setBlockCallerBusy(false);
    }
  }, [
    admin?.mobile,
    blockCallerNext,
    blockCallerOtp,
    blockCallerRemark,
    blockCallerTarget,
    load,
    page,
  ]);

  const openDump = useCallback((row: UserRow) => {
    setDumpTarget(row);
    setDumpReason('');
  }, []);

  return {
    actionBusyId,
    otpSending,
    canEditSubAdminRole,
    canEditEmpCode,
    locationDraft,
    setLocationDraft,
    locationBusyId,
    blockCallerBusy,
    startBlockWithOtp,
    openDump,
    openSubEdit,
    openRoleEdit,
    updateSubAdminLocation,
    openRealName,
    startBlockCaller,
    renderEmpCodeCell,
    block: {
      target: blockTarget,
      nextStatus: blockNextStatus,
      remark,
      setRemark,
      otp,
      setOtp,
      otpSending,
      actionBusyId,
      close: closeBlockDialog,
      resendOtp: resendBlockOtp,
      confirm: confirmBlock,
      maxRemark: MAX_REMARK,
    },
    dump: {
      target: dumpTarget,
      reason: dumpReason,
      setReason: setDumpReason,
      actionBusyId,
      close: () => setDumpTarget(null),
      confirm: confirmDump,
      maxRemark: MAX_REMARK,
    },
    subEdit: {
      edit: subEdit,
      value: subEditValue,
      setValue: setSubEditValue,
      busy: subEditBusy,
      close: () => setSubEdit(null),
      submit: submitSubEdit,
    },
    role: {
      id: roleEditId,
      value: roleEditValue,
      setValue: setRoleEditValue,
      options: roleOptions,
      busy: roleEditBusy,
      close: () => setRoleEditId(null),
      submit: submitRoleEdit,
    },
    realName: {
      targetId: realNameTargetId,
      value: realNameValue,
      setValue: setRealNameValue,
      busy: realNameBusy,
      close: () => setRealNameTargetId(null),
      submit: submitRealName,
    },
    blockCaller: {
      target: blockCallerTarget,
      next: blockCallerNext,
      remark: blockCallerRemark,
      setRemark: setBlockCallerRemark,
      otp: blockCallerOtp,
      setOtp: setBlockCallerOtp,
      busy: blockCallerBusy,
      close: () => setBlockCallerTarget(null),
      confirm: confirmBlockCaller,
      maxRemark: MAX_REMARK,
    },
  };
}
