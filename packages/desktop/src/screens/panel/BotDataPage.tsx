import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser, todayIST } from '@/utils/dates';
import {
  BOT_DATA_BOT_IDS,
  PLAY_IN_OPTIONS,
} from '@/screens/panel/botData/constants';
import { pushToBotDialer } from '@/screens/panel/shared/pushToBotDialer';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import { mapUsersToBotSettings } from '@/screens/panel/users/toolbarHelpers';

type BotUser = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  state?: string;
  city?: string;
  email?: string;
  activeUser?: string;
};

const USER_TYPES = [
  { value: 'User', label: 'User' },
  { value: 'Todays_Active', label: "Today's Active" },
  { value: 'Active_User', label: 'Active User' },
  { value: 'Non_Performing_User', label: 'Non Performing User' },
  { value: 'In_Active_Deposit', label: 'Inactive Deposit' },
] as const;

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
  overflow: 'visible',
  '&:hover': { bgcolor: '#e08c00' },
};

const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

function asBotMap(raw: unknown): Record<string, BotUser[]> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const nested =
    (obj.users_by_bots as Record<string, BotUser[]> | undefined) ||
    (obj.payload && typeof obj.payload === 'object'
      ? ((obj.payload as Record<string, unknown>).users_by_bots as
          | Record<string, BotUser[]>
          | undefined)
      : undefined) ||
    obj;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return {};
  const out: Record<string, BotUser[]> = {};
  for (const [key, value] of Object.entries(nested)) {
    if (Array.isArray(value)) out[key] = value as BotUser[];
  }
  return out;
}

export function BotDataPage() {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [userType, setUserType] = useState('User');
  const [played, setPlayed] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [bots, setBots] = useState<string[]>([]);
  const [totalRecord, setTotalRecord] = useState('10000');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [botMap, setBotMap] = useState<Record<string, BotUser[]>>({});
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  const cards = useMemo(
    () =>
      Object.entries(botMap)
        .map(([botId, users]) => ({ botId, count: users.length }))
        .sort((a, b) => Number(a.botId) - Number(b.botId)),
    [botMap],
  );

  const totalUsers = useMemo(
    () => cards.reduce((sum, c) => sum + c.count, 0),
    [cards],
  );

  const load = useCallback(async () => {
    if (!userType || !bots.length || !states.length) {
      toast.error('Select User Type, Bot IDs and States');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        type: userType,
        bots,
        totalRecord: Number(totalRecord) || 10000,
        states,
      };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }
      if (played.length) payload.played = played;
      if (minAmt) payload.min = Number(minAmt);
      if (maxAmt) payload.max = Number(maxAmt);

      const res = await secureApi<unknown>('botData.filteredUsersByBots', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load bot data');
        setBotMap({});
        return;
      }
      setBotMap(asBotMap(res.data));
    } finally {
      setLoading(false);
    }
  }, [userType, bots, states, totalRecord, startDate, endDate, played, minAmt, maxAmt]);

  const addToDialer = async () => {
    const entries = Object.entries(botMap);
    if (!entries.length) {
      toast.error('No data to push. Apply filters first.');
      return;
    }
    setPushing(true);
    try {
      const dialout_settings = entries.flatMap(([botId, users]) =>
        mapUsersToBotSettings(users as never[], botId, userType),
      );
      const res = await pushToBotDialer({
        userId: user?._id,
        created_by: user?.name,
        dialout_settings,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add to dialer');
        return;
      }
      toast.success(res.message || `Pushed ${res.pushed} leads`);
      setBotMap({});
    } finally {
      setPushing(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
            },
            gap: 1.25,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            size="small"
            label="User Type"
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            sx={fieldSx}
          >
            {USER_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="In"
            SelectProps={{
              multiple: true,
              renderValue: (v) => (v as string[]).join(', ') || 'All',
            }}
            value={played}
            onChange={(e) => setPlayed(e.target.value as unknown as string[])}
            sx={fieldSx}
          >
            {PLAY_IN_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>
                <Checkbox size="small" checked={played.includes(p)} />
                {p}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="States"
            SelectProps={{
              multiple: true,
              renderValue: (v) => {
                const vals = v as string[];
                return vals.length > 2
                  ? `${vals.slice(0, 2).join(', ')} +${vals.length - 2}`
                  : vals.join(', ') || 'Select';
              },
            }}
            value={states}
            onChange={(e) => setStates(e.target.value as unknown as string[])}
            sx={fieldSx}
          >
            {INDIA_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                <Checkbox size="small" checked={states.includes(s)} />
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Bot IDs"
            SelectProps={{
              multiple: true,
              renderValue: (v) => {
                const vals = v as string[];
                return vals.length > 3
                  ? `${vals.slice(0, 3).join(', ')} +${vals.length - 3}`
                  : vals.join(', ') || 'Select';
              },
            }}
            value={bots}
            onChange={(e) => setBots(e.target.value as unknown as string[])}
            sx={fieldSx}
          >
            {BOT_DATA_BOT_IDS.map((id) => (
              <MenuItem key={id} value={id}>
                <Checkbox size="small" checked={bots.includes(id)} />
                {id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Total Records"
            value={totalRecord}
            onChange={(e) => setTotalRecord(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Min Amount"
            value={minAmt}
            onChange={(e) => setMinAmt(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Max Amount"
            value={maxAmt}
            onChange={(e) => setMaxAmt(e.target.value)}
            sx={fieldSx}
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ gridColumn: '1 / -1', pt: 0.25 }}
          >
            <Button
              variant="contained"
              disabled={loading}
              onClick={() => void load()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Apply
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              disabled={loading}
              onClick={() => void load()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              disabled={pushing || !cards.length}
              onClick={() => void addToDialer()}
              sx={{ ...orangeBtnSx, minWidth: 'fit-content' }}
            >
              Add Data To Bot
            </Button>
          </Stack>
        </Box>
        <Typography sx={{ mt: 1.25, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          Total Users: <b>{totalUsers}</b>
        </Typography>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !cards.length ? (
        <Typography color="text.secondary">No bot data for selected filters</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
              xl: 'repeat(8, minmax(0, 1fr))',
            },
            gap: 1.25,
          }}
        >
          {cards.map((card) => (
            <Paper
              key={card.botId}
              sx={{
                p: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid rgba(255,159,10,0.35)',
                borderRadius: 1.5,
              }}
            >
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                Bot ID
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#ffd28a' }}>
                {card.botId}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: 13 }}>
                Count: <b>{card.count}</b>
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
