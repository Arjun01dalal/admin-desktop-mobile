import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { ImageOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { cn } from '@/lib/utils';
import {
  ReportPage,
  DataTable,
  PageSizeField,
  SearchInput,
  ApplyButton,
  ReportPager,
  display,
  type DataColumn,
} from '@/screens/panel/shared';

type CasinoGameRow = {
  _id: string;
  Name?: string;
  gameId?: string;
  Game_Code?: string;
  category?: string;
  Category_ID?: string;
  provider?: { id?: string; name?: string };
  Provider_ID?: string;
  images?: Array<{ url?: string }>;
  Thumbnail?: string;
  status?: boolean;
  [key: string]: unknown;
};

function gameCode(row: CasinoGameRow): string {
  return display(row.gameId || row.Game_Code);
}

function providerId(row: CasinoGameRow): string {
  return display(row.provider?.id || row.Provider_ID);
}

function category(row: CasinoGameRow): string {
  return display(row.category || row.Category_ID);
}

function imageUrl(row: CasinoGameRow): string | null {
  return row.images?.[0]?.url || row.images?.[1]?.url || row.Thumbnail || null;
}

export function CasinoGamesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [nameSearch, setNameSearch] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [appliedId, setAppliedId] = useState('');

  const [rows, setRows] = useState<CasinoGameRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, nameOverride = appliedName, idOverride = appliedId) => {
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const filters: Record<string, string> = {};
        if (nameOverride) filters.Name = nameOverride;
        if (idOverride) filters.gameId = idOverride;

        const res = await secureApi('ops.casinoGetData', {
          pageNo,
          itemsPerPage: pageSize,
          Filters: filters,
        });
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load casino games';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.items) ? (data.items as CasinoGameRow[]) : [];
        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, appliedName, appliedId, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedName(nameSearch);
    setAppliedId(idSearch);
    setPage(1);
    void load(1, nameSearch, idSearch);
  }, [nameSearch, idSearch, load]);

  const toggleStatus = useCallback(
    async (row: CasinoGameRow) => {
      const nextStatus = !row.status;
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.casinoEditGame', {
          gameId: row.gameId ?? row._id,
          _id: row._id,
          status: nextStatus,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update game status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: nextStatus } : item)),
        );
        toast.success(nextStatus ? 'Game enabled' : 'Game disabled');
      } finally {
        setTogglingId(null);
      }
    },
    [],
  );

  const columns = useMemo<DataColumn<CasinoGameRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      { id: 'id', label: 'ID', render: (row) => <span className="text-xs">{row._id}</span> },
      {
        id: 'name',
        label: 'Game Name',
        filter: (
          <SearchInput
            value={nameSearch}
            placeholder="Search game name"
            onChange={setNameSearch}
            onSearch={search}
          />
        ),
        render: (row) => <span className="font-medium">{display(row.Name)}</span>,
      },
      {
        id: 'gameId',
        label: 'Game ID / Code',
        filter: (
          <SearchInput
            value={idSearch}
            placeholder="Search game id"
            onChange={setIdSearch}
            onSearch={search}
          />
        ),
        render: (row) => gameCode(row),
      },
      { id: 'providerId', label: 'Provider ID', render: providerId },
      { id: 'category', label: 'Category', render: category },
      {
        id: 'image',
        label: 'Image',
        render: (row) => {
          const src = imageUrl(row);
          return src ? (
            <img src={src} alt={row.Name || 'game'} className="h-10 w-16 rounded object-cover" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => (
          <button
            type="button"
            disabled={togglingId === row._id}
            onClick={() => void toggleStatus(row)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              row.status
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {row.status ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {row.status ? 'Active' : 'Inactive'}
          </button>
        ),
      },
    ],
    [page, pageSize, nameSearch, idSearch, search, togglingId, toggleStatus],
  );

  return (
    <ReportPage
      title="Casino Games"
      loading={loading}
      error={error}
      onRefresh={() => void load(page)}
      toolbar={
        <>
          <PageSizeField
            value={pageSize}
            onChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
          <ApplyButton onClick={search} loading={loading} label="Search" />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, i) => row._id || i}
        loading={loading}
        emptyMessage="No casino games found"
        minWidth={1100}
      />

      <ReportPager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
    </ReportPage>
  );
}
