import { useCallback, useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';

type CheckerMaps = {
  checkBy?: Record<string, number>;
  crossCheckBy?: Record<string, number>;
};

type CheckerRow = {
  name: string;
  checkBy: number;
  crossCheckBy: number;
};

export function CheckersReportPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [maps, setMaps] = useState<CheckerMaps>({ checkBy: {}, crossCheckBy: {} });
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<CheckerMaps[] | CheckerMaps>(
        'reports.checkersData',
        {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      );

      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load checkers report');
        startTransition(() => setMaps({ checkBy: {}, crossCheckBy: {} }));
        return;
      }

      const raw = res.data;
      const data = Array.isArray(raw) ? raw[0] : raw;
      startTransition(() => {
        setMaps({
          checkBy: data?.checkBy || {},
          crossCheckBy: data?.crossCheckBy || {},
        });
      });
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [startDate, endDate, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<CheckerRow[]>(() => {
    const names = Array.from(
      new Set([
        ...Object.keys(maps.checkBy || {}),
        ...Object.keys(maps.crossCheckBy || {}),
      ]),
    );
    return names.map((name) => ({
      name,
      checkBy: maps.checkBy?.[name] ?? 0,
      crossCheckBy: maps.crossCheckBy?.[name] ?? 0,
    }));
  }, [maps]);

  const deferredRows = useDeferredValue(rows);

  const columns = useMemo<CommonTableColumn<CheckerRow>[]>(
    () => [
      { id: 'name', label: 'Name', render: (row) => row.name },
      { id: 'checkBy', label: 'Check By', render: (row) => row.checkBy },
      {
        id: 'crossCheckBy',
        label: 'Cross Check By',
        render: (row) => row.crossCheckBy,
      },
    ],
    [],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Checkers Report
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170 }}
          />
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
            sx={{ fontWeight: 700 }}
          >
            Apply
          </Button>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row) => row.name}
        loading={loading}
        emptyMessage="No data available"
        minWidth={600}
      />
    </Box>
  );
}
