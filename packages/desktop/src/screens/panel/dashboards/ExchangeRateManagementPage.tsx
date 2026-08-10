import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { todayIST } from '@/utils/dates';
import { floorNum, toNum } from '@/screens/panel/dashboards/ops/mergeMetrics';

type GameRow = Record<string, unknown>;

/**
 * AAA exchange game-wise P/L — ported from laxminarayan ExchangeRateManagement.
 * Opened from dashboard AAA card via `?startDate&endDate`.
 */
export function ExchangeRateManagementPage() {
  const [params] = useSearchParams();
  const startDate = params.get('startDate') || todayIST();
  const endDate = params.get('endDate') || todayIST();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<GameRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('dashboard.aaaGameWise', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load AAA exchange data');
        setRows([]);
        return;
      }
      const raw = res.data;
      const list = Array.isArray(raw)
        ? (raw as GameRow[])
        : raw && typeof raw === 'object'
          ? (Object.values(raw as Record<string, unknown>).filter(
              (v) => v && typeof v === 'object',
            ) as GameRow[])
          : [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Ascendant Details
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {startDate} → {endDate}
      </Typography>

      {loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && rows.length === 0 && (
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">No AAA exchange data</Typography>
        </Paper>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {rows.map((row, index) => {
          const name = String(
            row.gameName || row.eventName || row.name || `Game ${index + 1}`,
          );
          const entries = Object.entries(row).filter(
            ([k, v]) =>
              k !== 'gameName' &&
              k !== 'eventName' &&
              k !== 'name' &&
              (typeof v === 'number' || typeof v === 'string'),
          );
          return (
            <Paper key={`${name}-${index}`} sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={800} mb={1}>
                {name}
              </Typography>
              <Stack spacing={0.75}>
                {entries.map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight={700}>
                      {key}:
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      color="warning.main"
                    >
                      {typeof value === 'number'
                        ? floorNum(toNum(value))
                        : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
