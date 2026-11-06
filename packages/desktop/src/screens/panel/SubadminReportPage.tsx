/**
 * Subadmin Report — automatic logout sessions (admin-panel SubadminReport parity).
 */
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  displaySubadminReportValue,
  formatSubadminLoginLabel,
  SUBADMIN_REPORT_PAGE_SIZES,
  subadminReportRange,
  type SubadminLogoutRow,
} from '@astro/shared';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission, Permissions } from '@/auth/permissions';
import { todayIST } from '@/utils/dates';
import { useSubadminReportQuery } from './subadminReport/useSubadminReportQuery';

function cell(value: unknown) {
  return displaySubadminReportValue(value) || '—';
}

export function SubadminReportPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const { rows, total, totalPages, loading, load } = useSubadminReportQuery(
    page,
    limit,
    startDate,
    endDate,
  );
  const deferredRows = useDeferredValue(rows);
  const canShowMobile = hasPermission(Permissions.show_mobile);
  const range = subadminReportRange(total, page, limit);

  const applyFilters = useCallback(() => {
    if (page === 1) {
      void load(1);
      return;
    }
    setPage(1);
  }, [load, page]);

  const columns = useMemo<CommonTableColumn<SubadminLogoutRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => (page - 1) * limit + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <Typography component="span" fontWeight={700} variant="body2">
            {cell(row.name)}
          </Typography>
        ),
      },
      {
        id: 'pseudoName',
        label: 'Pseudo Name',
        render: (row) => cell(row.pseudoName),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => (canShowMobile ? cell(row.mobile) : '*********'),
      },
      {
        id: 'role',
        label: 'Role',
        render: (row) => {
          const role = displaySubadminReportValue(row.role);
          if (!role) return '—';
          return <Chip size="small" label={role} variant="outlined" sx={{ fontWeight: 700 }} />;
        },
      },
      {
        id: 'login',
        label: 'Login',
        render: (row) => formatSubadminLoginLabel(row) || '—',
      },
      {
        id: 'automaticLogout',
        label: 'Automatic Logout',
        render: (row) => cell(row.automaticLogoutTime),
      },
      {
        id: 'session',
        label: 'Session',
        render: (row) => {
          const duration = displaySubadminReportValue(row.sessionDuration);
          if (!duration) return '—';
          return (
            <Typography component="span" color="warning.main" fontWeight={700} variant="body2">
              {duration}
            </Typography>
          );
        },
      },
      {
        id: 'nextLogin',
        label: 'Next Login',
        render: (row) => cell(row.nextLoginTime),
      },
      {
        id: 'subAdminId',
        label: 'SubAdmin Id',
        render: (row) => (
          <Typography
            component="span"
            variant="caption"
            sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          >
            {cell(row.subAdminId)}
          </Typography>
        ),
      },
    ],
    [canShowMobile, limit, page],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title="Subadmin Report"
        summary={`${startDate} – ${endDate} · Total: ${total.toLocaleString('en-IN')}`}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            sx={{ width: 170 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            sx={{ width: 170 }}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(limit)}
            onChange={(e) => {
              setLimit(Number(e.target.value) || 50);
              setPage(1);
            }}
            sx={{ width: 150 }}
          >
            {SUBADMIN_REPORT_PAGE_SIZES.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyFilters}
            disabled={loading}
            sx={{ fontWeight: 700 }}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => void load(page)}
            disabled={loading}
            sx={{ fontWeight: 700 }}
          >
            Refresh
          </Button>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`Total ${total.toLocaleString('en-IN')}`}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Showing ${range.start}–${range.end}`}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Page ${total === 0 ? 0 : page} / ${total === 0 ? 0 : totalPages}`}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          total > 0 ? (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              width="100%"
              flexWrap="wrap"
              useFlexGap
              spacing={1}
            >
              <Typography variant="body2" color="text.secondary" fontWeight={700}>
                Showing {range.start}–{range.end} of {total.toLocaleString('en-IN')}
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                color="secondary"
                size="small"
                onChange={(_e, nextPage) => setPage(nextPage)}
              />
            </Stack>
          ) : undefined
        }
        footerJustify="space-between"
      >
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, index) => `${row.subAdminId || 'row'}-${index}`}
          loading={loading}
          emptyMessage="No records found — try a different date range and Apply"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
