import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { secureApi } from '@/api/secureClient';
import { todayIST } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type FundSummary = {
  pendingCount?: number;
  totalAmountTransferToMainWallet?: number;
  totalBonusWallet?: number;
  totalBonusWalletCount?: number;
  totalCountTransferToMainWallet?: number;
  totalPendingAmount?: number;
};

type NavType = 'approved' | 'pending' | 'totalData';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  flexShrink: 0,
  minWidth: 'fit-content',
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const dateFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

const kpiCardSx = {
  p: 2.5,
  bgcolor: '#1a1a1f',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: '#ff9f0a' },
} as const;

function unpackSummary(data: unknown): FundSummary {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as FundSummary;
  }
  return obj as FundSummary;
}

export function BonusWalletFundRequestPage() {
  const navigate = useNavigate();
  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allData, setAllData] = useState(false);
  const [summary, setSummary] = useState<FundSummary>({});
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(
    async (opts?: { allData?: boolean; start?: string; end?: string }) => {
      const useAll = opts?.allData ?? false;
      const from = opts?.start ?? startDate;
      const to = opts?.end ?? endDate;
      setLoading(true);
      try {
        const payload = useAll
          ? { allData: true }
          : {
              startDate: from || todayIST(),
              endDate: to || todayIST(),
              allData: false,
            };
        const res = await secureApi('bonusWallet.fundRequestSummary', payload);
        if (!res.ok) {
          toast.error(res.message || 'Failed to load fund request summary');
          setSummary({});
          return;
        }
        setSummary(unpackSummary(res.data));
        setAllData(useAll);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    void loadSummary({ allData: false, start: today, end: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const goToTable = (type: NavType) => {
    navigate('/fund-request-bonus-wallet-table', {
      state: {
        type,
        startDate,
        endDate,
        allData,
      },
    });
  };

  const cards = [
    {
      id: 'approved',
      label: 'Amount Transfer to Main Wallet',
      count: summary.totalCountTransferToMainWallet ?? 0,
      amount: summary.totalAmountTransferToMainWallet ?? 0,
      type: 'approved' as const,
    },
    {
      id: 'pending',
      label: 'Pending Requests',
      count: summary.pendingCount ?? 0,
      amount: summary.totalPendingAmount ?? 0,
      type: 'pending' as const,
    },
    {
      id: 'total',
      label: 'Total Bonus Wallet',
      count: summary.totalBonusWalletCount ?? 0,
      amount: summary.totalBonusWallet ?? 0,
      type: 'totalData' as const,
    },
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: '#1a1a1f',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="flex-end"
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
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => void loadSummary({ allData: false })}
            sx={orangeBtnSx}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => void loadSummary({ allData: true })}
            sx={orangeBtnSx}
          >
            All Data
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            sx={orangeBtnSx}
          >
            Clear
          </Button>
        </Stack>
      </Box>

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress size={32} sx={{ color: '#ff9f0a' }} />
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 1.5,
          }}
        >
          {cards.map((card) => (
            <Paper
              key={card.id}
              elevation={0}
              onClick={() => goToTable(card.type)}
              sx={kpiCardSx}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={800}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                {toDisplayText(card.label)}
              </Typography>
              <Typography
                variant="h6"
                fontWeight={800}
                mt={1}
                sx={{ fontVariantNumeric: 'tabular-nums', color: '#ff9f0a' }}
              >
                ({card.count}) — {Number(card.amount).toLocaleString('en-IN')}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
