import { useCallback, useState } from 'react';
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
import { monthStartIST, todayIST, formatAmount } from '@/utils/dates';
import TransactionTable from './houseGames/TransactionTable';
import UpdateBetStatusModal from './houseGames/UpdateBetStatusModal';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { useRevealCodes } from '@/context/useRevealCodes';
import {
  INITIAL_FILTERS,
  ITEMS_PER_PAGE_OPTIONS,
  type FiltersState,
} from './houseGames/constants';
import { useHouseGamesQuery } from './houseGames/useHouseGamesQuery';
import type { HouseGameTransaction } from './houseGames/types';

export function HouseGamesPage() {
  useRevealCodes();
  const [startDate, setStartDate] = useState(monthStartIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HouseGameTransaction | null>(
    null,
  );
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);

  const {
    dataArr,
    totalCount,
    totalAmount,
    totalPages,
    loader,
    getTransactions,
  } = useHouseGamesQuery(filters, startDate, endDate, itemsPerPage, currentPage);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    void getTransactions(1);
  }, [getTransactions]);

  const updateFilter = useCallback((key: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateCheckboxFilter = useCallback(
    (key: 'isBot' | 'human', checked: boolean) => {
      setFilters((prev) => ({ ...prev, [key]: checked }));
    },
    [],
  );

  const onEdit = useCallback((item: HouseGameTransaction) => {
    setSelectedItem(item);
    setShowUpdateModal(true);
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {toDisplayText('House Krida')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f', overflow: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap">
          <TextField
            type="date"
            label="From Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            fullWidth={false}
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            sx={{ width: 140, flexShrink: 0 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loader}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          >
            Search
          </Button>
          {loader && <CircularProgress size={22} />}
        </Stack>

        <Stack direction="row" spacing={3} mt={1.5} flexWrap="nowrap">
          <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
            {toDisplayText('Total')}: {totalCount}
          </Typography>
          {totalAmount !== undefined && (
            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
              Total Amount: {formatAmount(Math.round(Number(totalAmount) || 0))}
            </Typography>
          )}
        </Stack>
      </Paper>

      <TransactionTable
        data={dataArr}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        filters={filters}
        loading={loader}
        onFilterChange={updateFilter}
        onCheckboxChange={updateCheckboxFilter}
        onSearch={handleSearch}
        onEdit={onEdit}
      />

      {totalPages > 0 && (
        <Stack alignItems="center" mt={2}>
          <Pagination
            count={totalPages}
            color="primary"
            page={currentPage}
            onChange={(_e, newPage) => setCurrentPage(newPage)}
          />
        </Stack>
      )}

      <UpdateBetStatusModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedItem(null);
        }}
        selectedItem={selectedItem}
        onSuccess={() => void getTransactions(currentPage)}
      />
    </Box>
  );
}
