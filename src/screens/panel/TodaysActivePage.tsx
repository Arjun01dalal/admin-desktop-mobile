import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '@/api/secureClient';
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
  display,
  maskMobile,
  CLIENT_NAME_OPTIONS,
} from './shared';

type TodaysActiveRow = {
  _id: string;
  name?: string;
  clientName?: string;
  played?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  mobile?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  balance?: number;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  activeUser?: string;
  createdOn?: string;
};

type Filters = {
  name: string;
  dpId: string;
  mobile: string;
  accountNumber: string;
  aadhaarNumber: string;
  email: string;
  city: string;
  state: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  mobile: '',
  accountNumber: '',
  aadhaarNumber: '',
  email: '',
  city: '',
  state: '',
};

const PLAY_IN_OPTIONS = [
  { value: 'E', label: 'E' },
  { value: 'C', label: 'C' },
  { value: 'S', label: 'S' },
];

/** Todays Active users — ops.activeCustomers. */
export function TodaysActivePage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [playedIn, setPlayedIn] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const list = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, string> = {};
      for (const item of list) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.dpId.trim()) filter._id = applied.dpId.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    if (applied.accountNumber.trim()) filter.accountNumber = applied.accountNumber.trim();
    if (applied.aadhaarNumber.trim()) filter.aadhaarNumber = applied.aadhaarNumber.trim();
    if (applied.email.trim()) filter.email = applied.email.trim();
    if (applied.city.trim()) filter.city = applied.city.trim();
    if (applied.state.trim()) filter.state = applied.state.trim();
    if (clientName) filter.clientName = clientName;
    if (playedIn) filter.played = playedIn;
    return filter;
  }, [applied, clientName, playedIn]);

  const { rows, totalPages, total, loading, error, load } =
    useReportQuery<TodaysActiveRow>({
      action: 'ops.activeCustomers',
      buildPayload: () => ({
        itemsPerPage,
        pageNo: page,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter: buildFilter(),
      }),
      unpack: (res) => {
        const raw = res.data as
          | { user?: TodaysActiveRow[]; totalPages?: number; count?: number }
          | undefined;
        return {
          rows: Array.isArray(raw?.user) ? raw.user : [],
          totalPages: Math.max(1, Number(raw?.totalPages ?? 1) || 1),
          total: Number(raw?.count ?? 0) || 0,
        };
      },
      autoDeps: [page, itemsPerPage, applied, clientName, playedIn],
      errorMessage: 'Failed to load todays active users',
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

  const columns = useMemo<DataColumn<TodaysActiveRow>[]>(() => {
    const cols: DataColumn<TodaysActiveRow>[] = [
      {
        id: 'index',
        label: '#',
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
        id: 'dpId',
        label: 'Dp Id',
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
    ];

    if (!hideContact) {
      cols.push({
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
      });
    }

    cols.push(
      {
        id: 'appName',
        label: 'App Code',
        filter: (
          <SelectField
            value={clientName}
            onChange={(value) => {
              setClientName(value);
              setPage(1);
            }}
            options={CLIENT_NAME_OPTIONS}
            placeholder="All"
          />
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'playIn',
        label: 'In',
        filter: (
          <SelectField
            value={playedIn}
            onChange={(value) => {
              setPlayedIn(value);
              setPage(1);
            }}
            options={PLAY_IN_OPTIONS}
            placeholder="All"
          />
        ),
        render: (row) => display(row.played),
      },
      {
        id: 'account',
        label: 'Account',
        filter: (
          <SearchInput
            value={draft.accountNumber}
            onChange={setDraftField('accountNumber')}
            onSearch={search}
            placeholder="Search account"
          />
        ),
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'aadhar',
        label: 'Aadhar',
        filter: (
          <SearchInput
            value={draft.aadhaarNumber}
            onChange={setDraftField('aadhaarNumber')}
            onSearch={search}
            placeholder="Search aadhar"
          />
        ),
        render: (row) => display(row.aadhaarNumber),
      },
    );

    if (!hideContact) {
      cols.push({
        id: 'email',
        label: 'Email',
        filter: (
          <SearchInput
            value={draft.email}
            onChange={setDraftField('email')}
            onSearch={search}
            placeholder="Search email"
          />
        ),
        render: (row) => (canShowMobile ? display(row.email) : '**********'),
      });
    }

    cols.push(
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
      { id: 'device', label: 'Device', render: (row) => display(row.deviceType) },
      { id: 'balance', label: 'Balance', render: (row) => formatAmount(row.balance ?? 0) },
      {
        id: 'playerAppVersion',
        label: 'User App Version',
        render: (row) => display(row.currentAppVersion),
      },
      {
        id: 'appVersion',
        label: 'App Version',
        render: (row) => display(appVersions[row.clientName || '']),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.activeUser
            ? `${formatDisplayDate(row.activeUser)} | ${formatDisplayTime(row.activeUser)}`
            : '—',
      },
      { id: 'date', label: 'Date', render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—') },
      { id: 'time', label: 'Time', render: (row) => (row.createdOn ? formatDisplayTime(row.createdOn) : '—') },
    );

    return cols;
  }, [
    page,
    itemsPerPage,
    draft,
    search,
    canShowMobile,
    hideContact,
    clientName,
    playedIn,
    appVersions,
    setDraftField,
  ]);

  return (
    <ReportPage
      title="Todays Active"
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
        emptyMessage="No active users found"
        minWidth={1800}
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
