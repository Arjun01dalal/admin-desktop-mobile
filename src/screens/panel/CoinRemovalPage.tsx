import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Pagination, Stack, Typography } from '@mui/material';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { todayIST } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { CoinRemovalToolbar } from './coinRemoval/CoinRemovalToolbar';
import { useCoinRemovalQuery } from './coinRemoval/useCoinRemovalQuery';
import { docsOf, type CoinRemovalRow } from './coinRemoval/types';

export function CoinRemovalPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const { rows, totalPages, loading, load } = useCoinRemovalQuery(
    page,
    itemsPerPage,
    startDate,
    endDate,
  );
  const deferredRows = useDeferredValue(rows);

  const applyFilters = useCallback(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const clearDates = useCallback(() => {
    setStartDate('');
    setEndDate('');
  }, []);

  const openDetails = useCallback(
    (row: CoinRemovalRow) => {
      navigate('/coin-removal/details', {
        state: {
          user: row,
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
          docs: docsOf(row),
        },
      });
    },
    [navigate, startDate, endDate],
  );

  const columns = useMemo<CommonTableColumn<CoinRemovalRow>[]>(
    () => [
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openDetails(row)}
            sx={{ cursor: 'pointer', fontWeight: 600 }}
          >
            {row.name || '—'}
          </Box>
        ),
      },
      {
        id: 'id',
        label: 'Id',
        render: (row) =>
          row._id ? (
            <CopyText value={row._id} onClick={() => openDetails(row)} />
          ) : (
            '—'
          ),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => row.city || '—',
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => row.state || '—',
      },
      {
        id: 'totalBalance',
        label: 'Total Coin Pulled',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openDetails(row)}
            sx={{ cursor: 'pointer' }}
          >
            {row.totalBalance ?? 0}
          </Box>
        ),
      },
      {
        id: 'totalTransactions',
        label: 'Total Transactions',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openDetails(row)}
            sx={{ cursor: 'pointer' }}
          >
            {row.totalTransactions ?? 0}
          </Box>
        ),
      },
    ],
    [openDetails],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Coin Removal List
      </Typography>

      <CoinRemovalToolbar
        startDate={startDate}
        endDate={endDate}
        itemsPerPage={itemsPerPage}
        loading={loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onItemsPerPageChange={(value) => {
          setItemsPerPage(value);
          setPage(1);
        }}
        onClearDates={clearDates}
        onApply={applyFilters}
      />

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No coin removal records found"
        minWidth={900}
        onRowClick={openDetails}
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
