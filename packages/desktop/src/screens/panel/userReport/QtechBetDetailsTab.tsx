import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, TextField } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatAmount, todayIST } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import { TOOLBAR_FIELD_SX, TOOLBAR_ROW_SX } from './historyFilters';

type Props = { userId: string };

type RtpRow = HistoryRow & {
  gameName?: string;
  totalBets?: number;
  totalWins?: number;
  totalAmount?: number;
  winAmount?: number;
};

/** Qtech bet details / RTP aggregate. */
export function QtechBetDetailsTab({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RtpRow[]>([]);
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('userReport.qtechRtp', {
        userId,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load bet details');
        setRows([]);
        return;
      }
      const data = (res.data || {}) as {
        payload?: RtpRow[] | { games?: RtpRow[] };
        games?: RtpRow[];
      };
      const nested = data.payload ?? data;
      if (Array.isArray(nested)) setRows(nested);
      else if (Array.isArray((nested as { games?: RtpRow[] }).games)) {
        setRows((nested as { games: RtpRow[] }).games);
      } else setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<RtpRow>[]>(
    () => [
      { id: '#', label: '#', width: 48, render: (_r, i) => i + 1 },
      {
        id: 'game',
        label: 'Game Name',
        render: (r) => String(r.gameName || r.gameId || '-'),
      },
      {
        id: 'bets',
        label: 'Total Bets',
        render: (r) => formatAmount(r.totalBets ?? 0),
      },
      {
        id: 'wins',
        label: 'Total Wins',
        render: (r) => formatAmount(r.totalWins ?? 0),
      },
      {
        id: 'amount',
        label: 'Total Amount',
        render: (r) => formatAmount(r.totalAmount ?? 0),
      },
      {
        id: 'winAmt',
        label: 'Win Amount',
        render: (r) => formatAmount(r.winAmount ?? 0),
      },
    ],
    [],
  );

  return (
    <Box>
      <Box sx={TOOLBAR_ROW_SX}>
        <TextField
          type="date"
          size="small"
          label="From Date"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          sx={TOOLBAR_FIELD_SX}
        />
        <TextField
          type="date"
          size="small"
          label="To Date"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          sx={TOOLBAR_FIELD_SX}
        />
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={{
            ...laxmiActionBtnSx('black'),
            bgcolor: '#ff9f0a',
            backgroundImage: 'none',
            color: '#111',
            '&:hover': { bgcolor: '#e08c00', boxShadow: 'none !important' },
          }}
          onClick={() => void load()}
        >
          Apply
        </Button>
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={laxmiActionBtnSx('white')}
          onClick={() => {
            setStartDate(todayIST());
            setEndDate(todayIST());
          }}
        >
          Today
        </Button>
        {loading && <CircularProgress size={22} />}
      </Box>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(r, i) => String(r.gameName || r._id || i)}
          loading={loading}
          emptyMessage="No bet details"
          minWidth={800}
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
