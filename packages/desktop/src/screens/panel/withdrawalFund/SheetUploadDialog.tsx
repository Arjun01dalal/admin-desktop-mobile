import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { orangeBtnSx, unpackPayload } from '@/screens/panel/transactions/shared';

type Props = {
  open: boolean;
  startDate: string;
  endDate: string;
  gateway: string;
  mid: string;
  onClose: () => void;
  onDone?: () => void;
};

function cleanKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

const columnMap: Record<string, string[]> = {
  Name: ['name', 'beneficiaryname', 'beneficiary', 'accountholder'],
  Number: ['number', 'phone', 'mobile', 'contact'],
  Amount: ['amount', 'amt', 'value'],
  'Ac No': ['accountno', 'accno', 'accountnumber'],
  IFSC: ['ifsc', 'ifsccode'],
  TxnID: ['txnid', 'transactionid', 'utr', 'upi transaction id', 'upitransactionid'],
};

function normalizeRow(row: Record<string, unknown>) {
  const newRow: Record<string, string> = {};
  Object.keys(row).forEach((key) => {
    const cleanedKey = cleanKey(key);
    for (const field of Object.keys(columnMap)) {
      const match = columnMap[field].some((col) => cleanedKey === cleanKey(col));
      if (match && !newRow[field]) {
        newRow[field] = String(row[key] ?? '');
      }
    }
  });
  return newRow;
}

/** Upload bank statement sheet & run comparison (old FileUploadModal, excel/csv). */
export function SheetUploadDialog({
  open,
  startDate,
  endDate,
  gateway,
  mid,
  onClose,
  onDone,
}: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const summary = useMemo(() => {
    if (!result) return null;
    const s = (result.summary || result) as Record<string, unknown>;
    return s;
  }, [result]);

  const reset = () => {
    setRows([]);
    setResult(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (data == null) return;
        const isCSV = file.name.toLowerCase().endsWith('.csv');
        const workbook = XLSX.read(data, { type: isCSV ? 'string' : 'array' });
        let finalData: Record<string, string>[] = [];
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: '',
            raw: false,
          });
          finalData = [...finalData, ...jsonData.map(normalizeRow)];
        });
        setRows(finalData);
        setResult(null);
        toast.success(`Loaded ${finalData.length} rows`);
      } catch {
        toast.error('Failed to read file');
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const submit = async () => {
    if (!gateway || !mid) {
      toast.warn('Gateway / Mid missing');
      return;
    }
    if (!rows.length) {
      toast.warn('Upload a sheet first');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('withdrawalFund.sheetComparison', {
        withdrawalSheet: rows,
        startDate,
        endDate,
        gatewayName: gateway,
        mid,
      });
      if (!res.ok) {
        toast.error(res.message || 'Comparison failed');
        return;
      }
      const body = unpackPayload(res.data);
      setResult(body);
      toast.success(res.message || 'Comparison done');
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { bgcolor: '#1a1a1f', borderRadius: 2 } }}
    >
      <DialogTitle>Upload File</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Gateway: <b style={{ color: '#ff9f0a' }}>{gateway || '—'}</b>
            {' · '}
            Mid: <b style={{ color: '#ff9f0a' }}>{mid || '—'}</b>
          </Typography>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
            Choose Excel / CSV
            <input
              hidden
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </Button>
          <Typography variant="body2" color="text.secondary">
            Rows loaded: {rows.length}
          </Typography>

          {summary ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: '#121218',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Comparison result
              </Typography>
              <Typography variant="body2">
                Matched: {String(summary.bothInSheetAndDbCount ?? '—')}
              </Typography>
              <Typography variant="body2">
                In system not in sheet: {String(summary.dbButNotInSheetCount ?? '—')}
              </Typography>
              <Typography variant="body2">
                In sheet not in system: {String(summary.sheetButNotInDbCount ?? '—')}
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Close
        </Button>
        <Button
          variant="contained"
          disabled={saving || !rows.length}
          onClick={() => void submit()}
          sx={orangeBtnSx}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Validate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
