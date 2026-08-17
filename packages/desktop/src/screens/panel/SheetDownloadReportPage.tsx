import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatDisplayDate, formatDisplayTime, todayIST } from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { useSheetDownloadQuery } from './sheetDownloadReport/useSheetDownloadQuery';
import type { SheetDownloadRow } from './sheetDownloadReport/types';

export function SheetDownloadReportPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedMid, setSelectedMid] = useState('');

  const { rows, totalPages, total, loading, gateways, load } =
    useSheetDownloadQuery(page, itemsPerPage, startDate, endDate, selectedMid);
  const deferredRows = useDeferredValue(rows);

  const applyFilters = useCallback(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const columns = useMemo<CommonTableColumn<SheetDownloadRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => row.downloadedBy?.name || '—',
      },
      {
        id: 'userId',
        label: 'User ID',
        render: (row) => row.downloadedBy?.userId || '—',
      },
      {
        id: 'downloadAt',
        label: 'Download Date/Time',
        render: (row) => {
          const date = row.downloadedBy?.date;
          if (!date) return '—';
          return `${formatDisplayDate(date)} - ${formatDisplayTime(date)}`;
        },
      },
      {
        id: 'type',
        label: 'Type',
        render: (row) => row.filter?.type || '—',
      },
      {
        id: 'mid',
        label: 'Mid',
        filter: (
          <TextField
            select
            size="small"
            value={selectedMid}
            onChange={(e) => {
              setSelectedMid(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 120, bgcolor: '#f4f6f8', borderRadius: 1 }}
          >
            <MenuItem value="">All</MenuItem>
            {gateways.map((gw, idx) => (
              <MenuItem key={`${gw.mid}-${idx}`} value={String(gw.mid || '')}>
                {gw.mid}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => row.filter?.mid || '—',
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => row.downloadedBy?.city || '—',
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => row.downloadedBy?.state || '—',
      },
    ],
    [page, itemsPerPage, selectedMid, gateways],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title="Sheet Download Report"
        summary={`${startDate} – ${endDate} · Total: ${total}`}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
          <TextField
            type="date"
            label="Start Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            type="date"
            label="End Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1);
            }}
            sx={{ width: 150, flexShrink: 0 }}
          >
            {[...ITEMS_PER_PAGE_OPTIONS, '1000']
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyFilters}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={() => void load(page)}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Refresh
          </Button>
          <Typography fontWeight={700} color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            Total Record : {total}
          </Typography>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          <>
            <Pagination
              count={totalPages}
              page={page}
              color="secondary"
              onChange={(_e, nextPage) => setPage(nextPage)}
            />
          </>
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, index) => row._id || index}
          loading={loading}
          emptyMessage="No download records found"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
