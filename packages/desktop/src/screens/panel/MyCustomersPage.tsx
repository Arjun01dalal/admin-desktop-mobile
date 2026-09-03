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
import { MessageSquarePlus, Wallet } from 'lucide-react';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { getSessionUser, hasPermission } from '@/auth/permissions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST, formatDisplayDate, formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { Button } from '@/components/ui/button';
import { TablePanel } from '@/components/TablePanel';
import { appCodeForName } from '@/constants/clientNames';
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
  CLIENT_NAME_OPTIONS,
  display,
  maskMobile,
  type DataColumn,
} from '@/screens/panel/shared';

type CustomerType =
  | 'All'
  | 'Todays_Active'
  | '7 Days Active'
  | 'First_Deposit'
  | 'InActive'
  | 'In_Active_Deposit'
  | 'Non_Performing_User';

const CUSTOMER_TYPE_OPTIONS: Array<{ value: CustomerType; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Todays_Active', label: "Today's Active" },
  { value: '7 Days Active', label: '7 Days Active' },
  { value: 'First_Deposit', label: 'First Deposit' },
  { value: 'InActive', label: 'InActive' },
  { value: 'In_Active_Deposit', label: 'In Active Deposit' },
  { value: 'Non_Performing_User', label: 'Non Performing User' },
];

/** Types whose backend actions return real pagination metadata. */
const PAGINATED_TYPES = new Set<CustomerType>([
  'All',
  'Non_Performing_User',
  'In_Active_Deposit',
  'Todays_Active',
]);

type CustomerRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  city?: string;
  state?: string;
  email?: string;
  referralCodeUser?: string;
  deviceType?: string;
  balance?: number | string;
  createdOn?: string;
  activeUser?: string;
  bonusWalletBalance?: number | string;
  [key: string]: unknown;
};

type ColumnFilters = {
  name: string;
  mobile: string;
  accountNumber: string;
  aadhaarNumber: string;
  city: string;
  state: string;
  referralCodeUser: string;
};

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  mobile: '',
  accountNumber: '',
  aadhaarNumber: '',
  city: '',
  state: '',
  referralCodeUser: '',
};

function actionForType(type: CustomerType): SecureAction {
  switch (type) {
    case 'Non_Performing_User':
      return 'ops.myCustomersNonPerforming';
    case 'In_Active_Deposit':
      return 'ops.myCustomersInactiveDeposit';
    case 'InActive':
    case '7 Days Active':
      return 'ops.myCustomersCallerActiveInactive';
    case 'First_Deposit':
      return 'ops.myCustomersCallerDepositFirst';
    case 'Todays_Active':
      return 'ops.myCustomersCallerActiveToday';
    case 'All':
    default:
      return 'ops.myCustomersGetAll';
  }
}

function buildFilter(filters: ColumnFilters, appClientName: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (filters.name) filter.name = filters.name;
  if (filters.mobile) filter.mobile = filters.mobile;
  if (filters.accountNumber) filter.accountNumber = filters.accountNumber;
  if (filters.aadhaarNumber) filter.aadhaarNumber = filters.aadhaarNumber;
  if (filters.city) filter.city = filters.city;
  if (filters.state) filter.state = filters.state;
  if (filters.referralCodeUser) filter.referralCodeUser = filters.referralCodeUser;
  if (appClientName) filter.clientName = appClientName;
  return filter;
}

function buildPayload(
  type: CustomerType,
  page: number,
  pageSize: number,
  startDate: string,
  endDate: string,
  filters: ColumnFilters,
  appClientName: string,
): Record<string, unknown> {
  const filter = buildFilter(filters, appClientName);
  const user = getSessionUser();
  const dateRange = startDate && endDate ? { startDate, endDate } : {};

  switch (type) {
    case 'Non_Performing_User':
      return { filter, pageNo: page, itemPerPage: pageSize, _id: user?._id, ...dateRange };
    case 'In_Active_Deposit':
      return { filter, pageNo: page, itemsPerPage: pageSize, _id: user?._id, ...dateRange };
    case 'InActive':
    case '7 Days Active':
      return { filter, type, ...dateRange };
    case 'First_Deposit':
      return {
        filter,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      };
    case 'Todays_Active':
      return {
        filter,
        pageNo: page,
        itemsPerPage: pageSize,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      };
    case 'All':
    default:
      return { filter, pageNo: page, itemPerPage: pageSize, ...dateRange };
  }
}

function unwrapResponse(
  type: CustomerType,
  data: unknown,
): { rows: CustomerRow[]; totalPages: number; total: number } {
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  if (type === 'InActive') {
    const rows = Array.isArray(obj.inactive) ? (obj.inactive as CustomerRow[]) : [];
    return { rows, totalPages: 1, total: rows.length };
  }
  if (type === '7 Days Active') {
    const rows = Array.isArray(obj.active) ? (obj.active as CustomerRow[]) : [];
    return { rows, totalPages: 1, total: rows.length };
  }
  if (type === 'First_Deposit') {
    const rows = Array.isArray(data) ? (data as CustomerRow[]) : [];
    return { rows, totalPages: 1, total: rows.length };
  }
  if (type === 'Todays_Active') {
    const rows = Array.isArray(obj.user) ? (obj.user as CustomerRow[]) : [];
    return {
      rows,
      totalPages: Math.max(1, Number(obj.totalPages) || 1),
      total: Number(obj.total) || rows.length,
    };
  }

  const rows = Array.isArray(obj.items) ? (obj.items as CustomerRow[]) : [];
  return {
    rows,
    totalPages: Math.max(1, Number(obj.totalPages) || 1),
    total: Number(obj.total) || rows.length,
  };
}

export function MyCustomersPage() {
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [customerType, setCustomerType] = useState<CustomerType>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);

  const [draftFilters, setDraftFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ColumnFilters>(EMPTY_FILTERS);

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, filtersOverride?: ColumnFilters) => {
      const activeFilters = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const action = actionForType(customerType);
        const payload = buildPayload(
          customerType,
          pageNo,
          pageSize,
          startDate,
          endDate,
          activeFilters,
          appClientName,
        );
        const res = await secureApi(action, payload);
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load customers';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const parsed = unwrapResponse(customerType, res.data);
        startTransition(() => {
          setRows(parsed.rows);
          setTotal(parsed.total);
          setTotalPages(parsed.totalPages);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      customerType,
      page,
      pageSize,
      startDate,
      endDate,
      appClientName,
      appliedFilters,
      next,
      begin,
      end,
      isCurrent,
    ],
  );

  useEffect(() => {
    setPage(1);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }, [customerType]);

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, customerType, pageSize, appClientName]);

  const deferredRows = useDeferredValue(rows);
  const paginated = PAGINATED_TYPES.has(customerType);

  const applyDates = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  // ---- Add Comment dialog ----
  const [commentTarget, setCommentTarget] = useState<CustomerRow | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const submitComment = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!commentTarget?._id || !commentText.trim()) return;
      const user = getSessionUser();
      setCommentSubmitting(true);
      try {
        const res = await secureApi('ops.myCustomersAddComment', {
          _id: user?._id,
          userId: commentTarget._id,
          comment: commentText.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add comment');
          return;
        }
        toast.success('Comment added');
        setCommentTarget(null);
        setCommentText('');
      } finally {
        setCommentSubmitting(false);
      }
    },
    [commentTarget, commentText],
  );

  // ---- Deposit summary dialog ----
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);

  const openDepositSummary = useCallback(async () => {
    setDepositOpen(true);
    setDepositLoading(true);
    setDepositAmount(null);
    try {
      const user = getSessionUser();
      const payload: Record<string, unknown> = { userId: user?._id };
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const res = await secureApi<{ customerDepositAmt?: number }>(
        'ops.myCustomersDeposit',
        payload,
      );
      if (!res.ok) {
        toast.error(res.message || 'Failed to load deposit summary');
        return;
      }
      setDepositAmount(Number(res.data?.customerDepositAmt) || 0);
    } finally {
      setDepositLoading(false);
    }
  }, [startDate, endDate]);

  const columns = useMemo<DataColumn<CustomerRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (paginated ? (page - 1) * pageSize + index + 1 : index + 1),
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
        id: 'clientName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'accountNumber',
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
      {
        id: 'aadhaarNumber',
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
        id: 'city',
        label: 'City',
        filter: (
          <SearchInput
            value={draftFilters.city}
            placeholder="Search city"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, city: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <SearchInput
            value={draftFilters.state}
            placeholder="Search state"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, state: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'email',
        label: 'Email',
        render: (row) => display(row.email),
      },
      {
        id: 'referral',
        label: 'Referral',
        filter: (
          <SearchInput
            value={draftFilters.referralCodeUser}
            placeholder="Search referral"
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, referralCodeUser: v }))}
            onSearch={search}
          />
        ),
        render: (row) => display(row.referralCodeUser),
      },
      {
        id: 'device',
        label: 'Device',
        render: (row) => display(row.deviceType),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'createdOn',
        label: 'Created On',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) => (row.activeUser ? formatDisplayDate(row.activeUser) : '—'),
      },
      {
        id: 'bonusBalance',
        label: 'Free Points Bonus',
        render: (row) => formatAmount(row.bonusWalletBalance ?? 0),
      },
      {
        id: 'actions',
        label: 'Actions',
        render: (row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCommentTarget(row);
              setCommentText('');
            }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Comment
          </Button>
        ),
      },
    ],
    [draftFilters, search, canShowMobile, page, pageSize, paginated],
  );

  return (
    <ReportPage
      title="My Customers"
      loading={loading}
      error={error}
      onRefresh={() => void load(page)}
      toolbar={
        <>
          <SelectField
            label="Customer Type"
            value={customerType}
            onChange={(v) => setCustomerType(v as CustomerType)}
            options={CUSTOMER_TYPE_OPTIONS}
          />
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <SelectField
            label="App"
            value={appClientName}
            onChange={setAppClientName}
            options={[...CLIENT_NAME_OPTIONS]}
            placeholder="All apps"
          />
          {paginated && <PageSizeField value={pageSize} onChange={setPageSize} />}
          <ApplyButton onClick={applyDates} loading={loading} />
          <Button variant="secondary" onClick={() => void openDepositSummary()}>
            <Wallet className="h-4 w-4" />
            Deposit Summary
          </Button>
        </>
      }
    >
      <TablePanel
        footer={
          paginated ? (
            <ReportPager
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              disabled={loading}
              total={total}
            />
          ) : undefined
        }
      >
        <DataTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No customers found"
          minWidth={1600}
          maxHeight="100%"
        />
      </TablePanel>

      <ReportDialog
        open={Boolean(commentTarget)}
        title={`Add Comment${commentTarget?.name ? ` — ${commentTarget.name}` : ''}`}
        onClose={() => setCommentTarget(null)}
        onSubmit={submitComment}
        loading={commentSubmitting}
      >
        <textarea
          required
          autoFocus
          rows={4}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Enter comment"
          className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </ReportDialog>

      <ReportDialog
        open={depositOpen}
        title="Deposit Summary"
        onClose={() => setDepositOpen(false)}
      >
        {depositLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <p className="text-lg font-semibold text-foreground">
            Total Deposit: {depositAmount ?? 0}
          </p>
        )}
      </ReportDialog>
    </ReportPage>
  );
}
