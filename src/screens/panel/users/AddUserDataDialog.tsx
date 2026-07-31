import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { secureApi } from '@/api/secureClient';

type Props = {
  open: boolean;
  uploader: { _id?: string; name?: string } | null | undefined;
  onClose: () => void;
};

function cleanNumber(input: unknown): string | null {
  if (input == null) return null;
  let num = String(input).replace(/\D/g, '');
  if (num.startsWith('91') && num.length > 10) num = num.slice(2);
  if (num.length > 10) num = num.slice(-10);
  return num.length === 10 ? num : null;
}

const orangeBtnSx = {
  bgcolor: '#f1a144',
  color: '#000',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  px: 2.5,
  '&:hover': { bgcolor: '#e09030' },
};

/** Port of laxminarayan MobileExtractorModal — MUI dialog matching Users page. */
export function AddUserDataDialog({ open, uploader, onClose }: Props) {
  const [company, setCompany] = useState('');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCompany('');
    setNumbers([]);
    setFileName('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    setFileName(file.name);
    try {
      if (
        name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        name.endsWith('.csv')
      ) {
        const buf = await file.arrayBuffer();
        const workbook = XLSX.read(buf, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const keys = ['mobile', 'phone', 'contact', 'number', 'numbers'];
        const result: string[] = [];
        rows.forEach((row) => {
          Object.keys(row).forEach((key) => {
            const k = key.toLowerCase();
            if (keys.some((x) => k.includes(x))) {
              const cleaned = cleanNumber(row[key]);
              if (cleaned) result.push(cleaned);
            }
          });
        });
        const unique = [...new Set(result)];
        setNumbers(unique);
        toast.success(`${unique.length} numbers extracted`);
        return;
      }
      toast.error('Upload .xlsx / .xls / .csv');
    } catch {
      toast.error('Failed to parse file');
    }
  };

  const handleUpload = async () => {
    if (!company.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!numbers.length) {
      toast.error('No mobile numbers to upload');
      return;
    }
    setLoading(true);
    try {
      const res = await secureApi('users.companyContacts', {
        nameOfCompany: company.trim(),
        mobileNumbers: numbers,
        uploadedBy: { _id: uploader?._id, name: uploader?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Upload failed');
        return;
      }
      toast.success(`${numbers.length} records pushed successfully`);
      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Add User Data</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Company name"
            placeholder="Enter company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" mb={0.75}>
              Excel / CSV (column: mobile / phone / contact)
            </Typography>
            <Button variant="outlined" component="label" fullWidth sx={{ py: 1.25 }}>
              {fileName || 'Choose file'}
              <input
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Box>
          <Typography variant="body2">
            Extracted numbers:{' '}
            <Box component="strong" sx={{ color: '#f1a144' }}>
              {numbers.length}
            </Box>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={loading}
          sx={{ minWidth: 100 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleUpload()}
          disabled={loading}
          sx={{ ...orangeBtnSx, minWidth: 110 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? 'Uploading…' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
