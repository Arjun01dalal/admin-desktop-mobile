import { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { todayIST } from '@/utils/dates';

type EventRow = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  uniquePlayers: 'Unique Players',
  payin: 'Payin',
  payout: 'Payout',
  CommissionAmount: 'Commission Amount',
  commissionAmount: 'Commission Amount',
  TotalGGR: 'Total GGR',
  totalGGR: 'Total GGR',
  final_ggr: 'Final GGR',
  finalGgr: 'Final GGR',
  netpl: 'Net PL',
  profit: 'Profit',
};

const SKIP_KEYS = new Set(['eventName', 'Eventname', '_id', 'id']);

function labelFor(key: string): string {
  return (
    FIELD_LABELS[key] ||
    key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Match laxminarayan: decrypt envelope → Object.values(payload). */
function unpackEvents(raw: unknown): EventRow[] {
  let cur: unknown = raw;
  for (let i = 0; i < 3; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (obj.payload != null) {
      cur = obj.payload;
      continue;
    }
    if (obj.data != null && typeof obj.data === 'object') {
      cur = obj.data;
      continue;
    }
    break;
  }

  if (Array.isArray(cur)) {
    return cur.filter(
      (v): v is EventRow =>
        Boolean(v) && typeof v === 'object' && !Array.isArray(v),
    );
  }

  if (cur && typeof cur === 'object') {
    return Object.values(cur as Record<string, unknown>).filter(
      (v): v is EventRow =>
        Boolean(v) && typeof v === 'object' && !Array.isArray(v),
    );
  }

  return [];
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    return key === 'uniquePlayers' ? String(value) : value.toFixed(2);
  }
  if (value == null) return '';
  return String(value);
}

/**
 * Jetfair / Falcon event-wise GGR — ported from laxminarayan FalconRateManagement.
 * Opened from dashboard cards via `?startDate&endDate&type=jetfair|falcon`.
 */
export function FalconRateManagementPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const navState = (location.state || {}) as {
    startDate?: string;
    endDate?: string;
    type?: string;
  };

  const startDate =
    params.get('startDate') || navState.startDate || todayIST();
  const endDate = params.get('endDate') || navState.endDate || todayIST();
  // Match laxminarayan: only exact `jetfair` uses jetfair API; else falcon.
  const type = (
    params.get('type') ||
    navState.type ||
    'jetfair'
  ).toLowerCase();
  const isJetfair = type === 'jetfair';

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const action = isJetfair
        ? 'dashboard.jetfairByEvent'
        : 'dashboard.falconByEvent';
      const res = await secureApi(action, { startDate, endDate });
      if (!res.ok) {
        if (!silent) toast.error(res.message || 'Failed to load event GGR');
        setEvents([]);
        return;
      }
      const list = unpackEvents(res.data);
      list.sort((a, b) =>
        String(a.Eventname || a.eventName || '').localeCompare(
          String(b.Eventname || b.eventName || ''),
        ),
      );
      setEvents(list);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [endDate, isJetfair, startDate]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await load(false);
    };
    void run();
    // laxminarayan polls every 3s so live match books stay fresh
    const id = window.setInterval(() => {
      if (mounted) void load(true);
    }, 3000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [load]);

  const title = isJetfair
    ? 'Jetfair Platform Details'
    : 'Falcon Platform Details';

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {startDate} → {endDate}
      </Typography>

      {loading && events.length === 0 && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && events.length === 0 && (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
          <Typography color="text.secondary">No event data</Typography>
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
        {events.map((event, index) => {
          const name = String(
            event.Eventname || event.eventName || `Event ${index + 1}`,
          );
          return (
            <Paper key={`${name}-${index}`} sx={{ p: 2, bgcolor: '#1a1a1f' }}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                mb={1}
                align="center"
                sx={{ bgcolor: 'rgba(255,255,255,0.06)', py: 1, borderRadius: 1 }}
              >
                {name}
              </Typography>
              <Stack spacing={0.75}>
                {Object.entries(event)
                  .filter(([key]) => !SKIP_KEYS.has(key))
                  .map(([key, value]) => {
                    const highlight = [
                      'TotalGGR',
                      'totalGGR',
                      'final_ggr',
                      'finalGgr',
                      'netpl',
                    ].includes(key);
                    const num = typeof value === 'number' ? value : Number(value);
                    const color =
                      highlight && Number.isFinite(num)
                        ? num < 0
                          ? 'error.main'
                          : 'success.main'
                        : 'warning.main';
                    return (
                      <Box
                        key={key}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {labelFor(key)}:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          color={color}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatValue(key, value)}
                        </Typography>
                      </Box>
                    );
                  })}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
