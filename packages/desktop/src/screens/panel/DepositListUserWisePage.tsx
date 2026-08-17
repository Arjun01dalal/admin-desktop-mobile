import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';

type MidRow = {
  mid?: string;
  amount?: number | string;
  count?: number | string;
};

type LocationState = {
  data?: MidRow[];
};

export function DepositListUserWisePage() {
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const rows = useMemo(
    () => (Array.isArray(state.data) ? state.data : []),
    [state.data],
  );

  const columns = useMemo<CommonTableColumn<MidRow>[]>(
    () => [
      {
        id: 'mid',
        label: 'Mid',
        render: (row) => display(row.mid),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => display(row.amount),
      },
      {
        id: 'count',
        label: 'Count',
        render: (row) => display(row.count),
      },
    ],
    [],
  );

  if (!rows.length) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Deposit List
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No MID breakdown selected. Open Deposit / Withdrawal details from
            Deposit List.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Deposit List — MID Breakdown
      </Typography>
      <TablePanel>
<CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, i) => String(row.mid || i)}
        emptyMessage="No MID data"
        minWidth={480}
        maxHeight="100%"
      />
      </TablePanel>
    </Box>
  );
}
