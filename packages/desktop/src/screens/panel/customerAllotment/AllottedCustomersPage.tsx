import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { formatDisplayDate, formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { appCodeForName } from '@/constants/clientNames';
import { TablePanel } from '@/components/TablePanel';
import {
  ReportPage,
  DataTable,
  PageSizeField,
  SearchInput,
  ReportPager,
  display,
  maskMobile,
  type DataColumn,
} from '@/screens/panel/shared';

type AllottedCustomerRow = {
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

type LocationState = {
  customer?: unknown[];
  callerId?: string;
  callerName?: string;
  empCode?: string;
};

export function AllottedCustomersPage() {
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const customerIds = useMemo(() => state.customer || [], [state.customer]);

  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [searchName, setSearchName] = useState('');
  const [appliedName, setAppliedName] = useState('');

  const [rows, setRows] = useState<AllottedCustomerRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, nameOverride = appliedName) => {
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filter: Record<string, unknown> = {
          _id: customerIds
            .map((item) => {
              if (item == null) return null;
              if (typeof item === 'string' || typeof item === 'number') return String(item);
              if (typeof item === 'object' && item !== null && '_id' in (item as object)) {
                const id = (item as { _id?: unknown })._id;
                return id == null ? null : String(id);
              }
              return null;
            })
            .filter((id): id is string => Boolean(id)),
        };
        if (nameOverride) filter.name = nameOverride;

        const res = await secureApi('ops.myCustomersGetAll', {
          filter,
          pageNo,
          itemPerPage: pageSize,
        });
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load allotted customers';
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
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items = rawItems.filter(
          (row): row is AllottedCustomerRow =>
            Boolean(row && typeof row === 'object' && (row as AllottedCustomerRow)._id != null),
        );
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setTotal(Number(data.total) || items.length);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, appliedName, customerIds, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedName(searchName);
    setPage(1);
    void load(1, searchName);
  }, [searchName, load]);

  const columns = useMemo<DataColumn<AllottedCustomerRow>[]>(
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
            value={searchName}
            placeholder="Search name"
            onChange={setSearchName}
            onSearch={search}
          />
        ),
        render: (row) => <span className="font-medium">{display(row.name)}</span>,
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'clientName', label: 'App Code', render: (row) => appCodeForName(row.clientName) },
      { id: 'accountNumber', label: 'Account', render: (row) => display(row.accountNumber) },
      { id: 'aadhaarNumber', label: 'Aadhar', render: (row) => display(row.aadhaarNumber) },
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'state', label: 'State', render: (row) => display(row.state) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      { id: 'referral', label: 'Referral', render: (row) => display(row.referralCodeUser) },
      { id: 'device', label: 'Device', render: (row) => display(row.deviceType) },
      { id: 'balance', label: 'Balance', render: (row) => formatAmount(row.balance ?? 0) },
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
    ],
    [page, pageSize, searchName, search, canShowMobile],
  );

  return (
    <ReportPage
      title={`Allotted Customers${state.callerName ? ` — ${state.callerName}` : ''}`}
      description={state.empCode ? `Emp Code: ${state.empCode}` : undefined}
      loading={loading}
      error={error}
      onRefresh={() => void load(page)}
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
      <TablePanel
        footer={
          <ReportPager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} total={total} />
        }
      >
        <DataTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No allotted customers found"
          minWidth={1500}
          maxHeight="100%"
        />
      </TablePanel>
    </ReportPage>
  );
}
