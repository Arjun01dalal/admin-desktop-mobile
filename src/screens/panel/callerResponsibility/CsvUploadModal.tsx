import { useState, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';
import type { StoredCallerUser } from './utils';

type Props = {
  open: boolean;
  onClose: () => void;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CsvUploadModal({ open, onClose }: Props) {
  const user = getStoredUser<StoredCallerUser>();
  const [dateOfData, setDateOfData] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a CSV file first');
      return;
    }
    if (!dateOfData) {
      toast.error('Please select date');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a valid CSV file.');
      return;
    }

    setLoading(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await secureApi('caller.uploadDiallerData', {
        fileBase64,
        fileName: file.name,
        dateOfData,
        uploadedBy: {
          userId: user?._id,
          userName: user?.name,
        },
      });
      if (!res.ok || res.success === false) {
        toast.error(res.message || 'Upload failed');
        return;
      }
      toast.success(res.message || 'Uploaded');
      setFile(null);
      setDateOfData('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Validate Dialler Data</DialogTitle>
      <DialogContent>
        <Typography variant="body2" mb={1}>
          Select Data Date
        </Typography>
        <Box
          component="input"
          type="date"
          value={dateOfData}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setDateOfData(e.target.value)
          }
          sx={{
            width: '100%',
            mb: 2,
            p: 1,
            bgcolor: 'transparent',
            color: 'inherit',
            border: '1px solid rgba(255,255,255,0.24)',
            borderRadius: 1,
          }}
        />
        <Button
          component="label"
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          fullWidth
        >
          {file ? file.name : 'Choose CSV'}
          <input
            hidden
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleUpload()}
          disabled={loading}
        >
          {loading ? <CircularProgress size={18} /> : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
