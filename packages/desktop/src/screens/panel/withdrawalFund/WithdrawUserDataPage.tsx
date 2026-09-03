import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission } from '@/auth/permissions';
import { formatAmount, formatDisplayDate, formatDisplayTime, getStoredUser } from '@/utils/dates';
import { display } from '@/screens/panel/shared';
import {
  orangeBtnSx,
  actionBtnSx,
  chipSx,
  toolbarBoxSx,
} from '@/screens/panel/transactions/shared';
import { pickDocList, type WithdrawalDoc } from './types';

type LocationState = {
  name?: string;
  mid?: string;
  providerName?: string;
  totalAmount?: number;
  totalApprovedAmount?: number;
  lockCount?: number;
  withdrawals?: WithdrawalDoc[];
  list?: WithdrawalDoc[];
  type?: string;
  key?: string;
  record?: Record<string, unknown>;
};

type ActionInfo = {
  name?: string;
  status?: string | boolean;
  date?: string;
};

function actionOf(row: WithdrawalDoc): ActionInfo | null {
  const a = row.action;
  if (!a || typeof a !== 'object') return null;
  return a as ActionInfo;
}

function istDateTime(utcDate?: string): string {
  if (!utcDate) return '';
  const dateObj = new Date(utcDate);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Agent / MID withdrawal list (old WithdrawUserData columns). */
export function WithdrawUserDataPage() {
  const location = useLocation();
  const state = useMemo(() => (location.state || {}) as LocationState, [location.state]);
  const admin = getStoredUser<{ serverId?: string | number }>();
  const canShowMobile = hasPermission('show_mobile');

  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [commentRow, setCommentRow] = useState<WithdrawalDoc | null>(null);

  const rows = useMemo(() => {
    if (state.type === 'filterRecord' && state.key) {
      const record = state.record || {};
      const nested =
        record.payload && typeof record.payload === 'object'
          ? (record.payload as Record<string, unknown>)
          : record;
      const list = nested[state.key];
      if (Array.isArray(list)) return list as WithdrawalDoc[];
      return [];
    }
    if (Array.isArray(state.withdrawals) && state.withdrawals.length) {
      return state.withdrawals;
    }
    if (Array.isArray(state.list) && state.list.length) return state.list;
    return pickDocList(state);
  }, [state]);

  const title =
    state.name ||
    state.mid ||
    state.providerName ||
    (state.type === 'filterRecord' ? String(state.key || 'Records') : 'Withdrawal User Data');

  const totalAmt = state.totalAmount ?? state.totalApprovedAmount ?? 0;
  const providerLabel = state.mid || state.providerName || state.name || display(state.record?.mid);

  const dialerCall = useCallback(
    async (item: WithdrawalDoc) => {
      try {
        const res = await secureApi('callLogs.externalDialerBatch', {
          campaignId: 'WDL1',
          listId: '990001',
          listName: 'Withdrawal Campaign1',
          serverId: admin?.serverId,
          leads: [
            {
              first_name: item?.name || item?.accountHolderName || item?.userName,
              phone_number: item?.mobile || item?.userMobile,
              city: item?.city,
              state: item?.state,
              email: item?.clientName,
              comments: item?.clientName,
              province: item?._id,
            },
          ],
        });
        if (!res.ok) {
          toast.error(res.message || 'API request failed');
          return;
        }
        toast.success(res.message || 'Data sent successfully');
      } catch {
        toast.error('API request failed');
      }
    },
    [admin?.serverId],
  );

  const columns = useMemo<CommonTableColumn<WithdrawalDoc>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 48,
        render: (_r, i) => i + 1,
      },
      {
        id: 'accountHolderName',
        label: 'Account Holder Name',
        width: 140,
        render: (r) => display(r.accountHolderName || r.userName || r.name),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        width: 90,
        render: (r) => display(r.empCode),
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 90,
        render: (r) => formatAmount(r.amount ?? 0),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        width: 140,
        render: (r) => (
          <Stack spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              {canShowMobile ? display(r.mobile ?? r.userMobile) : '**********'}
            </Typography>
            <Button
              size="small"
              variant="contained"
              sx={{ ...actionBtnSx, fontSize: 10 }}
              onClick={() => void dialerCall(r)}
            >
              Dialer Call
            </Button>
          </Stack>
        ),
      },
      {
        id: 'accountNo',
        label: 'Account No',
        width: 120,
        render: (r) => display(r.accountNo || r.accountNumber),
      },
      {
        id: 'bankName',
        label: 'Bank Name',
        width: 120,
        render: (r) => display(r.bankName || r.userBankName),
      },
      {
        id: 'ifsc',
        label: 'IFCS',
        width: 110,
        render: (r) => display(r.ifscCode || r.ifsc),
      },
      {
        id: 'commissionAmount',
        label: 'Commission Amount',
        width: 110,
        render: (r) => display(r.commissionAmount),
      },
      {
        id: 'dp_id',
        label: 'DP ID',
        width: 110,
        render: (r) => display(r.dp_id),
      },
      {
        id: 'action',
        label: 'Action',
        width: 130,
        render: (r) => {
          const a = actionOf(r);
          if (!a) return '—';
          return (
            <Stack spacing={0.25}>
              <Typography variant="body2" sx={{ fontSize: 11 }}>
                {display(a.name)}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 11 }}>
                {display(a.status)}
              </Typography>
              {a.date ? (
                <Typography variant="caption" color="text.secondary">
                  {istDateTime(a.date)}
                </Typography>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'gatewayName',
        label: 'Given By (Bank Name)',
        width: 130,
        render: (r) => display(r.gatewayName),
      },
      {
        id: 'mid',
        label: 'Mid',
        width: 90,
        render: (r) => display(r.mid),
      },
      {
        id: 'transactionId',
        label: 'Transaction ID',
        width: 140,
        render: (r) => display(r.transactionId || r.orderId),
      },
      {
        id: 'comment',
        label: 'Comment',
        width: 140,
        render: (r) => (
          <Stack spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontSize: 11 }}>
              {display(r.comment)}
            </Typography>
            <Button
              size="small"
              variant="contained"
              sx={{ ...actionBtnSx, fontSize: 10 }}
              onClick={() => {
                setCommentRow(r);
                setComment(String(r.comment || ''));
                setCommentOpen(true);
              }}
            >
              Add Comment
            </Button>
          </Stack>
        ),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        width: 120,
        render: (r) => {
          const d = r.updatedOn || r.createdOn;
          if (!d) return '—';
          return (
            <Stack spacing={0.25}>
              <Typography variant="body2" sx={{ fontSize: 11 }}>
                {formatDisplayDate(String(d)) || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDisplayTime(String(d)) || ''}
              </Typography>
            </Stack>
          );
        },
      },
    ],
    [canShowMobile, dialerCall],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} gap={1}>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
      </Stack>

      <Box sx={toolbarBoxSx}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {state.type !== 'filterRecord' ? (
            <>
              <Chip label={`Total Amount: ${totalAmt}`} sx={chipSx} />
              <Chip label={`Count: ${rows.length}`} sx={chipSx} />
              {state.lockCount != null ? (
                <Chip label={`Lock: ${state.lockCount}`} sx={chipSx} />
              ) : null}
            </>
          ) : (
            <Chip label={`Records: ${rows.length}`} sx={chipSx} />
          )}
          <Chip label={`Provider Name: ${providerLabel}`} sx={chipSx} />
        </Stack>
      </Box>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, index) => String(row._id || row.transactionId || index)}
          loading={false}
          emptyMessage="No withdrawals found"
          stickyHeader
          dense
          minWidth={2200}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Please enter a Valid Comment.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="Enter your comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: '#121218' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCommentOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!comment.trim()}
            onClick={() => {
              // Old panel: TODO API — keep local UX for now
              if (commentRow) {
                commentRow.comment = comment.trim();
              }
              toast.success('Comment added successfully');
              setCommentOpen(false);
              setCommentRow(null);
            }}
            sx={orangeBtnSx}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
