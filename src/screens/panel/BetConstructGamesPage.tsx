import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secureApi } from '@/api/secureClient';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  PageSizeField,
  SearchInput,
  ApplyButton,
  ReportPager,
  useReportQuery,
  asList,
  display,
  type DataColumn,
} from '@/screens/panel/shared';

type BetConstructRow = {
  gameId: string;
  Name?: string;
  category?: string;
  allowedCurrency?: string[];
  subCategory?: string;
  providerName?: string;
  provider?: { name?: string; id?: string };
  rating?: number;
  ratingCount?: number;
  status?: boolean;
  images?: Array<{ url?: string }>;
  updatedOn?: string;
  [key: string]: unknown;
};

export function BetConstructGamesPage() {
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [total, setTotal] = useState(0);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [activeGameId, setActiveGameId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = { pageNo: page, itemsPerPage };
    if (appliedName) payload.name = appliedName;
    return payload;
  }, [page, itemsPerPage, appliedName]);

  const unpack = useCallback(
    (res: { data?: unknown }) => {
      const data = res.data as { games?: BetConstructRow[]; count?: number } | undefined;
      const rows = Array.isArray(data?.games) ? (data?.games as BetConstructRow[]) : asList<BetConstructRow>(data);
      const count = Number(data?.count ?? rows.length) || 0;
      setTotal(count);
      return {
        rows,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / itemsPerPage)),
      };
    },
    [itemsPerPage],
  );

  const { rows, totalPages, loading, load } = useReportQuery<BetConstructRow>({
    action: 'ops.betConstructGetAll',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage],
    errorMessage: 'Failed to load BetConstruct games',
  });

  const search = useCallback(() => {
    setAppliedName(draftName);
    setPage(1);
    void load();
  }, [draftName, load]);

  const openImageDialog = useCallback((row: BetConstructRow) => {
    setActiveGameId(row.gameId);
    setImageUrl('');
    setImageDialogOpen(true);
  }, []);

  const handleUpdateImage = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!imageUrl.trim()) {
        toast.error('Please add image URL');
        return;
      }
      if (!activeGameId) {
        toast.error('Please select a proper game');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.betConstructUpdateImage', {
          gameId: activeGameId,
          url: imageUrl.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update image');
          return;
        }
        toast.success('Image updated');
        setImageDialogOpen(false);
        setImageUrl('');
        setActiveGameId('');
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [imageUrl, activeGameId, load],
  );

  const columns = useMemo<DataColumn<BetConstructRow>[]>(
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
            value={draftName}
            onChange={setDraftName}
            onSearch={search}
            placeholder="Search by Game name"
          />
        ),
        render: (row) => row.Name || '—',
      },
      { id: 'category', label: 'Category', render: (row) => display(row.category) },
      {
        id: 'allowedCurrency',
        label: 'Allowed Currency',
        render: (row) => (Array.isArray(row.allowedCurrency) ? row.allowedCurrency.join(', ') : '—'),
      },
      { id: 'subCategory', label: 'Sub Category', render: (row) => display(row.subCategory) },
      { id: 'gameId', label: 'Game Id', render: (row) => row.gameId },
      { id: 'providerName', label: 'Provider Name', render: (row) => display(row.providerName) },
      {
        id: 'providerDetails',
        label: 'Provider Details',
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span>Name:- {row.provider?.name || '—'}</span>
            <span>ID:- {row.provider?.id || '—'}</span>
          </div>
        ),
      },
      { id: 'rating', label: 'Rating', render: (row) => row.rating ?? '—' },
      { id: 'ratingCount', label: 'Rating Count', render: (row) => row.ratingCount ?? '—' },
      {
        id: 'status',
        label: 'Status',
        render: (row) => (
          <span
            className={
              row.status
                ? 'rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary'
                : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
            }
          >
            {row.status ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        id: 'images',
        label: 'Images',
        render: (row) => (
          <div className="flex flex-col items-start gap-1">
            <img
              src={row.images?.[2]?.url ?? ''}
              alt={row.Name || 'Game'}
              className="h-12 w-16 rounded object-cover"
            />
            <Button variant="outline" size="sm" onClick={() => openImageDialog(row)}>
              <ImagePlus className="h-4 w-4" />
              Upload
            </Button>
          </div>
        ),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (row) =>
          row.updatedOn
            ? `${formatDisplayDate(row.updatedOn)}-${formatDisplayTime(row.updatedOn)}`
            : '—',
      },
    ],
    [page, itemsPerPage, draftName, search, openImageDialog],
  );

  return (
    <ReportPage
      title="BetConstruct Games"
      loading={loading}
      onRefresh={() => void load()}
      toolbar={
        <>
          <PageSizeField
            value={itemsPerPage}
            onChange={(value) => {
              setItemsPerPage(value);
              setPage(1);
            }}
          />
          <ApplyButton onClick={() => void load()} loading={loading} />
          <p className="self-end pb-2 text-sm font-semibold text-muted-foreground">
            Total Count: {total}
          </p>
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row.gameId || index}
        loading={loading}
        emptyMessage="No games found"
        minWidth={1600}
      />

      <ReportPager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />

      <ReportDialog
        open={imageDialogOpen}
        title="Add Img URL"
        onClose={() => setImageDialogOpen(false)}
        onSubmit={handleUpdateImage}
        loading={submitting}
      >
        <Input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          autoFocus
        />
      </ReportDialog>
    </ReportPage>
  );
}
