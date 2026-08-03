import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  canAccessNavItem,
  getSessionUser,
  hasPermission,
  Permissions,
} from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { createTableFiltersContext } from '@/components/createTableFiltersContext';
import { appCodeForName } from '@/constants/clientNames';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { dateTime, formatDisplayDate } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { CLIENT_NAMES } from '@/screens/panel/shared/clientNames';
import { display, maskMobile } from '@/screens/panel/shared';
import {
  apiFailed,
  EMPTY_KYC_FILTERS,
  type KycFilters,
  type KycRow,
} from '@/screens/panel/kyc/types';
import { useKycNightLock } from '@/screens/panel/kyc/useKycNightLock';

type Filters = KycFilters;
const EMPTY_FILTERS = EMPTY_KYC_FILTERS;

const filterFieldSx = {
  minWidth: 110,
  '& .MuiInputBase-root': { bgcolor: '#1a1a1f', fontSize: 12 },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  height: 36,
  px: 2.5,
  borderRadius: 1,
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  '&:hover': { bgcolor: '#e08c00' },
};

const toolbarFieldSx = {
  width: 160,
  flex: '0 0 auto',
  '& .MuiInputBase-root': { bgcolor: '#121218' },
};

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

type KycFiltersCtx = {
  draftFilters: Filters;
  setDraftField: (key: keyof Filters) => (value: string) => void;
  search: () => void;
};

const { Provider: KycFiltersProvider, useFilters: useKycFilters } =
  createTableFiltersContext<KycFiltersCtx>('KycFilters');

function KycColumnFilter({
  field,
  placeholder,
}: {
  field: keyof Filters;
  placeholder: string;
}) {
  const { draftFilters, setDraftField, search } = useKycFilters();
  return (
    <ColumnSearch
      value={draftFilters[field]}
      onChange={setDraftField(field)}
      onSearch={search}
      placeholder={placeholder}
    />
  );
}

function updatedByPayload() {
  const user = getSessionUser();
  return { _id: user?._id, name: user?.name };
}

export function UsersKycPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const canViewKyc = canAccessNavItem({
    id: 'usersKyc',
    permission: Permissions.View_KYCs,
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const {
    isNightLockActive,
    unlockNightLock,
  } = useKycNightLock();
  const [enableOtpOpen, setEnableOtpOpen] = useState(false);
  const [enableOtpSent, setEnableOtpSent] = useState(false);
  const [enableOtpValue, setEnableOtpValue] = useState('');
  const [enableOtpLoading, setEnableOtpLoading] = useState(false);

  const [rows, setRows] = useState<KycRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, filtersOverride?: Filters, appOverride = appClientName) => {
      const active = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filter: Record<string, string> = {};
        if (active.name.trim()) filter.name = active.name.trim();
        if (active.dpId.trim()) filter._id = active.dpId.trim();
        if (active.mobile.trim()) filter.mobile = active.mobile.trim();
        if (active.aadhaarNumber.trim()) filter.aadhaarNumber = active.aadhaarNumber.trim();
        if (active.accountNumber.trim()) filter.accountNumber = active.accountNumber.trim();
        if (appOverride) filter.clientName = appOverride;

        const payload: Record<string, unknown> = {
          itemsPerPage: pageSize,
          pageNo,
          filter,
        };
        // Match KYC.tsx filterTransaction date payload.
        if (startDate && endDate) {
          payload.startDate = dateTime(startDate);
          payload.endDate = dateTime(endDate);
        }

        const res = await secureApi('users.getAll', payload);
        if (!isCurrent(gen)) return;

        if (apiFailed(res)) {
          const msg = res.message || 'Failed to load KYC list';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.users)
          ? (data.users as KycRow[])
          : Array.isArray(data.items)
            ? (data.items as KycRow[])
            : Array.isArray(res.data)
              ? (res.data as KycRow[])
              : [];
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setTotal(Number(data.total ?? data.count) || items.length);
        });
        if (items.length <= 0 && startDate && endDate) {
          toast.info('No kyc registered for selected date');
        }
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, startDate, endDate, appClientName, appliedFilters, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appClientName]);

  const sendEnableOtp = useCallback(async () => {
    const user = getSessionUser();
    const mobile = user?.mobile;
    if (!mobile) {
      toast.error('Admin mobile not found');
      return;
    }
    setEnableOtpLoading(true);
    try {
      const res = await secureApi('users.sendBlockOtp', { mobile });
      if (apiFailed(res)) {
        toast.error(res.message || 'Failed to send OTP');
        return;
      }
      setEnableOtpSent(true);
      toast.success('OTP sent successfully');
    } finally {
      setEnableOtpLoading(false);
    }
  }, []);

  const verifyEnableOtp = useCallback(async () => {
    const user = getSessionUser();
    const mobile = user?.mobile;
    if (!mobile) {
      toast.error('Admin mobile not found');
      return;
    }
    if (enableOtpValue.trim().length !== 4) {
      toast.error('OTP must be 4 digits');
      return;
    }
    setEnableOtpLoading(true);
    try {
      const res = await secureApi('users.verifyBlockOtp', {
        mobile,
        otp: Number(enableOtpValue.trim()),
      });
      if (apiFailed(res)) {
        toast.error(res.message || 'Invalid OTP');
        return;
      }
      toast.success('OTP Verified');
      unlockNightLock();
      setEnableOtpOpen(false);
      setEnableOtpSent(false);
      setEnableOtpValue('');
    } finally {
      setEnableOtpLoading(false);
    }
  }, [enableOtpValue, unlockNightLock]);

  const deferredRows = useDeferredValue(rows);

  const applyDates = useCallback(() => {
    if (!startDate) {
      toast.error('Please select from date');
      return;
    }
    if (!endDate) {
      toast.error('Please select to date');
      return;
    }
    setPage(1);
    void load(1);
  }, [load, startDate, endDate]);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const sendKycOtp = useCallback(
    async (row: KycRow, sendOTPToClient: boolean) => {
      const res = await secureApi('ops.kycSendOtp', {
        sendOTPToClient,
        mobile: row.mobile,
        clientName: row.clientName,
      });
      if (apiFailed(res)) {
        toast.error(res.message || 'Failed to send OTP');
        return false;
      }
      toast.success(
        sendOTPToClient ? 'OTP Sent Successfully' : 'Admin OTP Sent Successfully',
      );
      return true;
    },
    [],
  );

  const [approveTarget, setApproveTarget] = useState<KycRow | null>(null);
  const [approveStep, setApproveStep] = useState<'details' | 'otp'>('details');
  const [approveForm, setApproveForm] = useState({
    accountNumber: '',
    ifsc: '',
    aadhaarNumber: '',
    upiId: '',
    comment: '',
    otp: '',
    kycAdminOtp: '',
  });
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const openApprove = useCallback((row: KycRow) => {
    setApproveTarget(row);
    setApproveStep('details');
    setApproveForm({
      accountNumber: row.accountNumber || '',
      ifsc: row.ifsc || '',
      aadhaarNumber: row.aadhaarNumber || '',
      upiId: row.upiId || '',
      comment: '',
      otp: '',
      kycAdminOtp: '',
    });
  }, []);

  const closeApprove = useCallback(() => {
    if (approveSubmitting) return;
    setApproveTarget(null);
    setApproveStep('details');
  }, [approveSubmitting]);

  const submitApprove = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!approveTarget?._id) return;

      if (approveStep === 'details') {
        if (!approveForm.accountNumber.trim()) {
          toast.error('Enter Correct Bank Account Number');
          return;
        }
        if (!approveForm.aadhaarNumber.trim()) {
          toast.error('Enter Correct Aadhar Number');
          return;
        }
        if (!approveForm.ifsc.trim()) {
          toast.error('Enter Correct IFSC Number');
          return;
        }
        if (!approveForm.upiId.trim()) {
          toast.error('Enter Correct UPI ID');
          return;
        }

        setApproveSubmitting(true);
        try {
          // 1) Bank verify — POST /kyc/kyc
          const bankRes = await secureApi('ops.kycApprove', {
            accountNumber: approveForm.accountNumber.trim(),
            ifsc: approveForm.ifsc.trim(),
            aadhaarNumber: approveForm.aadhaarNumber.trim(),
            _clientName: approveTarget.clientName,
          });
          if (apiFailed(bankRes)) {
            toast.error(bankRes.message || 'KYC bank verification failed');
            return;
          }

          // 2) UPI verify
          const upiRes = await secureApi('ops.kycVerifyUpi', {
            upiId: approveForm.upiId.trim(),
            _clientName: approveTarget.clientName,
          });
          if (apiFailed(upiRes)) {
            toast.error(upiRes.message || 'UPI verification failed');
            return;
          }

          // 3) Admin OTP (sendOTPToClient: false)
          const otpOk = await sendKycOtp(approveTarget, false);
          if (!otpOk) return;

          toast.success('OTP Sent Successfully');
          setApproveStep('otp');
        } finally {
          setApproveSubmitting(false);
        }
        return;
      }

      // 4) Final approve — POST /kyc/kycAdminOtp
      if (!approveForm.otp.trim()) {
        toast.error('Please enter OTP');
        return;
      }
      if (!approveForm.kycAdminOtp.trim()) {
        toast.error('Please enter Admin OTP');
        return;
      }
      if (!/^\d{4}$/.test(approveForm.otp.trim())) {
        toast.error('Please enter a valid 4 digit OTP');
        return;
      }
      if (!approveForm.comment.trim()) {
        toast.error('Please enter Comment');
        return;
      }

      setApproveSubmitting(true);
      try {
        const res = await secureApi('ops.kycAdminOtp', {
          accountNumber: approveForm.accountNumber.trim(),
          otp: approveForm.otp.trim(),
          aadhaarNumber: approveForm.aadhaarNumber.trim(),
          _id: approveTarget._id,
          upiId: approveForm.upiId.trim(),
          kycAdminOtp: approveForm.kycAdminOtp.trim(),
          currentKycNote: approveForm.comment.trim(),
          mobile: approveTarget.mobile,
          clientName: approveTarget.clientName,
          updatedBy: updatedByPayload(),
        });
        if (apiFailed(res)) {
          toast.error(res.message || 'Failed to approve KYC');
          return;
        }
        toast.success('KYC Approved Successfully');
        setApproveTarget(null);
        setApproveStep('details');
        void load(page);
      } finally {
        setApproveSubmitting(false);
      }
    },
    [approveTarget, approveForm, approveStep, sendKycOtp, load, page],
  );

  const [rejectTarget, setRejectTarget] = useState<KycRow | null>(null);
  const [rejectOtp, setRejectOtp] = useState('');
  const [rejectAdminOtp, setRejectAdminOtp] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const openReject = useCallback(
    async (row: KycRow) => {
      setRejectSubmitting(true);
      try {
        const ok = await sendKycOtp(row, true);
        if (!ok) return;
        setRejectTarget(row);
        setRejectOtp('');
        setRejectAdminOtp('');
      } finally {
        setRejectSubmitting(false);
      }
    },
    [sendKycOtp],
  );

  const submitReject = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!rejectTarget?._id) return;
      if (!rejectOtp.trim() || !rejectAdminOtp.trim()) {
        toast.error('Please enter Customer OTP and Admin OTP');
        return;
      }
      setRejectSubmitting(true);
      try {
        const res = await secureApi('ops.kycReject', {
          _id: rejectTarget._id,
          mobile: rejectTarget.mobile,
          clientName: rejectTarget.clientName,
          otp: rejectOtp.trim(),
          kycAdminOtp: rejectAdminOtp.trim(),
          updatedBy: updatedByPayload(),
        });
        if (apiFailed(res)) {
          toast.error(res.message || 'Failed to reject KYC');
          return;
        }
        toast.success('KYC Rejected Successfully');
        setRejectTarget(null);
        setRejectOtp('');
        setRejectAdminOtp('');
        void load(page);
      } finally {
        setRejectSubmitting(false);
      }
    },
    [rejectTarget, rejectOtp, rejectAdminOtp, load, page],
  );

  const [manualTarget, setManualTarget] = useState<KycRow | null>(null);
  const [manualForm, setManualForm] = useState({
    userBankName: '',
    bankName: '',
    accountNumber: '',
    aadhaarNumber: '',
    upiId: '',
    ifsc: '',
    comment: '',
    otp: '',
    kycAdminOtp: '',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const openManual = useCallback(
    async (row: KycRow) => {
      setManualSubmitting(true);
      try {
        const ok = await sendKycOtp(row, true);
        if (!ok) return;
        setManualTarget(row);
        setManualForm({
          userBankName: '',
          bankName: '',
          accountNumber: row.accountNumber || '',
          aadhaarNumber: row.aadhaarNumber || '',
          upiId: row.upiId || '',
          ifsc: row.ifsc || '',
          comment: '',
          otp: '',
          kycAdminOtp: '',
        });
      } finally {
        setManualSubmitting(false);
      }
    },
    [sendKycOtp],
  );

  const submitManual = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!manualTarget?._id) return;
      if (!manualForm.otp.trim()) {
        toast.error('Please enter OTP');
        return;
      }
      if (!manualForm.kycAdminOtp.trim()) {
        toast.error('Please enter Admin OTP');
        return;
      }
      if (!/^\d{4}$/.test(manualForm.otp.trim())) {
        toast.error('Please enter a valid 4 digit OTP');
        return;
      }
      if (!manualForm.userBankName.trim()) {
        toast.error('Please enter user bank name');
        return;
      }
      if (!manualForm.bankName.trim()) {
        toast.error('Please enter bank name');
        return;
      }
      if (!manualForm.accountNumber.trim()) {
        toast.error('Please enter account no');
        return;
      }
      if (!manualForm.aadhaarNumber.trim()) {
        toast.error('Please enter aadhar no');
        return;
      }
      if (!manualForm.upiId.trim()) {
        toast.error('Please enter UPI ID');
        return;
      }
      if (!manualForm.ifsc.trim()) {
        toast.error('Please enter ifsc code');
        return;
      }
      if (!manualForm.comment.trim()) {
        toast.error('Please enter Comment');
        return;
      }

      setManualSubmitting(true);
      try {
        const res = await secureApi('ops.kycManualUpdate', {
          userId: manualTarget._id,
          aadhaarNumber: manualForm.aadhaarNumber.trim(),
          upiId: manualForm.upiId.trim(),
          accountNumber: manualForm.accountNumber.trim(),
          ifsc: manualForm.ifsc.trim(),
          bankName: manualForm.bankName.trim(),
          userBankName: manualForm.userBankName.trim(),
          mobile: manualTarget.mobile,
          clientName: manualTarget.clientName,
          otp: manualForm.otp.trim(),
          kycAdminOtp: manualForm.kycAdminOtp.trim(),
          currentKycNote: manualForm.comment.trim(),
          updatedBy: updatedByPayload(),
        });
        if (apiFailed(res)) {
          toast.error(res.message || 'Failed to save manual KYC update');
          return;
        }
        toast.success('Manual KYC Updated Successfully');
        setManualTarget(null);
        void load(page);
      } finally {
        setManualSubmitting(false);
      }
    },
    [manualTarget, manualForm, load, page],
  );

  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const verifyUpi = useCallback(async (row: KycRow) => {
    if (!row.upiId) {
      toast.error('No UPI ID on file for this user');
      return;
    }
    setVerifyingId(row._id);
    try {
      const res = await secureApi('ops.kycVerifyUpi', {
        upiId: row.upiId,
        _clientName: row.clientName,
      });
      if (apiFailed(res)) {
        toast.error(res.message || 'UPI verification failed');
        return;
      }
      toast.success('UPI verified successfully');
    } finally {
      setVerifyingId(null);
    }
  }, []);

  const columns = useMemo<CommonTableColumn<KycRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: <KycColumnFilter field="name" placeholder="Search name" />,
        render: (row) => (
          <Typography variant="body2" fontWeight={600}>
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'dpId',
        label: 'Dp Id',
        filter: <KycColumnFilter field="dpId" placeholder="Search dp id" />,
        render: (row) => row._id || '—',
      },
      {
        id: 'appCode',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={appClientName}
            onChange={(e) => {
              setAppClientName(e.target.value);
              setPage(1);
            }}
            sx={filterFieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: <KycColumnFilter field="mobile" placeholder="Search mobile" />,
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'aadhaar',
        label: 'Aadhar',
        filter: (
          <KycColumnFilter field="aadhaarNumber" placeholder="Search aadhar" />
        ),
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'account',
        label: 'Account',
        filter: (
          <KycColumnFilter field="accountNumber" placeholder="Search account" />
        ),
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'ifsc',
        label: 'IFSC',
        render: (row) => display(row.ifsc),
      },
      {
        id: 'upi',
        label: 'UPI',
        render: (row) => (
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.upiId)}</Typography>
            {row.upiId ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<VerifiedUserOutlinedIcon sx={{ fontSize: 14 }} />}
                disabled={verifyingId === row._id}
                onClick={() => void verifyUpi(row)}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  py: 0.25,
                  minWidth: 0,
                  borderColor: 'rgba(255,255,255,0.28)',
                  color: '#e8e8ea',
                }}
              >
                Verify
              </Button>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        render: (row) => (
          <Chip
            size="small"
            label={row.kyc ? 'Approved' : 'Pending'}
            color={row.kyc ? 'success' : 'default'}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        ),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
      {
        id: 'checkBy',
        label: 'Check By',
        render: (row) => display(row.kycRejectCheckBy?.name || row.kycManualCheckBy?.name),
      },
      {
        id: 'crossCheckBy',
        label: 'Cross Check By',
        render: (row) =>
          display(row.kycRejectCrossCheckBy?.name || row.kycManualCrossCheckBy?.name),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 220,
        render: (row) => (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="center">
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
              disabled={isNightLockActive}
              onClick={() => openApprove(row)}
              sx={{
                ...orangeBtnSx,
                fontSize: 11,
                px: 1,
                py: 0.25,
                minWidth: 0,
                height: 28,
                textTransform: 'none',
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<CancelOutlinedIcon sx={{ fontSize: 14 }} />}
              disabled={isNightLockActive || rejectSubmitting || manualSubmitting}
              onClick={() => void openReject(row)}
              sx={{ textTransform: 'none', fontSize: 11, px: 1, py: 0.25, minWidth: 0 }}
            >
              Reject
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={isNightLockActive || rejectSubmitting || manualSubmitting}
              onClick={() => void openManual(row)}
              sx={{
                textTransform: 'none',
                fontSize: 11,
                px: 1,
                py: 0.25,
                minWidth: 0,
                borderColor: 'rgba(255,255,255,0.28)',
                color: '#e8e8ea',
              }}
            >
              Manual
            </Button>
          </Stack>
        ),
      },
    ],
    [
      canShowMobile,
      page,
      pageSize,
      verifyingId,
      verifyUpi,
      openApprove,
      openReject,
      openManual,
      rejectSubmitting,
      manualSubmitting,
      isNightLockActive,
      appClientName,
    ],
  );

  const filtersCtx = useMemo<KycFiltersCtx>(
    () => ({ draftFilters, setDraftField, search }),
    [draftFilters, setDraftField, search],
  );

  if (!canViewKyc) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          KYC
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You do not have permission to view this page.
        </Typography>
      </Box>
    );
  }

  return (
    <KycFiltersProvider value={filtersCtx}>
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        KYC
      </Typography>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <Paper sx={{ p: 2, pt: 3, mb: 2, bgcolor: '#1a1a1f', overflow: 'visible' }}>
        <Box sx={{ overflowX: 'auto', overflowY: 'visible', pb: 0.25 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ pt: 1, minWidth: 'max-content' }}
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={toolbarFieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={toolbarFieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            fullWidth={false}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...toolbarFieldSx, width: 130 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyDates}
            disabled={loading}
            sx={orangeBtnSx}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/kycList')}
            sx={orangeBtnSx}
          >
            KYC List
          </Button>
          {isNightLockActive ? (
            <Button
              variant="contained"
              onClick={() => {
                setEnableOtpOpen(true);
                setEnableOtpSent(false);
                setEnableOtpValue('');
              }}
              sx={orangeBtnSx}
            >
              Enable KYC Flow
            </Button>
          ) : null}
        </Stack>
        </Box>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, i) => row._id || i}
        loading={loading}
        emptyMessage="No KYC records found"
        stickyHeader
        dense
        minWidth={1500}
        maxHeight="calc(100vh - 300px)"
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mt={2}>
        <Typography variant="body2" color="text.secondary">
          Total: {total}
        </Typography>
        <Pagination
          count={Math.max(1, totalPages)}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
          disabled={loading}
        />
      </Stack>

      <Dialog
        open={Boolean(approveTarget)}
        onClose={closeApprove}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={submitApprove}>
          <DialogTitle>
            Approve KYC{approveTarget?.name ? ` — ${approveTarget.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              {approveStep === 'details' ? (
                <>
                  <TextField
                    label="Account Number"
                    size="small"
                    fullWidth
                    value={approveForm.accountNumber}
                    onChange={(e) =>
                      setApproveForm((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="IFSC"
                    size="small"
                    fullWidth
                    value={approveForm.ifsc}
                    onChange={(e) =>
                      setApproveForm((prev) => ({
                        ...prev,
                        ifsc: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <TextField
                    label="Aadhar Number"
                    size="small"
                    fullWidth
                    value={approveForm.aadhaarNumber}
                    onChange={(e) =>
                      setApproveForm((prev) => ({
                        ...prev,
                        aadhaarNumber: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="UPI ID"
                    size="small"
                    fullWidth
                    value={approveForm.upiId}
                    onChange={(e) =>
                      setApproveForm((prev) => ({ ...prev, upiId: e.target.value }))
                    }
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Customer OTP"
                    size="small"
                    fullWidth
                    required
                    autoFocus
                    value={approveForm.otp}
                    onChange={(e) =>
                      setApproveForm((prev) => ({ ...prev, otp: e.target.value }))
                    }
                  />
                  <TextField
                    label="Admin OTP"
                    size="small"
                    fullWidth
                    required
                    value={approveForm.kycAdminOtp}
                    onChange={(e) =>
                      setApproveForm((prev) => ({
                        ...prev,
                        kycAdminOtp: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="Comment (For KYC Updation)"
                    size="small"
                    fullWidth
                    required
                    value={approveForm.comment}
                    onChange={(e) =>
                      setApproveForm((prev) => ({ ...prev, comment: e.target.value }))
                    }
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeApprove} disabled={approveSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={approveSubmitting} sx={orangeBtnSx}>
              {approveSubmitting
                ? 'Saving…'
                : approveStep === 'details'
                  ? 'Send OTP'
                  : 'Approve'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onClose={() => !rejectSubmitting && setRejectTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={submitReject}>
          <DialogTitle>
            Reject KYC{rejectTarget?.name ? ` — ${rejectTarget.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Customer OTP"
                size="small"
                fullWidth
                required
                autoFocus
                value={rejectOtp}
                onChange={(e) => setRejectOtp(e.target.value)}
              />
              <TextField
                label="Admin OTP"
                size="small"
                fullWidth
                required
                value={rejectAdminOtp}
                onChange={(e) => setRejectAdminOtp(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRejectTarget(null)} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="error" disabled={rejectSubmitting}>
              {rejectSubmitting ? 'Saving…' : 'Reject'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(manualTarget)}
        onClose={() => !manualSubmitting && setManualTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={submitManual}>
          <DialogTitle>
            Manual KYC Update{manualTarget?.name ? ` — ${manualTarget.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="User Bank Name"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.userBankName}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, userBankName: e.target.value }))
                  }
                />
                <TextField
                  label="Bank Name"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.bankName}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Account No"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.accountNumber}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                />
                <TextField
                  label="Aadhar No"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.aadhaarNumber}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, aadhaarNumber: e.target.value }))
                  }
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="UPI ID"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.upiId}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, upiId: e.target.value }))}
                />
                <TextField
                  label="IFSC"
                  size="small"
                  fullWidth
                  required
                  value={manualForm.ifsc}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      ifsc: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </Stack>
              <TextField
                label="Customer OTP"
                size="small"
                fullWidth
                required
                value={manualForm.otp}
                onChange={(e) => setManualForm((prev) => ({ ...prev, otp: e.target.value }))}
              />
              <TextField
                label="Admin OTP"
                size="small"
                fullWidth
                required
                value={manualForm.kycAdminOtp}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, kycAdminOtp: e.target.value }))
                }
              />
              <TextField
                label="Comment"
                size="small"
                fullWidth
                required
                value={manualForm.comment}
                onChange={(e) => setManualForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setManualTarget(null)} disabled={manualSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={manualSubmitting} sx={orangeBtnSx}>
              {manualSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={enableOtpOpen}
        onClose={() => !enableOtpLoading && setEnableOtpOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>OTP Verification</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            {!enableOtpSent ? (
              <Typography color="text.secondary">
                OTP will be sent to super-admin
              </Typography>
            ) : (
              <TextField
                label="Enter OTP"
                size="small"
                fullWidth
                autoFocus
                value={enableOtpValue}
                onChange={(e) => setEnableOtpValue(e.target.value)}
                inputProps={{ maxLength: 4 }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEnableOtpOpen(false)}
            disabled={enableOtpLoading}
          >
            Close
          </Button>
          {!enableOtpSent ? (
            <Button
              variant="contained"
              disabled={enableOtpLoading}
              onClick={() => void sendEnableOtp()}
              sx={orangeBtnSx}
            >
              {enableOtpLoading ? 'Sending…' : 'Send OTP'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={enableOtpLoading}
              onClick={() => void verifyEnableOtp()}
              sx={orangeBtnSx}
            >
              {enableOtpLoading ? 'Verifying…' : 'Verify OTP'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
    </KycFiltersProvider>
  );
}
