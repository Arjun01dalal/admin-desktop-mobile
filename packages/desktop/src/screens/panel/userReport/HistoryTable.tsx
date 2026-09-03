import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Pagination, Stack } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { UserReportTablePanel } from './UserReportTablePanel';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import { ItemsPerPageField } from './historyFilters';

export type HistoryRow = Record<string, unknown> & { _id?: string };

type UnpackMode = 'items' | 'walletHistory' | 'rawList' | 'payload';

type Props<T extends HistoryRow> = {
  action: SecureAction;
  userId: string;
  /** Build request body from page / size / userId */
  buildPayload: (args: {
    userId: string;
    page: number;
    itemsPerPage: number;
  }) => Record<string, unknown>;
  columns: CommonTableColumn<T>[];
  unpack?: UnpackMode;
  pageSizeOptions?: string[];
  emptyMessage?: string;
  minWidth?: number;
  /** Extra toolbar above the table */
  toolbar?: ReactNode;
  /** Reload token — bump to force refetch */
  reloadKey?: number;
};

function unpackRows(data: unknown, mode: UnpackMode): { rows: HistoryRow[]; totalPages: number } {
  if (!data) return { rows: [], totalPages: 1 };
  if (Array.isArray(data)) return { rows: data as HistoryRow[], totalPages: 1 };

  const root = data as Record<string, unknown>;
  const nested = (root.payload ?? root) as Record<string, unknown>;

  if (mode === 'rawList' && Array.isArray(nested)) {
    return { rows: nested as HistoryRow[], totalPages: 1 };
  }

  const list =
    (nested.items as HistoryRow[]) ||
    (nested.walletHistory as HistoryRow[]) ||
    (nested.list as HistoryRow[]) ||
    (Array.isArray(nested) ? (nested as HistoryRow[]) : []) ||
    [];

  return {
    rows: Array.isArray(list) ? list : [],
    totalPages: Math.max(1, Number(nested.totalPages) || 1),
  };
}

const PAGINATION_SX = {
  '& .MuiPaginationItem-root': {
    color: '#333',
    '&.Mui-selected': {
      bgcolor: '#ff9f0a',
      color: '#000',
      fontWeight: 700,
      '&:hover': { bgcolor: '#f08c00' },
    },
    '&.Mui-disabled': { color: '#bbb' },
    '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' },
  },
  '& .MuiPaginationItem-ellipsis': { color: '#666' },
};

/** Shared paginated history loader for User Report tabs. */
export function HistoryTable<T extends HistoryRow>({
  action,
  userId,
  buildPayload,
  columns,
  unpack = 'items',
  pageSizeOptions = ['20', '50', '100', '250'],
  emptyMessage = 'No records',
  minWidth = 1200,
  toolbar,
  reloadKey = 0,
}: Props<T>) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSizeOptions[0] || '20');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const payload = buildPayload({
        userId,
        page,
        itemsPerPage: Number(itemsPerPage),
      });
      const res = await secureApi(action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load history');
        setRows([]);
        return;
      }
      const parsed = unpackRows(res.data, unpack);
      setRows(parsed.rows as T[]);
      setTotalPages(parsed.totalPages);
    } finally {
      setLoading(false);
    }
  }, [action, buildPayload, itemsPerPage, page, unpack, userId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <Box>
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center" mb={1.5}>
        <ItemsPerPageField
          value={itemsPerPage}
          onChange={(v) => {
            setItemsPerPage(v);
            setPage(1);
          }}
          options={[...pageSizeOptions]}
        />
        {toolbar}
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={laxmiActionBtnSx('white')}
          onClick={() => void load()}
        >
          Refresh
        </Button>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <UserReportTablePanel
        footerJustify="center"
        footer={
          totalPages > 1 ? (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              sx={PAGINATION_SX}
            />
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(r, i) => String(r._id || i)}
          loading={loading}
          emptyMessage={emptyMessage}
          minWidth={minWidth}
          dense
          maxHeight="100%"
        />
      </UserReportTablePanel>
    </Box>
  );
}
