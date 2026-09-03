import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from 'react';
import { Box, Button, CircularProgress, Stack, TextField } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
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
      const res = await secureApi<CheckerMaps[] | CheckerMaps>('reports.checkersData', {
        startDate: startDate || null,
        endDate: endDate || null,
      });

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
      new Set([...Object.keys(maps.checkBy || {}), ...Object.keys(maps.crossCheckBy || {})]),
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
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel title="Checkers Report" summary={`${startDate} → ${endDate}`}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => void load()}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Refresh
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row) => row.name}
          loading={loading}
          emptyMessage="No data available"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
