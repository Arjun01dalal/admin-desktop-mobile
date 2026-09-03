import { useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { formatAmount } from '@/utils/dates';
import { display } from '@/screens/panel/shared';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import {
  buildDepositWithdrawalReportRequest,
  filterWithdrawalRoutingMidRows,
  mergeMidDepositRatioRows,
  mergeMidReportWithCatalog,
  parseDepositWithdrawalMidReport,
  type MergedMidReportRow,
} from '@astro/shared/depositWithdrawalReport';
import { resolveWithdrawalReportUserId } from './logic';
import type { WithdrawalRow } from './types';

type Props = {
  open: boolean;
  row: WithdrawalRow | null;
  catalogMids: string[];
  onClose: () => void;
};

const headCellSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 800,
  fontSize: 12.5,
  whiteSpace: 'nowrap',
  borderBottom: 'none',
  py: 1.25,
} as const;

const bodyCellSx = {
  fontSize: 13,
  borderColor: 'divider',
  py: 1.15,
  verticalAlign: 'middle',
} as const;

export function DepositWithdrawalMidModal({ open, row, catalogMids, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MergedMidReportRow[]>([]);

  const userId = row ? resolveWithdrawalReportUserId(row) : '';
  const userLabel = String(row?.userName || row?.accountHolderName || userId || 'User').trim();
  const requestAmount = Number(row?.amount ?? 0);

  useEffect(() => {
    if (!open || !userId) {
      setRows([]);
      return;
    }

    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await secureApi(
          'depositList.report',
          buildDepositWithdrawalReportRequest(userId),
        );
        if (!active) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load deposit MID report');
          setRows([]);
          return;
        }
        const parsed = parseDepositWithdrawalMidReport(res.data);
        const merged = mergeMidDepositRatioRows(
          parsed.approvedDepositAmountByMid,
          parsed.approvedWithdrawalAmountByMid,
          parsed.depositWithdrawalRatioMidWise,
        );
        setRows(mergeMidReportWithCatalog(catalogMids, merged));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, userId, catalogMids]);

  const routingRows = useMemo(() => filterWithdrawalRoutingMidRows(rows), [rows]);

  const subtitle = useMemo(() => {
    if (!userId) return 'No user selected';
    const parts = [`User Id: ${userId}`];
    if (requestAmount > 0) parts.push(`Withdrawal: ${formatAmount(requestAmount)}`);
    return parts.join(' · ');
  }, [userId, requestAmount]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          py: 1.75,
          px: 2.5,
          pr: 6,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>
          Choose MID for Withdrawal
        </Typography>
        <Typography sx={{ mt: 0.4, fontSize: 12.5, color: 'text.secondary' }}>
          {userLabel} · {subtitle}
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2.25, pt: '20px !important' }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
            <Typography color="text.secondary">Loading MID list…</Typography>
          </Stack>
        ) : !routingRows.length ? (
          <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 6 }}>
            <Typography color="text.secondary" fontWeight={600}>
              No routing MID available
            </Typography>
            <Typography color="text.secondary" fontSize={12.5} textAlign="center">
              User has deposited on all configured MIDs. Use a MID where the user has not deposited.
            </Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              maxHeight: '60vh',
              overflow: 'auto',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['MID', 'User Deposit', 'User Withdrawal'].map((label) => (
                    <TableCell key={label} sx={headCellSx}>
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {routingRows.map((item) => (
                  <TableRow key={item.mid} hover>
                    <TableCell sx={{ ...bodyCellSx, fontWeight: 700 }}>
                      {display(item.mid)}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>—</TableCell>
                    <TableCell sx={bodyCellSx}>
                      {Number(item.withdrawalAmount ?? 0) > 0
                        ? formatAmount(item.withdrawalAmount ?? 0)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" onClick={onClose} sx={{ ...orangeBtnSx, minWidth: 110 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
