import { useCallback, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { formatAmount, formatDisplayDate } from '@/utils/dates';
import {
  ReportPage,
  DataTable,
  PageSizeField,
  SearchInput,
  ReportPager,
  useReportQuery,
  asPaged,
  maskMobile,
  display,
  type DataColumn,
} from '@/screens/panel/shared';

type DumpUserRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  balance?: number | string;
  empCode?: string;
  totalDeposit?: number | string;
  city?: string;
  state?: string;
  email?: string;
  dumpReason?: {
    reason?: string;
    name?: string;
    Date?: string;
  };
  [key: string]: unknown;
};

type Filters = { name: string; dpId: string; mobile: string };
const EMPTY_FILTERS: Filters = { name: '', dpId: '', mobile: '' };

export function DumpUsersPage() {
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [undumpingId, setUndumpingId] = useState('');

  const canShowMobile = hasPermission('show_mobile');

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = { dump: true };
    if (appliedFilters.name) filter.name = appliedFilters.name;
    if (appliedFilters.mobile) filter.mobile = appliedFilters.mobile;
    if (appliedFilters.dpId) filter._id = appliedFilters.dpId;
    return { itemsPerPage, pageNo: page, filter };
  }, [page, itemsPerPage, appliedFilters]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<DumpUserRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<DumpUserRow>({
    action: 'users.getAll',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage],
    errorMessage: 'Failed to load dump users',
  });

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load();
  }, [draftFilters, load]);

  const handleUndump = useCallback(
    async (row: DumpUserRow) => {
      setUndumpingId(row._id);
      try {
        const res = await secureApi('ops.dumpUsersUpdate', { _id: row._id, dump: false });
        if (!res.ok) {
          toast.error(res.message || 'Failed to un-dump user');
          return;
        }
        toast.success('User un-dumped');
        void load();
      } finally {
        setUndumpingId('');
      }
    },
    [load],
  );

  const columns = useMemo<DataColumn<DumpUserRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <SearchInput
            value={draftFilters.name}
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, name: v }))}
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
            value={draftFilters.dpId}
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, dpId: v }))}
            onSearch={search}
            placeholder="Search dp id"
          />
        ),
        render: (row) => row._id || '—',
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <SearchInput
            value={draftFilters.mobile}
            onChange={(v) => setDraftFilters((prev) => ({ ...prev, mobile: v }))}
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'balance', label: 'Balance', render: (row) => formatAmount(row.balance) },
      { id: 'empCode', label: 'Emp Code', render: (row) => display(row.empCode) },
      {
        id: 'totalDeposit',
        label: 'Total Deposit',
        render: (row) => formatAmount(row.totalDeposit),
      },
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'state', label: 'State', render: (row) => display(row.state) },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'dumpReason',
        label: 'Dump Reason',
        render: (row) => display(row.dumpReason?.reason),
      },
      {
        id: 'updatedBy',
        label: 'Update By',
        render: (row) => (
          <div>
            <div>{display(row.dumpReason?.name)}</div>
            <div className="text-xs text-muted-foreground">
              {row.dumpReason?.Date ? formatDisplayDate(row.dumpReason.Date) : ''}
            </div>
          </div>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <Button
            variant="outline"
            size="sm"
            disabled={undumpingId === row._id}
            onClick={() => void handleUndump(row)}
          >
            <RotateCcw className="h-4 w-4" />
            Un-Dump
          </Button>
        ),
      },
    ],
    [page, itemsPerPage, draftFilters, search, canShowMobile, undumpingId, handleUndump],
  );

  return (
    <ReportPage
      title="Dump Users"
      loading={loading}
      onRefresh={() => void load()}
      toolbar={
        <PageSizeField
          value={itemsPerPage}
          onChange={(value) => {
            setItemsPerPage(value);
            setPage(1);
          }}
        />
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No dump users found"
        minWidth={1400}
      />

      <ReportPager page={page} totalPages={totalPages} total={total} onChange={setPage} disabled={loading} />
    </ReportPage>
  );
}
