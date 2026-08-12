import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
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
      <Typography variant="h5" fontWeight={700} mb={2}>
        Sheet Download Report
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', width: '100%' }}>
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
          <Typography fontWeight={700} color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            Total Record : {total}
          </Typography>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No download records found"
        stickyHeader
        dense
        maxHeight="calc(100vh - 320px)"
      />

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={totalPages}
          page={page}
          color="secondary"
          onChange={(_e, nextPage) => setPage(nextPage)}
        />
      </Stack>
    </Box>
  );
}
