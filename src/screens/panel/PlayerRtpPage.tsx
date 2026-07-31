import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { BackButton } from '@/components/BackButton';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST, formatAmount } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { appCodeForName } from '@/constants/clientNames';
import {
  ReportPage,
  DataTable,
  type DataColumn,
  DateField,
  SelectField,
  SearchInput,
  ApplyButton,
  display,
} from './shared';

type RtpType = 'Qtech' | 'AAA Exchange';

type QtechGame = {
  gameId?: string;
  totalAmount?: number;
  totalBets?: number;
  totalWins?: number;
  winAmount?: number;
  winPercentage?: number;
};

type QtechRow = {
  userId: string;
  games?: QtechGame[];
  combined?: {
    totalAmount?: number;
    totalBets?: number;
    totalWins?: number;
    winAmount?: number;
    winPercentage?: number;
  };
};

type ExchangeRow = {
  userId: string;
  amount?: number;
  clientName?: string;
  name?: string;
  provider?: string;
  totalBets?: number;
  winLoss?: number;
};

type PlayerRtpRow = QtechRow | ExchangeRow;

const TYPE_OPTIONS = [
  { value: 'Qtech', label: 'Qtech' },
  { value: 'AAA Exchange', label: 'AAA Exchange' },
];

function rowBgClass(winPercentage: number | undefined): string | undefined {
  const pct = Number(winPercentage) || 0;
  if (pct > 85) return 'bg-red-500/20 hover:bg-red-500/25';
  if (pct > 70) return 'bg-orange-500/20 hover:bg-orange-500/25';
  return undefined;
}

/** Players RTP — ops.playerRtpQtech / ops.playerRtpExchange. */
export function PlayerRtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromUserReport = Boolean(
    (location.state as { fromUserReport?: boolean } | null)?.fromUserReport,
  );
  const seedUserId = String(
    (location.state as { id?: string } | null)?.id || '',
  );
  const [type, setType] = useState<RtpType>('Qtech');
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [draftUserId, setDraftUserId] = useState(seedUserId);
  const [draftGameId, setDraftGameId] = useState('');
  const [userId, setUserId] = useState(seedUserId);
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<PlayerRtpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const action = type === 'Qtech' ? 'ops.playerRtpQtech' : 'ops.playerRtpExchange';
      const res = await secureApi<unknown>(action, {
        startDate,
        endDate,
        userId,
        gameId: type === 'Qtech' ? gameId : '',
      });

      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load players RTP');
        startTransition(() => setRows([]));
        return;
      }

      if (type === 'Qtech') {
        const list = Array.isArray(res.data) ? (res.data as QtechRow[]) : [];
        startTransition(() => setRows(list));
      } else {
        const map = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<
          string,
          Omit<ExchangeRow, 'userId'>
        >;
        const list: ExchangeRow[] = Object.entries(map).map(([id, value]) => ({
          ...value,
          userId: id,
        }));
        const filtered = userId
          ? list.filter((row) => row.userId === userId)
          : list;
        startTransition(() => setRows(filtered));
      }
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [type, startDate, endDate, userId, gameId, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, userId, gameId]);

  const search = useCallback(() => {
    setUserId(draftUserId.trim());
    setGameId(draftGameId.trim());
  }, [draftUserId, draftGameId]);

  const applyDates = useCallback(() => {
    void load();
  }, [load]);

  const qtechColumns = useMemo<DataColumn<QtechRow>[]>(
    () => [
      { id: 'index', label: '#', render: (_row, index) => index + 1 },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <SearchInput
            value={draftUserId}
            onChange={setDraftUserId}
            onSearch={search}
            placeholder="Search by User ID"
          />
        ),
        render: (row) => display(row.userId),
      },
      {
        id: 'gameId',
        label: 'Game ID',
        filter: (
          <SearchInput
            value={draftGameId}
            onChange={setDraftGameId}
            onSearch={search}
            placeholder="Search by Game ID"
          />
        ),
        className: 'max-w-[280px] truncate',
        render: (row) =>
          [...(row.games || [])]
            .sort((a, b) => (Number(b.winPercentage) || 0) - (Number(a.winPercentage) || 0))
            .map((g) => g.gameId)
            .filter(Boolean)
            .join(', ') || '—',
      },
      {
        id: 'gameCount',
        label: 'Game Count',
        render: (row) => (
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() =>
              navigate('/playerRTPDetails', { state: { gameData: row.games || [] } })
            }
          >
            {row.games?.length || 0}
          </button>
        ),
      },
      { id: 'totalAmount', label: 'Total Amount', render: (row) => formatAmount(row.combined?.totalAmount ?? 0) },
      { id: 'totalBets', label: 'Total Bets', render: (row) => display(row.combined?.totalBets ?? 0) },
      { id: 'totalWins', label: 'Total Wins', render: (row) => display(row.combined?.totalWins ?? 0) },
      { id: 'winAmount', label: 'Total Wins Amount', render: (row) => formatAmount(row.combined?.winAmount ?? 0) },
      { id: 'winPct', label: 'Total Win %', render: (row) => display(row.combined?.winPercentage ?? 0) },
    ],
    [draftUserId, draftGameId, search, navigate],
  );

  const exchangeColumns = useMemo<DataColumn<ExchangeRow>[]>(
    () => [
      { id: 'index', label: '#', render: (_row, index) => index + 1 },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <SearchInput
            value={draftUserId}
            onChange={setDraftUserId}
            onSearch={search}
            placeholder="Search by User ID"
          />
        ),
        render: (row) => display(row.userId),
      },
      { id: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
      { id: 'clientName', label: 'App Code', render: (row) => appCodeForName(row.clientName) },
      { id: 'name', label: 'Name', render: (row) => display(row.name) },
      { id: 'provider', label: 'Provider', render: (row) => display(row.provider) },
      { id: 'totalBets', label: 'Total Bets', render: (row) => display(row.totalBets) },
      {
        id: 'winLoss',
        label: 'Win Loss',
        render: (row) => (
          <span
            className={cn(
              'font-semibold',
              Number(row.winLoss) < 0 ? 'text-red-500' : 'text-emerald-500',
            )}
          >
            {formatAmount(row.winLoss ?? 0)}
          </span>
        ),
      },
    ],
    [draftUserId, search],
  );

  return (
    <ReportPage
      title="Players RTP"
      onRefresh={() => void load()}
      loading={loading}
      actions={fromUserReport ? <BackButton /> : undefined}
      toolbar={
        <>
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <SelectField
            label="Type"
            value={type}
            onChange={(value) => {
              setType(value as RtpType);
              setDraftUserId('');
              setDraftGameId('');
              setUserId('');
              setGameId('');
            }}
            options={TYPE_OPTIONS}
          />
          <ApplyButton onClick={applyDates} loading={loading} />
        </>
      }
    >
      {type === 'Qtech' ? (
        <DataTable
          columns={qtechColumns}
          rows={rows as QtechRow[]}
          getRowKey={(row, index) => row.userId || index}
          loading={loading}
          emptyMessage="No RTP data found"
          rowClassName={(row) => rowBgClass((row as QtechRow).combined?.winPercentage)}
          minWidth={1200}
        />
      ) : (
        <DataTable
          columns={exchangeColumns}
          rows={rows as ExchangeRow[]}
          getRowKey={(row, index) => row.userId || index}
          loading={loading}
          emptyMessage="No RTP data found"
          minWidth={1000}
        />
      )}
    </ReportPage>
  );
}
