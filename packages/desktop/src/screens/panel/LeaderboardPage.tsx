import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import { asList, display } from '@/screens/panel/shared';

type LeaderboardRow = {
  _id: string;
  name?: string;
  email?: string;
  block?: boolean;
  customerCount?: number;
  activeUserCount?: number;
  customerDepositAmt?: number;
  city?: string;
  plainPassword?: string;
};

const CITY_KEYS = ['nagpur', 'dubai', 'bangluru', 'pune', 'mysuru'] as const;

const CITY_TOTAL_LABELS: { key: keyof ReturnType<typeof emptyCityTotals>; label: string }[] = [
  { key: 'nagpurAll', label: 'Total Nagpur Amt' },
  { key: 'dubaiAll', label: 'Total Dubai Amt' },
  { key: 'bangluruAll', label: 'Total Bangluru Amt' },
  { key: 'puneAll', label: 'Total Pune Amt' },
  { key: 'mysuruAll', label: 'Total MySuru Amt' },
];

const dateFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputLabel-root': {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#121218',
    fontSize: 13,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
  },
  '& .MuiInputBase-input': {
    color: '#f2f2f4',
    py: 1,
  },
};

const applyBtnSx = {
  bgcolor: '#f39c12',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.4,
  textTransform: 'uppercase' as const,
  px: 3.5,
  py: 1,
  minWidth: 120,
  borderRadius: 1,
  boxShadow: 'none',
  alignSelf: { xs: 'stretch', sm: 'flex-end' },
  height: 40,
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none' },
};

const refreshBtnSx = {
  bgcolor: '#436ad8',
  color: '#fff',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'none' as const,
  px: 1.75,
  py: 0.6,
  borderRadius: 1,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#3558c0', boxShadow: 'none' },
};

const editBtnSx = {
  p: 0.35,
  borderRadius: 0.75,
  border: '1px solid rgba(255,255,255,0.25)',
  bgcolor: 'rgba(255,255,255,0.06)',
  color: '#e8e8ea',
  '&:hover': { bgcolor: 'rgba(255,159,10,0.2)', borderColor: '#ff9f0a' },
};

function emptyCityTotals(): Record<string, number> {
  return CITY_KEYS.reduce(
    (acc, city) => {
      acc[`${city}All`] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function formatAmt(value: number): string {
  return Number(value || 0).toLocaleString('en-IN');
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityValue, setCityValue] = useState('');
  const [cityId, setCityId] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<unknown>('leaderboard.list', {
        startDate: startDate || null,
        endDate: endDate || null,
      });
      if (!isCurrent(gen)) return;
      if (!res.ok) {
        toast.error(res.message || 'Failed to load leaderboard');
        setRows([]);
        return;
      }
      setRows(asList<LeaderboardRow>(res.data));
    } finally {
      if (isCurrent(gen)) {
        setLoading(false);
        end();
      }
    }
  }, [startDate, endDate, next, isCurrent, begin, end]);

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only; Apply refreshes

  const totals = useMemo(() => {
    const nextTotals = emptyCityTotals();
    for (const entry of rows) {
      const cityName = String(entry.city || '').toLowerCase();
      if ((CITY_KEYS as readonly string[]).includes(cityName)) {
        nextTotals[`${cityName}All`] += Number(entry.customerDepositAmt) || 0;
      }
    }
    return nextTotals;
  }, [rows]);

  const openCityEdit = (id: string, current?: string) => {
    setCityId(id);
    setCityValue(current || '');
    setCityOpen(true);
  };

  const submitCity = async () => {
    if (!cityId || !cityValue.trim()) {
      toast.error('Please enter a city');
      return;
    }
    setSavingCity(true);
    try {
      const res = await secureApi('ops.updateCity', {
        _id: cityId,
        city: cityValue.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update city');
        return;
      }
      toast.success('City updated');
      setCityOpen(false);
      setCityValue('');
      setCityId('');
      void load();
    } finally {
      setSavingCity(false);
    }
  };

  const columns = useMemo<CommonTableColumn<LeaderboardRow>[]>(
    () => [
      {
        id: 'rank',
        label: 'Rank',
        width: 72,
        render: (_row, index) => (
          <Typography variant="body2" fontWeight={700}>
            {index + 1}
          </Typography>
        ),
      },
      {
        id: 'name',
        label: 'Caller Name',
        render: (row) => display(row.name),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => (
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.city)}</Typography>
            <IconButton
              size="small"
              onClick={() => openCityEdit(row._id, row.city)}
              aria-label="Edit city"
              sx={editBtnSx}
            >
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'email',
        label: 'Email',
        render: (row) => display(row.email),
      },
      {
        id: 'password',
        label: 'Password',
        render: (row) => (row.plainPassword ? <CopyText value={row.plainPassword} /> : '—'),
      },
      {
        id: 'customerCount',
        label: 'Customer Count',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{
              cursor: 'pointer',
              color: '#7eb6ff',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
            onClick={() => navigate('/customer-count', { state: { id: row._id } })}
          >
            {row.customerCount ?? 0}
          </Typography>
        ),
      },
      {
        id: 'activeUserCount',
        label: "Today's Active",
        render: (row) => row.activeUserCount ?? 0,
      },
      {
        id: 'customerDepositAmt',
        label: 'Customer Deposit Amount',
        render: (row) => formatAmt(Number(row.customerDepositAmt) || 0),
      },
      {
        id: 'status',
        label: 'Caller Status',
        render: (row) => {
          const blocked = Boolean(row.block);
          return (
            <Typography
              variant="body2"
              sx={{
                color: blocked ? '#ff8a80' : '#81c784',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {blocked ? 'Caller is Blocked' : 'Caller is Not Blocked'}
            </Typography>
          );
        },
      },
    ],
    [navigate],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      {/* Filter bar */}
      <Box
        sx={{
          width: '100%',
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={dateFieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={dateFieldSx}
          />
          <Button variant="contained" onClick={() => void load()} disabled={loading} sx={applyBtnSx}>
            Apply
          </Button>
        </Stack>

        {/* City totals */}
        <Box
          sx={{
            mt: 1.75,
            pt: 1.5,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 1.25,
          }}
        >
          {CITY_TOTAL_LABELS.map(({ key, label }) => (
            <Box
              key={key}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: 1,
                bgcolor: 'rgba(255,159,10,0.08)',
                border: '1px solid rgba(255,159,10,0.18)',
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: 0.2,
                  mb: 0.35,
                }}
              >
                {label}
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#ffd28a' }}>
                {formatAmt(totals[key])}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Refresh row */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
          onClick={() => void load()}
          disabled={loading}
          sx={refreshBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row) => row._id}
        emptyMessage="No leaderboard data for selected dates"
        getRowSx={(_row, index) =>
          index % 2 === 1
            ? { bgcolor: 'rgba(255,255,255,0.03)', '& td': { bgcolor: 'transparent' } }
            : undefined
        }
      />

      <Dialog open={cityOpen} onClose={() => setCityOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit City</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Please enter city"
            value={cityValue}
            onChange={(e) => setCityValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitCity();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCityOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={savingCity}
            onClick={() => void submitCity()}
            sx={{ bgcolor: '#f39c12', '&:hover': { bgcolor: '#e08c00' } }}
          >
            {savingCity ? '…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
