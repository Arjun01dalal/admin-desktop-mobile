import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission } from '@/auth/permissions';
import { formatAmount } from '@/utils/dates';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { UpdateCoinDialog } from './pointsReport/UpdateCoinDialog';
import { usePointsReportQuery } from './pointsReport/usePointsReportQuery';
import type { PointsReportRow } from './pointsReport/types';

export function PointsReportPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { rows, loading, load } = usePointsReportQuery(startDate, endDate);
  const deferredRows = useDeferredValue(rows);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const openDocs = useCallback(
    (row: PointsReportRow) => {
      navigate('/coin-reports/report', {
        state: { docs: row.documents || [] },
      });
    },
    [navigate],
  );

  const totalBalanceGiven = useMemo(
    () =>
      deferredRows.reduce(
        (sum, row) => sum + (Number(row.totalBalanceGiven) || 0),
        0,
      ),
    [deferredRows],
  );

  const columns = useMemo<CommonTableColumn<PointsReportRow>[]>(
    () => [
      {
        id: 'pseudo',
        label: 'Pseudo Name',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openDocs(row)}
            sx={{ cursor: 'pointer', fontWeight: 600 }}
          >
            {row.subadminName || '—'}
          </Box>
        ),
      },
      {
        id: 'realName',
        label: 'Real-Name',
        render: (row) => (
          <Box
            component="span"
            onClick={() => openDocs(row)}
            sx={{ cursor: 'pointer' }}
          >
            {row.realName || '—'}
          </Box>
        ),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
            <span>{canShowMobile ? row.subadminMobile || '—' : '**********'}</span>
            <IconButton
              size="small"
              aria-label="Edit coin limit"
              onClick={(e) => {
                e.stopPropagation();
                setEditUserId(row._id);
                setDialogOpen(true);
              }}
              sx={{ color: '#ff9f0a' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'creditCount',
        label: 'Credit Count',
        render: (row) => row.creditCount ?? 0,
      },
      {
        id: 'totalBalanceGiven',
        label: 'Total Balance Give',
        render: (row) => formatAmount(row.totalBalanceGiven ?? 0),
      },
      {
        id: 'debitCount',
        label: 'Debit Count',
        render: (row) => row.debitCount ?? 0,
      },
      {
        id: 'totalBalanceRemove',
        label: 'Total Balance Remove',
        render: (row) => formatAmount(row.totalBalanceRemove ?? 0),
      },
    ],
    [canShowMobile, openDocs],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title="Points Report"
        summary={startDate && endDate ? `${startDate} – ${endDate}` : undefined}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
          <TextField
            type="date"
            label="Start Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170, flexShrink: 0 }}
          />
          <TextField
            type="date"
            label="End Date"
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
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={() => void load()}
            disabled={loading}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          >
            Refresh
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          deferredRows.length > 0 ? (
            <Typography fontWeight={700} color="text.secondary">
              Total Balance Give: {formatAmount(totalBalanceGiven)}
            </Typography>
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row) => row._id}
          loading={loading}
          emptyMessage="No data available"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>

      <UpdateCoinDialog
        open={dialogOpen}
        userId={editUserId}
        onClose={() => {
          setDialogOpen(false);
          setEditUserId('');
        }}
        onSuccess={() => void load()}
      />
    </Box>
  );
}
