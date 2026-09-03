import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import {
  collectColumns,
  defaultFraudEndDate,
  defaultFraudStartDate,
  extractList,
  formatColumnLabel,
  renderAaaCell,
} from '@/screens/panel/aaa/aaaReportHelpers';

const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];
const LIMIT_OPTIONS = ['10', '25', '50', '100', '200'];

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function AAAFraudBetReportPage() {
  const [startDate, setStartDate] = useState(defaultFraudStartDate);
  const [endDate, setEndDate] = useState(defaultFraudEndDate);
  const [status, setStatus] = useState('All');
  const [limit, setLimit] = useState('10');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<unknown>('aaa.fraudBetsReport', {
        startDate,
        endDate,
        status: status || 'All',
        limit: String(limit || 10),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to fetch fraud bets report');
        setRows([]);
        return;
      }
      setRows(extractList(res.data));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, status, limit]);

  useEffect(() => {
    void load();
    // initial load only — Apply button for filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columnsKeys = useMemo(() => collectColumns(rows), [rows]);

  const columns: CommonTableColumn<Record<string, unknown>>[] = useMemo(() => {
    const sr: CommonTableColumn<Record<string, unknown>> = {
      id: 'sr',
      label: 'Sr No',
      width: 64,
      render: (_row, index) => index + 1,
    };
    const dynamic = columnsKeys.map((col) => ({
      id: col,
      label: formatColumnLabel(col),
      render: (row: Record<string, unknown>) => renderAaaCell(col, row?.[col], setPreviewImage),
    }));
    return [sr, ...dynamic];
  }, [columnsKeys]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          AAA Fraud Bet Report
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.5}
        alignItems="center"
        sx={{
          mb: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <TextField
          label="Start Date"
          type="datetime-local"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          sx={{ width: 220 }}
        />
        <TextField
          label="End Date"
          type="datetime-local"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          sx={{ width: 220 }}
        />
        <Autocomplete
          freeSolo
          options={STATUS_OPTIONS}
          value={status}
          onChange={(_e, v) => setStatus(v || 'All')}
          onInputChange={(_e, v) => setStatus(v)}
          sx={{ width: 160 }}
          renderInput={(params) => <TextField {...params} label="Status" size="small" />}
        />
        <Autocomplete
          freeSolo
          options={LIMIT_OPTIONS}
          value={limit}
          onChange={(_e, v) => setLimit(v || '10')}
          onInputChange={(_e, v) => setLimit(v)}
          sx={{ width: 120 }}
          renderInput={(params) => <TextField {...params} label="Limit" size="small" />}
        />
        <Button size="small" variant="contained" onClick={() => void load()} sx={orangeBtnSx}>
          Apply
        </Button>
      </Stack>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          getRowKey={(row, index) => String(row._id || row.id || row.userId || index)}
          emptyMessage="No fraud bets found for the selected filters."
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="md">
        <DialogContent sx={{ position: 'relative', p: 1 }}>
          <IconButton
            size="small"
            onClick={() => setPreviewImage(null)}
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
          >
            <CloseIcon />
          </IconButton>
          {previewImage ? (
            <img
              src={previewImage}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
