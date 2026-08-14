import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { hasPermission } from '@/auth/permissions';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { formatDisplayDate, formatDisplayTime, todayIST } from '@/utils/dates';
import {
  useAllUserLoginQuery,
  type AllUserLoginFilters,
} from './allUserLoginReport/useAllUserLoginQuery';
import {
  getActionStats,
  type AllUserLoginRow,
} from './allUserLoginReport/types';

const EMPTY_FILTERS: AllUserLoginFilters = {
  name: '',
  realName: '',
  subAdminId: '',
  mobile: '',
};

export function AllUserLoginReportPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;
  const [draftFilters, setDraftFilters] =
    useState<AllUserLoginFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AllUserLoginFilters>(EMPTY_FILTERS);

  const { rows, total, loading, load } = useAllUserLoginQuery(
    page,
    itemsPerPage,
    startDate,
    endDate,
    appliedFilters,
  );
  const deferredRows = useDeferredValue(rows);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  const applyDates = useCallback(() => {
    setPage(1);
    void load(1, appliedFilters);
  }, [load, appliedFilters]);

  const columns = useMemo<CommonTableColumn<AllUserLoginRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Panel Name',
        filter: (
          <TableSearchBar
            value={draftFilters.name}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, name: e.target.value }))
            }
            onSearch={search}
            placeholder="Search name"
          />
        ),
        render: (row) => row.name || '—',
      },
      {
        id: 'realName',
        label: 'Real Name',
        filter: (
          <TableSearchBar
            value={draftFilters.realName}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, realName: e.target.value }))
            }
            onSearch={search}
            placeholder="Search real name"
          />
        ),
        render: (row) => row.realName || '—',
      },
      {
        id: 'userId',
        label: 'User ID',
        filter: (
          <TableSearchBar
            value={draftFilters.subAdminId}
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                subAdminId: e.target.value,
              }))
            }
            onSearch={search}
            placeholder="Search user id"
          />
        ),
        render: (row) => row._id || '—',
      },
      {
        id: 'mobile',
        label: 'Mobile No',
        filter: (
          <TableSearchBar
            value={draftFilters.mobile}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, mobile: e.target.value }))
            }
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) =>
          canShowMobile ? row.mobile || '—' : '*********',
      },
      {
        id: 'logoutCount',
        label: 'Logout Count',
        render: (row) => getActionStats(row.actionHistory, 'logout').count,
      },
      {
        id: 'loginCount',
        label: 'Login Count',
        render: (row) => getActionStats(row.actionHistory, 'login').count,
      },
      {
        id: 'lastLogin',
        label: 'Last Login Time',
        render: (row) => {
          const ts = getActionStats(row.actionHistory, 'login').lastItem
            ?.timestamp;
          if (!ts) return '—';
          return `${formatDisplayDate(ts)}-${formatDisplayTime(ts)}`;
        },
      },
      {
        id: 'lastLogout',
        label: 'Last Logout Time',
        render: (row) => {
          const ts = getActionStats(row.actionHistory, 'logout').lastItem
            ?.timestamp;
          if (!ts) return '—';
          return `${formatDisplayDate(ts)}-${formatDisplayTime(ts)}`;
        },
      },
    ],
    [page, itemsPerPage, draftFilters, search, canShowMobile],
  );

  // When appliedFilters change via search, re-fetch page 1
  // (page effect alone won't re-run if page stays 1 after filter apply)
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        All User Login Report
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
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
            onClick={applyDates}
            disabled={loading}
            sx={{ fontWeight: 700 }}
          >
            Apply
          </Button>
          <Typography fontWeight={700} color="text.secondary">
            Total Count:- {total}
          </Typography>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No login records found"
        minWidth={1100}
        maxHeight="calc(100vh - 300px)"
      />

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={totalPages}
          page={page}
          color="secondary"
          onChange={(_e, nextPage) => setPage(nextPage)}
        />
      </Stack>
    </Box>
  );
}
