import { useCallback, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getSessionUser } from '@/auth/permissions';
import { apiFailed, type KycRow } from './types';
import { updatedByPayload } from './utils';

const EMPTY_APPROVE = {
  accountNumber: '',
  ifsc: '',
  aadhaarNumber: '',
  upiId: '',
  comment: '',
  otp: '',
  kycAdminOtp: '',
};

const EMPTY_MANUAL = {
  userBankName: '',
  bankName: '',
  accountNumber: '',
  aadhaarNumber: '',
  upiId: '',
  ifsc: '',
  comment: '',
  otp: '',
  kycAdminOtp: '',
};

type Params = {
  reload: () => void;
  unlockNightLock: () => void;
};

export function useKycActions({ reload, unlockNightLock }: Params) {
  const sendKycOtp = useCallback(async (row: KycRow, sendOTPToClient: boolean) => {
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
  }, []);

  // ---- Approve ----
  const [approveTarget, setApproveTarget] = useState<KycRow | null>(null);
  const [approveStep, setApproveStep] = useState<'details' | 'otp'>('details');
  const [approveForm, setApproveForm] = useState(EMPTY_APPROVE);
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

          const upiRes = await secureApi('ops.kycVerifyUpi', {
            upiId: approveForm.upiId.trim(),
            _clientName: approveTarget.clientName,
          });
          if (apiFailed(upiRes)) {
            toast.error(upiRes.message || 'UPI verification failed');
            return;
          }

          const otpOk = await sendKycOtp(approveTarget, false);
          if (!otpOk) return;

          toast.success('OTP Sent Successfully');
          setApproveStep('otp');
        } finally {
          setApproveSubmitting(false);
        }
        return;
      }

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
        reload();
      } finally {
        setApproveSubmitting(false);
      }
    },
    [approveTarget, approveForm, approveStep, sendKycOtp, reload],
  );

  // ---- Reject ----
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
        reload();
      } finally {
        setRejectSubmitting(false);
      }
    },
    [rejectTarget, rejectOtp, rejectAdminOtp, reload],
  );

  // ---- Manual ----
  const [manualTarget, setManualTarget] = useState<KycRow | null>(null);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL);
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
        reload();
      } finally {
        setManualSubmitting(false);
      }
    },
    [manualTarget, manualForm, reload],
  );

  // ---- Dialer + UPI verify ----
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [calledId, setCalledId] = useState('');
  const [callingId, setCallingId] = useState<string | null>(null);

  const connectToDialer = useCallback(async (row: KycRow) => {
    if (!row.mobile) {
      toast.error('No mobile number on file for this user');
      return;
    }
    setCallingId(row._id);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId: 'KYC',
        listId: '800001',
        listName: 'KYC UPDATION',
        serverId: '1',
        leads: [
          {
            first_name: row.name ?? '',
            last_name: '',
            phone_number: row.mobile,
            city: String(row.city ?? ''),
            state: String(row.state ?? ''),
            email: row.clientName ?? '',
            comments: row.clientName ?? '',
            province: row._id,
          },
        ],
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to send call request');
        return;
      }
      toast.success(res.message || 'Data sent successfully');
      setCalledId(row._id);
    } finally {
      setCallingId(null);
    }
  }, []);

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

  // ---- Night-lock enable OTP ----
  const [enableOtpOpen, setEnableOtpOpen] = useState(false);
  const [enableOtpSent, setEnableOtpSent] = useState(false);
  const [enableOtpValue, setEnableOtpValue] = useState('');
  const [enableOtpLoading, setEnableOtpLoading] = useState(false);

  const openEnableOtp = useCallback(() => {
    setEnableOtpOpen(true);
    setEnableOtpSent(false);
    setEnableOtpValue('');
  }, []);

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

  return {
    openApprove,
    openReject,
    openManual,
    connectToDialer,
    verifyUpi,
    calledId,
    callingId,
    verifyingId,
    rejectSubmitting,
    manualSubmitting,
    approve: {
      target: approveTarget,
      step: approveStep,
      form: approveForm,
      setForm: setApproveForm,
      submitting: approveSubmitting,
      close: closeApprove,
      submit: submitApprove,
    },
    reject: {
      target: rejectTarget,
      otp: rejectOtp,
      setOtp: setRejectOtp,
      adminOtp: rejectAdminOtp,
      setAdminOtp: setRejectAdminOtp,
      submitting: rejectSubmitting,
      close: () => !rejectSubmitting && setRejectTarget(null),
      submit: submitReject,
    },
    manual: {
      target: manualTarget,
      form: manualForm,
      setForm: setManualForm,
      submitting: manualSubmitting,
      close: () => !manualSubmitting && setManualTarget(null),
      submit: submitManual,
    },
    enableOtp: {
      open: enableOtpOpen,
      sent: enableOtpSent,
      value: enableOtpValue,
      setValue: setEnableOtpValue,
      loading: enableOtpLoading,
      openDialog: openEnableOtp,
      close: () => !enableOtpLoading && setEnableOtpOpen(false),
      send: sendEnableOtp,
      verify: verifyEnableOtp,
    },
  };
}
