import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  normalizeBeneAccountCountSummary,
  type BeneAccountCountItem,
} from '@astro/shared/beneficiaryAccountCounts';
import { secureApi } from '@/api/secureClient';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';

type Props = {
  open: boolean;
  onClose: () => void;
};

const headCellSx = {
  fontWeight: 700,
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
  bgcolor: 'background.paper',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

const bodyCellSx = {
  fontSize: 13,
  py: 1.25,
  borderColor: 'divider',
};

/** Total Bene List — Laxmi `/User/beneficiary-accounts-user-count` modal. */
export function TotalBeneListDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalUsersWithAny, setTotalUsersWithAny] = useState(0);
  const [items, setItems] = useState<BeneAccountCountItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const res = await secureApi('withdrawals.beneficiaryAccountsUserCount', {});
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load beneficiary list');
          setItems([]);
          setTotalAccounts(0);
          setTotalUsersWithAny(0);
          return;
        }
        const summary = normalizeBeneAccountCountSummary(res.data);
        setTotalAccounts(summary.totalAccounts);
        setTotalUsersWithAny(summary.totalUsersWithAny);
        setItems(summary.items);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load beneficiary list');
          setItems([]);
          setTotalAccounts(0);
          setTotalUsersWithAny(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2,
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1.5, fontWeight: 700, fontSize: 18 }}>
        Total Bene List
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 1, pt: 0 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" py={6}>
            <CircularProgress size={32} />
          </Stack>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={3}
              flexWrap="wrap"
              useFlexGap
              sx={{
                mb: 2,
                px: 1.5,
                py: 1.25,
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 13 }}>
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>
                  Total Accounts:
                </Typography>{' '}
                {totalAccounts}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 13 }}>
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>
                  Total Users With Any:
                </Typography>{' '}
                {totalUsersWithAny}
              </Typography>
            </Stack>

            <TableContainer sx={{ maxHeight: '52vh', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ ...headCellSx, width: 56 }}>
                      SR
                    </TableCell>
                    <TableCell align="left" sx={{ ...headCellSx, minWidth: 180 }}>
                      Beneficiary Account
                    </TableCell>
                    <TableCell align="right" sx={{ ...headCellSx, width: 110 }}>
                      User Count
                    </TableCell>
                    <TableCell align="right" sx={{ ...headCellSx, width: 160 }}>
                      Pending Withdrawal Count
                    </TableCell>
                    <TableCell align="right" sx={{ ...headCellSx, width: 170 }}>
                      Approved Withdrawal Count
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length > 0 ? (
                    items.map((row, index) => (
                      <TableRow
                        key={`${row.beneficiaryAccount}-${index}`}
                        hover
                        sx={{ '&:last-child td': { borderBottom: 0 } }}
                      >
                        <TableCell align="center" sx={bodyCellSx}>
                          {index + 1}
                        </TableCell>
                        <TableCell align="left" sx={{ ...bodyCellSx, fontWeight: 500 }}>
                          {row.beneficiaryAccount || '—'}
                        </TableCell>
                        <TableCell align="right" sx={bodyCellSx}>
                          {row.userCount}
                        </TableCell>
                        <TableCell align="right" sx={bodyCellSx}>
                          {row.pendingWithdrawalCount}
                        </TableCell>
                        <TableCell align="right" sx={bodyCellSx}>
                          {row.approvedWithdrawalCount}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ ...bodyCellSx, py: 4, color: 'text.secondary' }}>
                        No beneficiary data found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ ...orangeBtnSx, height: 36, minWidth: 96 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
