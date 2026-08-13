import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import {
  collectColumns,
  extractList,
  formatColumnLabel,
  renderAaaCell,
} from '@/screens/panel/aaa/aaaReportHelpers';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function AAABlacklistedUsersPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<unknown>('aaa.blacklistedUsers', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to fetch blacklisted users');
        setRows([]);
        return;
      }
      setRows(extractList(res.data));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      render: (row: Record<string, unknown>) =>
        renderAaaCell(col, row?.[col], setPreviewImage),
    }));
    return [sr, ...dynamic];
  }, [columnsKeys]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" fontWeight={700}>
          AAA Black Listed Users
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

      <CommonTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row, index) =>
          String(row._id || row.id || row.userId || index)
        }
        emptyMessage="No blacklisted users found."
      />

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
