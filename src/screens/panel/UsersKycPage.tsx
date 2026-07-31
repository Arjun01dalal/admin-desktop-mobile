import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { toast } from 'react-toastify';
import { CheckCircle2, ShieldQuestion, XCircle } from 'lucide-react';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { formatDisplayDate } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { CLIENT_NAMES } from '@/screens/panel/shared/clientNames';
import { Button } from '@/components/ui/button';
import {
  ReportPage,
  DataTable,
  DateField,
  SelectField,
  PageSizeField,
  SearchInput,
  ApplyButton,
  ReportPager,
  ReportDialog,
  display,
  maskMobile,
  type DataColumn,
} from '@/screens/panel/shared';

type CheckStamp = { name?: string; date?: string } | undefined;

type KycRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  aadhaarNumber?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  kyc?: boolean;
  createdOn?: string;
  kycRejectCheckBy?: CheckStamp;
  kycRejectCrossCheckBy?: CheckStamp;
  kycManualCheckBy?: CheckStamp;
  kycManualCrossCheckBy?: CheckStamp;
  [key: string]: unknown;
};

type Filters = {
  name: string;
  mobile: string;
  aadhaarNumber: string;
  accountNumber: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  mobile: '',
  aadhaarNumber: '',
  accountNumber: '',
};

function updatedByPayload() {
  const user = getSessionUser();
  return { _id: user?._id, name: user?.name };
}

export function UsersKycPage() {
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const canViewKyc = hasPermission(Permissions.View_KYCs);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

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
        if (active.name) filter.name = active.name;
        if (active.mobile) filter.mobile = active.mobile;
        if (active.aadhaarNumber) filter.aadhaarNumber = active.aadhaarNumber;
        if (active.accountNumber) filter.accountNumber = active.accountNumber;
        if (appOverride) filter.clientName = appOverride;

        const payload: Record<string, unknown> = {
          itemsPerPage: pageSize,
          pageNo,
          filter,
        };
        if (startDate) payload.startDate = startDate;
        if (endDate) payload.endDate = endDate;

        const res = await secureApi('users.getAll', payload);
        if (!isCurrent(gen)) return;

        if (!res.ok) {
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
            : [];
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setTotal(Number(data.total ?? data.count) || items.length);
        });
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

  const deferredRows = useDeferredValue(rows);

  const applyDates = useCallback(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  // ---- Approve dialog ----
  const [approveTarget, setApproveTarget] = useState<KycRow | null>(null);
  const [approveForm, setApproveForm] = useState({
    accountNumber: '',
    ifsc: '',
    aadhaarNumber: '',
    upiId: '',
    comment: '',
  });
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const openApprove = useCallback((row: KycRow) => {
    setApproveTarget(row);
    setApproveForm({
      accountNumber: row.accountNumber || '',
      ifsc: row.ifsc || '',
      aadhaarNumber: row.aadhaarNumber || '',
      upiId: row.upiId || '',
      comment: '',
    });
  }, []);

  const submitApprove = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!approveTarget?._id) return;
      setApproveSubmitting(true);
      try {
        const res = await secureApi('ops.kycApprove', {
          _id: approveTarget._id,
          mobile: approveTarget.mobile,
          clientName: approveTarget.clientName,
          accountNumber: approveForm.accountNumber,
          ifsc: approveForm.ifsc,
          aadhaarNumber: approveForm.aadhaarNumber,
          upiId: approveForm.upiId,
          currentKycNote: approveForm.comment,
          updatedBy: updatedByPayload(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to approve KYC');
          return;
        }
        toast.success('KYC Approved Successfully');
        setApproveTarget(null);
        void load(page);
      } finally {
        setApproveSubmitting(false);
      }
    },
    [approveTarget, approveForm, load, page],
  );

  // ---- Reject dialog ----
  const [rejectTarget, setRejectTarget] = useState<KycRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const submitReject = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!rejectTarget?._id || !rejectReason.trim()) return;
      setRejectSubmitting(true);
      try {
        const res = await secureApi('ops.kycReject', {
          _id: rejectTarget._id,
          mobile: rejectTarget.mobile,
          clientName: rejectTarget.clientName,
          reason: rejectReason.trim(),
          updatedBy: updatedByPayload(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to reject KYC');
          return;
        }
        toast.success('KYC Rejected Successfully');
        setRejectTarget(null);
        setRejectReason('');
        void load(page);
      } finally {
        setRejectSubmitting(false);
      }
    },
    [rejectTarget, rejectReason, load, page],
  );

  // ---- Manual update dialog ----
  const [manualTarget, setManualTarget] = useState<KycRow | null>(null);
  const [manualForm, setManualForm] = useState({
    userBankName: '',
    bankName: '',
    accountNumber: '',
    aadhaarNumber: '',
    upiId: '',
    ifsc: '',
    comment: '',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const openManual = useCallback((row: KycRow) => {
    setManualTarget(row);
    setManualForm({
      userBankName: '',
      bankName: '',
      accountNumber: row.accountNumber || '',
      aadhaarNumber: row.aadhaarNumber || '',
      upiId: row.upiId || '',
      ifsc: row.ifsc || '',
      comment: '',
    });
  }, []);

  const submitManual = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!manualTarget?._id) return;
      setManualSubmitting(true);
      try {
        const res = await secureApi('ops.kycManualUpdate', {
          userId: manualTarget._id,
          mobile: manualTarget.mobile,
          clientName: manualTarget.clientName,
          userBankName: manualForm.userBankName,
          bankName: manualForm.bankName,
          accountNumber: manualForm.accountNumber,
          aadhaarNumber: manualForm.aadhaarNumber,
          upiId: manualForm.upiId,
          ifsc: manualForm.ifsc,
          currentKycNote: manualForm.comment,
          updatedBy: updatedByPayload(),
        });
        if (!res.ok) {
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

  // ---- Verify UPI (inline) ----
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
        clientName: row.clientName,
      });
      if (!res.ok) {
        toast.error(res.message || 'UPI verification failed');
        return;
      }
      toast.success('UPI verified successfully');
    } finally {
      setVerifyingId(null);
    }
  }, []);

  const fieldCls =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const columns = useMemo<DataColumn<KycRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <SearchInput
            value={draftFilters.name}
            placeholder="Search name"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, name: v }))}
            onSearch={search}
          />
        ),
        render: (row) => <span className="font-medium">{display(row.name)}</span>,
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <SearchInput
            value={draftFilters.mobile}
            placeholder="Search mobile"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, mobile: v }))}
            onSearch={search}
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'aadhaar',
        label: 'Aadhar',
        filter: (
          <SearchInput
            value={draftFilters.aadhaarNumber}
            placeholder="Search aadhar"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, aadhaarNumber: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'account',
        label: 'Account',
        filter: (
          <SearchInput
            value={draftFilters.accountNumber}
            placeholder="Search account"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, accountNumber: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.accountNumber),
      },
      { id: 'ifsc', label: 'IFSC', render: (row) => display(row.ifsc) },
      {
        id: 'upi',
        label: 'UPI',
        render: (row) => (
          <div className="flex items-center gap-1.5">
            <span>{display(row.upiId)}</span>
            {row.upiId && (
              <Button
                variant="ghost"
                size="sm"
                disabled={verifyingId === row._id}
                onClick={() => void verifyUpi(row)}
                className="h-6 px-1.5 text-xs"
              >
                <ShieldQuestion className="h-3.5 w-3.5" />
                Verify
              </Button>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => (
          <span
            className={
              row.kyc
                ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500'
                : 'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
            }
          >
            {row.kyc ? 'Approved' : 'Pending'}
          </span>
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
        render: (row) =>
          display(row.kycRejectCheckBy?.name || row.kycManualCheckBy?.name),
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
        render: (row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => openApprove(row)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setRejectTarget(row)}>
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openManual(row)}>
              Manual
            </Button>
          </div>
        ),
      },
    ],
    [draftFilters, search, canShowMobile, page, pageSize, verifyingId, verifyUpi, openApprove, openManual],
  );

  if (!canViewKyc) {
    return (
      <ReportPage title="KYC">
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </ReportPage>
    );
  }

  return (
    <ReportPage
      title="KYC"
      loading={loading}
      error={error}
      onRefresh={() => void load(page)}
      toolbar={
        <>
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <SelectField
            label="App"
            value={appClientName}
            onChange={setAppClientName}
            options={CLIENT_NAMES.map((name) => ({ value: name, label: name }))}
            placeholder="All apps"
          />
          <PageSizeField
            value={pageSize}
            onChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
          <ApplyButton onClick={applyDates} loading={loading} />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, i) => row._id || i}
        loading={loading}
        emptyMessage="No KYC records found"
        minWidth={1500}
      />

      <ReportPager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} total={total} />

      <ReportDialog
        open={Boolean(approveTarget)}
        title={`Approve KYC${approveTarget?.name ? ` — ${approveTarget.name}` : ''}`}
        onClose={() => setApproveTarget(null)}
        onSubmit={submitApprove}
        loading={approveSubmitting}
        submitLabel="Approve"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Account Number
          <input
            className={fieldCls}
            value={approveForm.accountNumber}
            onChange={(e) =>
              setApproveForm((prev) => ({ ...prev, accountNumber: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          IFSC
          <input
            className={fieldCls}
            value={approveForm.ifsc}
            onChange={(e) => setApproveForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Aadhar Number
          <input
            className={fieldCls}
            value={approveForm.aadhaarNumber}
            onChange={(e) =>
              setApproveForm((prev) => ({ ...prev, aadhaarNumber: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          UPI ID
          <input
            className={fieldCls}
            value={approveForm.upiId}
            onChange={(e) => setApproveForm((prev) => ({ ...prev, upiId: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Comment
          <input
            className={fieldCls}
            value={approveForm.comment}
            onChange={(e) => setApproveForm((prev) => ({ ...prev, comment: e.target.value }))}
          />
        </label>
      </ReportDialog>

      <ReportDialog
        open={Boolean(rejectTarget)}
        title={`Reject KYC${rejectTarget?.name ? ` — ${rejectTarget.name}` : ''}`}
        onClose={() => setRejectTarget(null)}
        onSubmit={submitReject}
        loading={rejectSubmitting}
        submitLabel="Reject"
      >
        <textarea
          required
          autoFocus
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection"
          className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </ReportDialog>

      <ReportDialog
        open={Boolean(manualTarget)}
        title={`Manual KYC Update${manualTarget?.name ? ` — ${manualTarget.name}` : ''}`}
        onClose={() => setManualTarget(null)}
        onSubmit={submitManual}
        loading={manualSubmitting}
        submitLabel="Save"
        className="max-w-lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            User Bank Name
            <input
              required
              className={fieldCls}
              value={manualForm.userBankName}
              onChange={(e) =>
                setManualForm((prev) => ({ ...prev, userBankName: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Bank Name
            <input
              required
              className={fieldCls}
              value={manualForm.bankName}
              onChange={(e) => setManualForm((prev) => ({ ...prev, bankName: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Account No
            <input
              required
              className={fieldCls}
              value={manualForm.accountNumber}
              onChange={(e) =>
                setManualForm((prev) => ({ ...prev, accountNumber: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Aadhar No
            <input
              required
              className={fieldCls}
              value={manualForm.aadhaarNumber}
              onChange={(e) =>
                setManualForm((prev) => ({ ...prev, aadhaarNumber: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            UPI ID
            <input
              required
              className={fieldCls}
              value={manualForm.upiId}
              onChange={(e) => setManualForm((prev) => ({ ...prev, upiId: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            IFSC
            <input
              required
              className={fieldCls}
              value={manualForm.ifsc}
              onChange={(e) =>
                setManualForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))
              }
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Comment
          <input
            required
            className={fieldCls}
            value={manualForm.comment}
            onChange={(e) => setManualForm((prev) => ({ ...prev, comment: e.target.value }))}
          />
        </label>
      </ReportDialog>
    </ReportPage>
  );
}
