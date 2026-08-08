import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { display } from '@/screens/panel/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type BetConstructRow = {
  gameId: string;
  Name?: string;
  category?: string;
  allowedCurrency?: string[];
  subCategory?: string;
  providerName?: string;
  provider?: { name?: string; id?: string };
  rating?: number;
  ratingCount?: number;
  status?: boolean;
  images?: Array<{ url?: string }>;
  updatedOn?: string;
  [key: string]: unknown;
};

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: '#1a1a1f', fontSize: 12 },
};

const headerFieldSx = {
  minWidth: 180,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
  '&:hover': { bgcolor: '#e08c00' },
};

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

export function BetConstructGamesPage() {
  useRevealCodes();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [nameSearch, setNameSearch] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [rows, setRows] = useState<BetConstructRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [activeGameId, setActiveGameId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { next, begin, end, isCurrent } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, nameOverride = appliedName) => {
      const gen = next();
      begin();
      setLoading(true);
      setError(null);
      try {
        const payload: Record<string, unknown> = {
          pageNo,
          itemPerPage: pageSize,
          status: true,
        };
        const name = nameOverride.trim();
        if (name) payload.Name = name;

        const res = await secureApi('ops.betConstructGetAll', payload);
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          const msg = res.message || 'Failed to load BetConstruct games';
          setError(msg);
          toast.error(msg);
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const data = (res.data || {}) as {
          games?: BetConstructRow[];
          count?: number;
        };
        const list = Array.isArray(data.games) ? data.games : [];
        const count = Number(data.count ?? list.length) || 0;
        startTransition(() => {
          setRows(list);
          setTotal(count);
          setTotalPages(Math.max(1, Math.ceil(count / pageSize) || 1));
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, pageSize, appliedName, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const deferredRows = useDeferredValue(rows);

  const search = useCallback(() => {
    setAppliedName(nameSearch);
    setPage(1);
    void load(1, nameSearch);
  }, [nameSearch, load]);

  const openImageDialog = useCallback((row: BetConstructRow) => {
    setActiveGameId(row.gameId);
    setImageUrl('');
    setImageDialogOpen(true);
  }, []);

  const closeImageDialog = useCallback(() => {
    setImageDialogOpen(false);
    setImageUrl('');
    setActiveGameId('');
  }, []);

  const handleUpdateImage = useCallback(async () => {
    if (!imageUrl.trim()) {
      toast.error('Please add image URL');
      return;
    }
    if (!activeGameId) {
      toast.error('Please select a proper game');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('ops.betConstructUpdateImage', {
        gameId: activeGameId,
        url: imageUrl.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update image');
        return;
      }
      toast.success('Image updated');
      closeImageDialog();
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [imageUrl, activeGameId, closeImageDialog, load]);

  const columns = useMemo<CommonTableColumn<BetConstructRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <ColumnSearch
            value={nameSearch}
            onChange={setNameSearch}
            onSearch={search}
            placeholder="Search by Game name"
          />
        ),
        render: (row) => row.Name || '—',
      },
      { id: 'category', label: 'Category', render: (row) => display(row.category) },
      {
        id: 'allowedCurrency',
        label: 'Allowed Currency',
        render: (row) =>
          Array.isArray(row.allowedCurrency) ? row.allowedCurrency.join(', ') : '—',
      },
      { id: 'subCategory', label: 'Sub Category', render: (row) => display(row.subCategory) },
      { id: 'gameId', label: 'Game Id', render: (row) => row.gameId },
      { id: 'providerName', label: 'Provider Name', render: (row) => display(row.providerName) },
      {
        id: 'providerDetails',
        label: 'Provider Details',
        render: (row) => (
          <Stack spacing={0.25} alignItems="center">
            <Typography variant="caption" color="inherit">
              Name:- {row.provider?.name || '—'}
            </Typography>
            <Typography variant="caption" color="inherit">
              ID:- {row.provider?.id || '—'}
            </Typography>
          </Stack>
        ),
      },
      { id: 'rating', label: 'Rating', render: (row) => row.rating ?? '—' },
      { id: 'ratingCount', label: 'Rating Count', render: (row) => row.ratingCount ?? '—' },
      {
        id: 'status',
        label: 'Status',
        render: (row) => <Switch checked={Boolean(row.status)} color="warning" size="small" disabled />,
      },
      {
        id: 'images',
        label: 'Images',
        render: (row) => (
          <Stack spacing={0.75} alignItems="center">
            <Box
              component="img"
              src={row.images?.[2]?.url ?? ''}
              alt={row.Name || 'Game'}
              sx={{
                height: 48,
                width: 64,
                objectFit: 'cover',
                borderRadius: 1,
                bgcolor: '#121218',
              }}
            />
            <Button
              size="small"
              variant="contained"
              startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
              onClick={() => openImageDialog(row)}
              sx={{ ...orangeBtnSx, fontSize: 11, px: 1.25, py: 0.25, minHeight: 28 }}
            >
              Upload
            </Button>
          </Stack>
        ),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (row) =>
          row.updatedOn
            ? `${formatDisplayDate(row.updatedOn)}-${formatDisplayTime(row.updatedOn)}`
            : '—',
      },
    ],
    [page, pageSize, nameSearch, search, openImageDialog],
  );

  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {toDisplayText('BetConstruct Games')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: '#e8e8ea',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#ff9f0a',
              bgcolor: 'rgba(255,159,10,0.08)',
            },
          }}
        >
          Refresh
        </Button>
      </Stack>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, minWidth: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
          <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ alignSelf: 'center' }}>
            Total Count: {total}
          </Typography>
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, i) => row.gameId || i}
        loading={loading}
        emptyMessage="No games found"
        stickyHeader
        dense
        minWidth={1600}
        maxHeight="calc(100vh - 360px)"
      />

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={Math.max(1, totalPages)}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
          disabled={loading}
        />
      </Stack>

      <Dialog open={imageDialogOpen} onClose={closeImageDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Add Img URL</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImageDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUpdateImage()}
            disabled={submitting}
            sx={orangeBtnSx}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
