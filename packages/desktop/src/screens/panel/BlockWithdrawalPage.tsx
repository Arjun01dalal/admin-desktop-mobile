import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  formatWithdrawalDate,
  formatWithdrawalMoney,
  isFullWithdrawalBlock,
  normalizeWithdrawalBlockRows,
  parseWithdrawalAmount,
  type WithdrawalBlockAddMode,
  type WithdrawalBlockEditMode,
  type WithdrawalBlockItem,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, CopyText, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useReportQuery } from '@/screens/panel/shared';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const headerFieldSx = {
  width: 220,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const PER_PAGE_OPTIONS = [20, 50, 100, 200];

const modeBtnSx = (active: boolean, danger = false) => ({
  textTransform: 'none' as const,
  fontWeight: 700,
  borderColor: active
    ? danger
      ? '#ef4444'
      : '#ff9f0a'
    : 'rgba(255,255,255,0.2)',
  color: active ? (danger ? '#fecaca' : '#ffd28a') : '#c8cdd8',
  bgcolor: active
    ? danger
      ? 'rgba(239,68,68,0.12)'
      : 'rgba(255,159,10,0.12)'
    : 'transparent',
});

export function BlockWithdrawalPage() {
  const [userIdDraft, setUserIdDraft] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addMode, setAddMode] = useState<WithdrawalBlockAddMode>('limit');

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<WithdrawalBlockItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMode, setEditMode] = useState<WithdrawalBlockEditMode>('update');
  const [saving, setSaving] = useState(false);

  const { rows, total, totalPages, loading, error, load } = useReportQuery<WithdrawalBlockItem>({
    action: 'ops.withdrawalBlockGetAll',
    buildPayload: () => ({
      pageNo: page,
      itemsPerPage: pageSize,
      filter: { userId: appliedUserId.trim() },
    }),
    unpack: (res) => normalizeWithdrawalBlockRows(res.data),
    autoDeps: [page, pageSize, appliedUserId],
    errorMessage: 'Failed to load withdrawal blocks',
  });

  const openAdd = useCallback(() => {
    setAddUserId('');
    setAddAmount('');
    setAddMode('limit');
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((item: WithdrawalBlockItem) => {
    setEditItem(item);
    setEditMode(isFullWithdrawalBlock(item.amount) ? 'full' : 'update');
    setEditAmount(isFullWithdrawalBlock(item.amount) ? '' : String(item.amount ?? ''));
    setEditOpen(true);
  }, []);

  const handleAdd = useCallback(async () => {
    const userId = addUserId.trim();
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    const body: { userId: string; amount?: number } = { userId };
    if (addMode === 'limit') {
      const amount = parseWithdrawalAmount(addAmount);
      if (amount === null || Number.isNaN(amount)) {
        toast.error('Enter a valid amount (0 or more)');
        return;
      }
      body.amount = amount as number;
    }
    setSaving(true);
    try {
      const res = await secureApi('ops.withdrawalBlockAdd', body);
      if (!res.ok) {
        toast.error(res.message || 'Failed to add block');
        return;
      }
      toast.success(addMode === 'full' ? 'Full withdrawal block added' : 'Withdrawal limit added');
      setAddOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  }, [addUserId, addAmount, addMode, load]);

  const handleEdit = useCallback(async () => {
    if (!editItem?.userId) return;
    let body: { userId: string; action: 'update' | 'remove'; amount?: number | null };
    if (editMode === 'remove') {
      body = { userId: editItem.userId, action: 'remove' };
    } else if (editMode === 'full') {
      body = { userId: editItem.userId, action: 'update', amount: null };
    } else {
      const amount = parseWithdrawalAmount(editAmount);
      if (amount === null || Number.isNaN(amount)) {
        toast.error('Enter a valid amount (0 or more)');
        return;
      }
      body = { userId: editItem.userId, action: 'update', amount: amount as number };
    }
    setSaving(true);
    try {
      const res = await secureApi('ops.withdrawalBlockEdit', body);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update block');
        return;
      }
      toast.success(
        editMode === 'remove'
          ? 'Withdrawal restriction removed'
          : editMode === 'full'
            ? 'Updated to full block'
            : 'Withdrawal limit updated',
      );
      setEditOpen(false);
      setEditItem(null);
      void load();
    } finally {
      setSaving(false);
    }
  }, [editItem, editMode, editAmount, load]);

  const columns = useMemo<CommonTableColumn<WithdrawalBlockItem>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 48,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'user',
        label: 'User',
        align: 'left',
        width: 240,
        cellSx: { textAlign: 'left' },
        render: (row) => (
          <Box sx={{ textAlign: 'left' }}>
            <CopyText value={row.userId} breakAll />
            {(row.userName || row.name) && (
              <Typography sx={{ color: '#9aa3b5', fontSize: 12, mt: 0.25 }}>
                {row.userName || row.name}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        width: 130,
        render: (row) => {
          const full = isFullWithdrawalBlock(row.amount);
          return (
            <Chip
              size="small"
              label={full ? 'Full Block' : 'Amount Limit'}
              sx={{
                height: 24,
                fontWeight: 700,
                fontSize: 11,
                color: full ? '#fca5a5' : '#6ee7b7',
                bgcolor: full ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)',
                border: '1px solid',
                borderColor: full ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)',
              }}
            />
          );
        },
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 120,
        render: (row) =>
          isFullWithdrawalBlock(row.amount) ? (
            <Typography sx={{ color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>
              All blocked
            </Typography>
          ) : (
            <Typography sx={{ color: '#e8e8ea', fontWeight: 700, fontSize: 13 }}>
              ₹{formatWithdrawalMoney(row.amount)}
            </Typography>
          ),
      },
      {
        id: 'updated',
        label: 'Updated',
        width: 150,
        render: (row) => (
          <Typography sx={{ color: '#9aa3b5', fontSize: 12 }}>
            {formatWithdrawalDate(row.updatedAt || row.createdAt)}
          </Typography>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        width: 88,
        render: (row) => (
          <Button
            size="small"
            startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => openEdit(row)}
            sx={{ textTransform: 'none', color: '#ff9f0a' }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [page, pageSize, openEdit],
  );

  const dialogPaper = {
    bgcolor: '#14141c',
    backgroundImage: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 2,
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title="Block Withdrawal"
        summary={`${total.toLocaleString('en-IN')} restrictions`}
        headerActions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={(e) => {
                e.stopPropagation();
                void load();
              }}
              disabled={loading || saving}
              sx={{ textTransform: 'none', color: '#e8e8ea', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.stopPropagation();
                openAdd();
              }}
              sx={{ ...orangeBtnSx, px: 1.75 }}
            >
              Block Withdrawal
            </Button>
          </Stack>
        }
      >
        <Typography sx={{ color: '#9aa3b5', fontSize: 13, mb: 1.5 }}>
          Limit or fully block withdrawals for a user.
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" useFlexGap sx={{ minWidth: 'max-content' }}>
          <TextField
            label="User ID"
            size="small"
            placeholder="Search by user ID"
            value={userIdDraft}
            onChange={(e) => setUserIdDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setAppliedUserId(userIdDraft.trim());
                setPage(1);
              }
            }}
            sx={headerFieldSx}
          />
          <TextField
            select
            label="Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, width: 120 }}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={() => {
              setAppliedUserId(userIdDraft.trim());
              setPage(1);
            }}
            sx={{ ...orangeBtnSx, height: 40 }}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setUserIdDraft('');
              setAppliedUserId('');
              setPage(1);
            }}
            sx={{ height: 40, textTransform: 'none', color: '#e8e8ea', borderColor: 'rgba(255,255,255,0.28)' }}
          >
            Clear
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          rows.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ color: '#9aa3b5' }}>
                Page {page} / {Math.max(1, totalPages)}
              </Typography>
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, next) => setPage(next)}
                color="secondary"
                size="small"
              />
            </>
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No withdrawal blocks found"
          getRowKey={(row, i) => row._id || `${row.userId}-${i}`}
          dense
          hover
          stickyHeader
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaper }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Block Withdrawal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography sx={{ color: '#9aa3b5', fontSize: 13 }}>
              Choose an amount limit, or full block (no withdrawals allowed).
            </Typography>
            <TextField
              label="User ID"
              size="small"
              fullWidth
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              placeholder="67b…"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setAddMode('limit')} sx={modeBtnSx(addMode === 'limit')}>
                Amount Limit
              </Button>
              <Button
                variant="outlined"
                onClick={() => setAddMode('full')}
                sx={modeBtnSx(addMode === 'full', true)}
              >
                Full Block
              </Button>
            </Stack>
            {addMode === 'limit' ? (
              <TextField
                label="Amount"
                size="small"
                fullWidth
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving} sx={{ textTransform: 'none', color: '#9aa3b5' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleAdd()} disabled={saving} sx={{ ...orangeBtnSx, minWidth: 120 }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Block'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaper }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Withdrawal Block</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography sx={{ color: '#9aa3b5', fontSize: 13 }}>
              User: <Box component="span" sx={{ color: '#e8e8ea', fontWeight: 700 }}>{editItem?.userId}</Box>
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" onClick={() => setEditMode('update')} sx={modeBtnSx(editMode === 'update')}>
                Update Amount
              </Button>
              <Button variant="outlined" onClick={() => setEditMode('full')} sx={modeBtnSx(editMode === 'full')}>
                Full Block
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditMode('remove')}
                sx={modeBtnSx(editMode === 'remove', true)}
              >
                Remove
              </Button>
            </Stack>
            {editMode === 'update' ? (
              <TextField
                label="Amount"
                size="small"
                fullWidth
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
              />
            ) : null}
            {editMode === 'full' ? (
              <Typography sx={{ color: '#9aa3b5', fontSize: 13 }}>
                Sets amount to null — user cannot withdraw at all.
              </Typography>
            ) : null}
            {editMode === 'remove' ? (
              <Typography sx={{ color: '#9aa3b5', fontSize: 13 }}>
                Removes the withdrawal restriction for this user.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} disabled={saving} sx={{ textTransform: 'none', color: '#9aa3b5' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleEdit()}
            disabled={saving}
            sx={{
              ...orangeBtnSx,
              minWidth: 140,
              ...(editMode === 'remove'
                ? { bgcolor: '#dc2626', color: '#fff', '&:hover': { bgcolor: '#b91c1c' } }
                : null),
            }}
          >
            {saving ? (
              <CircularProgress size={18} color="inherit" />
            ) : editMode === 'remove' ? (
              'Remove Restriction'
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
