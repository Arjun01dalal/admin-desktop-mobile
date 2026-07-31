import { useCallback, useMemo, useState } from 'react';
import { hasPermission } from '@/auth/permissions';
import { formatDisplayDate, formatDisplayTime, formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { appCodeForName } from '@/constants/clientNames';
import {
  ReportPage,
  DataTable,
  type DataColumn,
  DateField,
  PageSizeField,
  SelectField,
  SearchInput,
  ApplyButton,
  ReportPager,
  useReportQuery,
  asPaged,
  display,
  maskMobile,
  CLIENT_NAME_OPTIONS,
} from './shared';

type NonPerformingUserRow = {
  _id: string;
  name?: string;
  clientName?: string;
  email?: string;
  mobile?: string;
  balance?: number;
  totalAmount?: number;
  state?: string;
  city?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  createdOn?: string;
  updatedOn?: string;
};

type Filters = {
  name: string;
  dpId: string;
  mobile: string;
  balance: string;
  state: string;
  city: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  mobile: '',
  balance: '',
  state: '',
  city: '',
};

/** Non Performing User list — ops.nonPerformingUser (also available as dashboard.nonPerformingUser). */
export function NonPerformingUserPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const canShowMobile = hasPermission('show_mobile');

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.dpId.trim()) filter._id = applied.dpId.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    if (applied.balance.trim() && !Number.isNaN(Number(applied.balance))) {
      filter.balance = Number(applied.balance);
    }
    if (applied.state.trim()) filter.state = applied.state.trim();
    if (applied.city.trim()) filter.city = applied.city.trim();
    if (clientName) filter.clientName = clientName;
    return filter;
  }, [applied, clientName]);

  const { rows, totalPages, total, loading, error, load } =
    useReportQuery<NonPerformingUserRow>({
      action: 'ops.nonPerformingUser',
      buildPayload: () => ({
        pageNo: page,
        itemsPerPage,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter: buildFilter(),
      }),
      unpack: (res) => asPaged<NonPerformingUserRow>(res.data),
      autoDeps: [page, itemsPerPage, applied, clientName],
      errorMessage: 'Failed to load non performing users',
    });

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

  const columns = useMemo<DataColumn<NonPerformingUserRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'User Name',
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
        id: 'dpId',
        label: 'Dp ID',
        filter: (
          <SearchInput
            value={draft.dpId}
            onChange={setDraftField('dpId')}
            onSearch={search}
            placeholder="Search Dp Id"
          />
        ),
        render: (row) => display(row._id),
      },
      { id: 'appName', label: 'App Code', render: (row) => appCodeForName(row.clientName) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
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
      {
        id: 'balance',
        label: 'Balance',
        filter: (
          <SearchInput
            value={draft.balance}
            onChange={setDraftField('balance')}
            onSearch={search}
            placeholder="Search balance"
          />
        ),
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'deposit',
        label: 'Deposit Amount',
        render: (row) => formatAmount(row.totalAmount ?? 0),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <SearchInput
            value={draft.state}
            onChange={setDraftField('state')}
            onSearch={search}
            placeholder="Search state"
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: (
          <SearchInput
            value={draft.city}
            onChange={setDraftField('city')}
            onSearch={search}
            placeholder="Search city"
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'appVersion',
        label: 'Current / Updated App Version',
        render: (row) =>
          `${display(row.currentAppVersion)} / ${display(row.updatedAppVersion)}`,
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
          row.updatedOn
            ? `${formatDisplayDate(row.updatedOn)} ${formatDisplayTime(row.updatedOn)}`
            : '—',
      },
    ],
    [page, itemsPerPage, draft, search, canShowMobile, setDraftField],
  );

  return (
    <ReportPage
      title="Non Performing User"
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
          <SelectField
            label="App Client"
            value={clientName}
            onChange={(value) => {
              setClientName(value);
              setPage(1);
            }}
            options={CLIENT_NAME_OPTIONS}
            placeholder="All"
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
        emptyMessage="No non performing users found"
        minWidth={1500}
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
