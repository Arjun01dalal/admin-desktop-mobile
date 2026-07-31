import { useCallback, useMemo, useState } from 'react';
import { getSessionUser, hasPermission } from '@/auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST, formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import {
  ReportPage,
  DataTable,
  type DataColumn,
  DateField,
  PageSizeField,
  SearchInput,
  ApplyButton,
  ReportPager,
  useReportQuery,
  asPaged,
  display,
  maskMobile,
} from './shared';

type NewDepositsRow = {
  _id: string;
  name?: string;
  mobile?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  previousCaller?: { name?: string };
  currentCaller?: { name?: string };
  deviceType?: string;
  subDomain?: string;
  balance?: number;
  createdOn?: string;
  updatedAt?: string;
  bonusWalletBalance?: number;
};

type Filters = { name: string; mobile: string };

const EMPTY_FILTERS: Filters = { name: '', mobile: '' };

/** New Deposits — ops.newDeposits. */
export function NewDepositsPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const canShowMobile = hasPermission('show_mobile');

  const accessibleStates = useMemo(() => {
    const user = getSessionUser();
    const raw = (user as { accessibleStates?: unknown })?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
  }, []);

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    return filter;
  }, [applied]);

  const { rows: rawRows, totalPages, total, loading, error, load } =
    useReportQuery<NewDepositsRow>({
      action: 'ops.newDeposits',
      buildPayload: () => ({
        itemsPerPage,
        pageNo: page,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        filter: buildFilter(),
      }),
      unpack: (res) => asPaged<NewDepositsRow>(res.data),
      autoDeps: [page, itemsPerPage, applied],
      errorMessage: 'Failed to load new deposits',
    });

  const rows = useMemo(() => {
    if (accessibleStates.length === 0) return rawRows;
    return rawRows.filter((row) =>
      accessibleStates.includes(String(row.state || '').toLowerCase()),
    );
  }, [rawRows, accessibleStates]);

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const applyDates = useCallback(() => {
    setPage(1);
    void load();
  }, [load]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const columns = useMemo<DataColumn<NewDepositsRow>[]>(
    () => [
      {
        id: 'index',
        label: 'Sr.No',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <SearchInput
            value={draft.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Search name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <SearchInput
            value={draft.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'userBankName', label: 'User Bank Name', render: (row) => display(row.userBankName) },
      { id: 'dpId', label: 'Dp ID', render: (row) => display(row._id) },
      { id: 'account', label: 'Account', render: (row) => display(row.accountNumber) },
      { id: 'aadhar', label: 'Aadhar', render: (row) => display(row.aadhaarNumber) },
      { id: 'email', label: 'Email', render: (row) => (canShowMobile ? display(row.email) : '**********') },
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'state', label: 'State', render: (row) => display(row.state) },
      {
        id: 'previousCaller',
        label: 'Previous Caller',
        render: (row) => display(row.previousCaller?.name),
      },
      {
        id: 'currentCaller',
        label: 'Current Caller',
        render: (row) => display(row.currentCaller?.name),
      },
      { id: 'device', label: 'Device', render: (row) => display(row.deviceType) },
      { id: 'platform', label: 'Platform', render: (row) => display(row.subDomain) },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'created',
        label: 'Created',
        render: (row) =>
          row.createdOn
            ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
            : '—',
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.updatedAt
            ? `${formatDisplayDate(row.updatedAt)} | ${formatDisplayTime(row.updatedAt)}`
            : '—',
      },
      {
        id: 'bonusBalance',
        label: 'Free Points Bonus',
        render: (row) => formatAmount(row.bonusWalletBalance ?? 0),
      },
    ],
    [page, itemsPerPage, draft, search, canShowMobile, setDraftField],
  );

  return (
    <ReportPage
      title="New Deposits"
      onRefresh={() => void load()}
      loading={loading}
      error={error}
      toolbar={
        <>
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <PageSizeField
            value={itemsPerPage}
            onChange={(value) => {
              setItemsPerPage(value);
              setPage(1);
            }}
          />
          <ApplyButton onClick={applyDates} loading={loading} />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No new deposits found"
        minWidth={1900}
      />
      <ReportPager
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        disabled={loading}
        total={total}
      />
    </ReportPage>
  );
}
