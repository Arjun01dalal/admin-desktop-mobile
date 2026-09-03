import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { todayIST } from '@/utils/dates';
import { useRevealCodes } from '@/context/useRevealCodes';
import { ActivityFilterBar } from './activity/ActivityFilterBar';
import {
  formatGgr,
  formatMetric,
  getMetric,
  normalizeActivityList,
  nextSortConfig,
  sortActivityRows,
  sortArrow,
  userIdOf,
  type ActivityRow,
  type SortConfig,
  type SortKey,
} from './activity/utils';

type LocationState = {
  startDate?: string;
  endDate?: string;
  type?: 'Qtech' | 'Wco' | string;
};

export function PlayerActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  useRevealCodes();
  const navState = (location.state || {}) as LocationState;
  const lockedSource = Boolean(navState.type);

  const [startDate, setStartDate] = useState(() => navState.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => navState.endDate || todayIST());
  const [isQtech, setIsQtech] = useState(() => navState.type === 'Qtech');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ActivityRow[]>([]);
  const [sort, setSort] = useState<SortConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const action = isQtech ? 'player.qtechStats' : 'player.wcoStats';
      const res = await secureApi(action, { startDate, endDate });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load player activity');
        setData([]);
        return;
      }
      setData(normalizeActivityList(res.data));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, isQtech]);

  useEffect(() => {
    void load();
  }, [isQtech]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => sortActivityRows(data, sort), [data, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => nextSortConfig(prev, key));
  }, []);

  const openUser = useCallback(
    (row: ActivityRow) => {
      navigate('/player-activity/details', {
        state: { data: row, isQtech },
      });
    },
    [navigate, isQtech],
  );

  const columns = useMemo<CommonTableColumn<ActivityRow>[]>(() => {
    const sortable = (
      key: SortKey,
      label: string,
    ): Pick<CommonTableColumn<ActivityRow>, 'label' | 'sortable' | 'onHeaderClick'> => ({
      label: `${label} ${sortArrow(sort, key)}`,
      sortable: true,
      onHeaderClick: () => toggleSort(key),
    });

    return [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userId',
        label: 'UserId',
        render: (row) => {
          const id = userIdOf(row);
          if (!id) return '—';
          return <CopyText value={id} onClick={() => openUser(row)} />;
        },
      },
      {
        id: 'betAmount',
        ...sortable('betAmount', 'Bet Amount'),
        render: (row) => formatMetric(getMetric(row, 'betAmount')),
      },
      {
        id: 'betCount',
        ...sortable('betCount', 'Bet Count'),
        render: (row) => getMetric(row, 'betCount'),
      },
      {
        id: 'commissionAmount',
        ...sortable('commissionAmount', 'Commission'),
        render: (row) => formatMetric(getMetric(row, 'commissionAmount')),
      },
      {
        id: 'commissionCount',
        ...sortable('commissionCount', 'Commission Count'),
        render: (row) => getMetric(row, 'commissionCount'),
      },
      {
        id: 'rtp',
        ...sortable('rtp', 'RTP'),
        render: (row) => getMetric(row, 'rtp'),
      },
      {
        id: 'ggr',
        ...sortable('ggr', 'GGR'),
        render: (row) => {
          const ggr = getMetric(row, 'ggr');
          return (
            <Box component="span" sx={{ color: ggr < 0 ? '#e53935' : '#43a047', fontWeight: 600 }}>
              {formatGgr(ggr)}
            </Box>
          );
        },
      },
      {
        id: 'winAmount',
        ...sortable('winAmount', 'Win'),
        render: (row) => formatMetric(getMetric(row, 'winAmount')),
      },
      {
        id: 'rollbackAmount',
        ...sortable('rollbackAmount', 'Rollback'),
        render: (row) => formatMetric(getMetric(row, 'rollbackAmount')),
      },
    ];
  }, [sort, toggleSort, openUser]);

  return (
    <Box>
      <ActivityFilterBar
        title="Player Activity"
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={() => void load()}
        onRefresh={() => void load()}
        loading={loading}
        showSourceToggle={!lockedSource}
        isQtech={isQtech}
        onSourceChange={setIsQtech}
      />

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={sorted}
          getRowKey={(row, i) => String(row.userId || row._id || i)}
          loading={loading}
          emptyMessage="No data"
          minWidth={1000}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
