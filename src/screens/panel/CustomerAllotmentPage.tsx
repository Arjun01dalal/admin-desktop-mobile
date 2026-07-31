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
import { toast } from 'react-toastify';
import { Ban, FileBarChart, ShieldCheck, Users } from 'lucide-react';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { Button } from '@/components/ui/button';
import {
  ReportPage,
  DataTable,
  DateField,
  PageSizeField,
  SearchInput,
  ReportPager,
  ReportDialog,
  display,
  maskMobile,
  type DataColumn,
} from '@/screens/panel/shared';

type DepositStat = { count?: number; totalAmount?: number };

type SupportDepositEntry = Record<
  string,
  { depositData?: DepositStat[]; coinData?: DepositStat[] } | undefined
>;

type AllotmentRow = {
  _id: string;
  name?: string;
  mobile?: string;
  city?: string;
  email?: string;
  empCode?: string;
  allotedCustomer?: unknown[];
  block?: boolean;
  Role_ID?: string;
  blockReason?: string;
  depositData?: DepositStat[];
  coinData?: DepositStat[];
  [key: string]: unknown;
};

type Filters = {
  name: string;
  mobile: string;
  empCode: string;
};

const EMPTY_FILTERS: Filters = { name: '', mobile: '', empCode: '' };

type CallerReportData = {
  handleCustomer?: number;
  feedBackCompleted?: number;
  handleCall?: number;
  incomingMissedCall?: number;
  outgoingMissedCall?: number;
  spentCallTime?: number;
  depositData?: {
    depositData?: DepositStat[];
    coinData?: DepositStat[];
  };
};

function depositLabel(stat?: DepositStat[]): string {
  const first = stat?.[0];
  if (!first) return '(0) : 0';
  return `(${first.count ?? 0}) : ${formatAmount(first.totalAmount ?? 0)}`;
}

export function CustomerAllotmentPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [customers, setCustomers] = useState<AllotmentRow[]>([]);
  const [depositMap, setDepositMap] = useState<SupportDepositEntry>({});
  const [depositLoading, setDepositLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const loadCustomers = useCallback(
    async (pageNo = page, filtersOverride?: Filters) => {
      const active = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filter: Record<string, string> = {};
        if (active.name) filter.name = active.name;
        if (active.mobile) filter.mobile = active.mobile;
        if (active.empCode) filter.empCode = active.empCode;

        const res = await secureApi('ops.customerSupportGetAll', {
          filter,
          itemPerPage: pageSize,
          pageNo,
        });
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load customer allotment';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setCustomers([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.items) ? (data.items as AllotmentRow[]) : [];
        startTransition(() => {
          setCustomers(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setTotal(Number(data.total) || items.length);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, appliedFilters, next, begin, end, isCurrent],
  );

  const loadDeposits = useCallback(async (pageNo = page) => {
    setDepositLoading(true);
    try {
      const res = await secureApi('ops.customerSupportDeposit', {
        itemPerPage: pageSize,
        pageNo,
      });
      if (!res.ok) return;
      const list = Array.isArray(res.data) ? (res.data as SupportDepositEntry[]) : [];
      const merged: SupportDepositEntry = {};
      for (const entry of list) {
        if (entry && typeof entry === 'object') {
          Object.assign(merged, entry);
        }
      }
      setDepositMap(merged);
    } finally {
      setDepositLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => {
    void loadCustomers(page);
    void loadDeposits(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const rows = useMemo<AllotmentRow[]>(
    () =>
      customers.map((c) => {
        const stat = depositMap[c._id];
        return stat ? { ...c, depositData: stat.depositData, coinData: stat.coinData } : c;
      }),
    [customers, depositMap],
  );
  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void loadCustomers(1, draftFilters);
  }, [draftFilters, loadCustomers]);

  const openAllotted = useCallback(
    (row: AllotmentRow) => {
      navigate('/customer-allotted', {
        state: {
          customer: row.allotedCustomer || [],
          callerId: row._id,
          callerName: row.name,
          empCode: row.empCode,
        },
      });
    },
    [navigate],
  );

  // ---- Block / Unblock dialog ----
  const [blockTarget, setBlockTarget] = useState<AllotmentRow | null>(null);
  const [blockRemark, setBlockRemark] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const submitBlock = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!blockTarget?._id || !blockRemark.trim()) {
        toast.error('Please enter a remark');
        return;
      }
      setBlockSubmitting(true);
      try {
        const res = await secureApi('ops.blockCaller', {
          _id: blockTarget._id,
          Role_ID: blockTarget.Role_ID,
          status: !blockTarget.block,
          blockReason: blockRemark.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update block status');
          return;
        }
        toast.success(blockTarget.block ? 'Caller unblocked' : 'Caller blocked');
        setBlockTarget(null);
        setBlockRemark('');
        void loadCustomers(page);
      } finally {
        setBlockSubmitting(false);
      }
    },
    [blockTarget, blockRemark, loadCustomers, page],
  );

  // ---- Caller report dialog ----
  const [reportTarget, setReportTarget] = useState<AllotmentRow | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<CallerReportData | null>(null);

  const runCallerReport = useCallback(
    async (mode: 'today' | 'range' | 'all') => {
      if (!reportTarget?._id) return;
      setReportLoading(true);
      setReportData(null);
      try {
        const payload =
          mode === 'range'
            ? {
                _id: reportTarget._id,
                startDate: reportStartDate,
                endDate: reportEndDate,
                todayData: false,
                allData: false,
              }
            : mode === 'all'
              ? {
                  _id: reportTarget._id,
                  startDate: '',
                  endDate: '',
                  todayData: false,
                  allData: true,
                }
              : {
                  _id: reportTarget._id,
                  startDate: '',
                  endDate: '',
                  todayData: true,
                  allData: false,
                };

        const res = await secureApi<CallerReportData>('ops.callerReport', payload);
        if (!res.ok) {
          toast.error(res.message || 'Failed to load caller report');
          return;
        }
        setReportData(res.data || {});
      } finally {
        setReportLoading(false);
      }
    },
    [reportTarget, reportStartDate, reportEndDate],
  );

  const openCallerReport = useCallback((row: AllotmentRow) => {
    setReportTarget(row);
    setReportStartDate('');
    setReportEndDate('');
    setReportData(null);
  }, []);

  useEffect(() => {
    if (reportTarget) void runCallerReport('today');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportTarget?._id]);

  const columns = useMemo<DataColumn<AllotmentRow>[]>(
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
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'empCode',
        label: 'Emp Code',
        filter: (
          <SearchInput
            value={draftFilters.empCode}
            placeholder="Search emp code"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, empCode: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.empCode),
      },
      {
        id: 'autoDeposit',
        label: 'Todays Automatic Deposit',
        render: (row) =>
          depositLoading ? '…' : depositLabel(row.depositData),
      },
      {
        id: 'coinDeposit',
        label: 'Todays Coin Deposit',
        render: (row) => (depositLoading ? '…' : depositLabel(row.coinData)),
      },
      {
        id: 'alloted',
        label: 'Allotted Customer',
        render: (row) => (
          <button
            type="button"
            onClick={() => openAllotted(row)}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <Users className="h-3.5 w-3.5" />
            {row.allotedCustomer?.length ?? 0}
          </button>
        ),
      },
      {
        id: 'block',
        label: 'Action',
        render: (row) => (
          <Button
            variant={row.block ? 'outline' : 'destructive'}
            size="sm"
            onClick={() => {
              setBlockTarget(row);
              setBlockRemark('');
            }}
          >
            <Ban className="h-3.5 w-3.5" />
            {row.block ? 'Unblock' : 'Block'}
          </Button>
        ),
      },
      {
        id: 'callerReport',
        label: 'Caller Report',
        render: (row) => (
          <Button variant="outline" size="sm" onClick={() => openCallerReport(row)}>
            <FileBarChart className="h-3.5 w-3.5" />
            Report
          </Button>
        ),
      },
      {
        id: 'blockReason',
        label: 'Block Reason',
        render: (row) => display(row.blockReason),
      },
    ],
    [draftFilters, search, canShowMobile, page, pageSize, depositLoading, openAllotted, openCallerReport],
  );

  return (
    <ReportPage
      title="Customer Allotment"
      loading={loading}
      error={error}
      onRefresh={() => {
        void loadCustomers(page);
        void loadDeposits(page);
      }}
      toolbar={
        <PageSizeField
          value={pageSize}
          onChange={(v) => {
            setPageSize(v);
            setPage(1);
          }}
        />
      }
    >
      <DataTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, i) => row._id || i}
        loading={loading}
        emptyMessage="No callers found"
        minWidth={1400}
      />

      <ReportPager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} total={total} />

      <ReportDialog
        open={Boolean(blockTarget)}
        title={blockTarget?.block ? 'Unblock Caller' : 'Block Caller'}
        onClose={() => setBlockTarget(null)}
        onSubmit={submitBlock}
        loading={blockSubmitting}
        submitLabel={blockTarget?.block ? 'Unblock' : 'Block'}
      >
        <textarea
          required
          autoFocus
          rows={3}
          value={blockRemark}
          onChange={(e) => setBlockRemark(e.target.value)}
          placeholder="Please enter remark"
          className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </ReportDialog>

      <ReportDialog
        open={Boolean(reportTarget)}
        title={`Caller Report${reportTarget?.name ? ` — ${reportTarget.name}` : ''}`}
        onClose={() => setReportTarget(null)}
        className="max-w-lg"
      >
        <div className="flex flex-wrap items-end gap-2">
          <DateField label="From Date" value={reportStartDate} onChange={setReportStartDate} />
          <DateField label="To Date" value={reportEndDate} onChange={setReportEndDate} />
          <Button
            size="sm"
            disabled={!reportStartDate || !reportEndDate}
            onClick={() => void runCallerReport('range')}
          >
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => void runCallerReport('today')}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => void runCallerReport('all')}>
            All Data
          </Button>
        </div>

        {reportLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : reportData ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <p>
                <span className="font-semibold">Automatic deposit:</span>{' '}
                {depositLabel(reportData.depositData?.depositData)}
              </p>
              <p>
                <span className="font-semibold">Scanner deposit:</span>{' '}
                {depositLabel(reportData.depositData?.coinData)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Handle Customer', reportData.handleCustomer],
                ['Feedback Completed', reportData.feedBackCompleted],
                ['Handle Call', reportData.handleCall],
                ['Incoming Missed', reportData.incomingMissedCall],
                ['Outgoing Missed', reportData.outgoingMissedCall],
                [
                  'Spent Call Time',
                  `${((reportData.spentCallTime || 0) / 60).toFixed(2)} min`,
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md border border-border p-2 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {value ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </ReportDialog>
    </ReportPage>
  );
}
