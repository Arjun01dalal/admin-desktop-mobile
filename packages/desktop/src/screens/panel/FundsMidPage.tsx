import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';
import { canShowFundEditBtn } from '@/screens/panel/funds/constants';
import {
  FundsEditAccessModal,
  type FundsEditTarget,
} from '@/screens/panel/funds/FundsEditAccessModal';
import {
  clearFundsSelectedMid,
  readFundsDrill,
  roundAmt,
  saveFundsDates,
  setFundsSelectedMid,
  type FundsMidRow,
} from '@/screens/panel/funds/utils';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 32,
  fontSize: 12,
  px: 1.5,
  '&:hover': { bgcolor: '#e08c00' },
};

export function FundsMidPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(() => getSessionUser(), []);
  const gatewayOnly = hasPermission(Permissions.show_gateway_only);
  const canEditAccess = canShowFundEditBtn(user?.mobile);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FundsEditTarget | null>(null);

  const drill = useMemo(
    () =>
      readFundsDrill(
        (location.state as {
          name?: string;
          mids?: unknown;
          startDate?: string;
          endDate?: string;
          midID?: string;
        } | null) || null,
      ),
    [location.state],
  );

  useEffect(() => {
    clearFundsSelectedMid();
  }, [location.key]);

  const mids = useMemo(() => {
    const list = drill?.mids ?? [];
    const allowed = Array.isArray(user?.mid) ? (user!.mid as string[]) : [];
    if (!allowed.length) return list;
    return list.filter((item) => allowed.includes(item.mid));
  }, [drill?.mids, user]);

  const openPayin = useCallback(
    (row: FundsMidRow) => {
      if (gatewayOnly) {
        toast.info('Gateway-only access — MID details are locked');
        return;
      }
      const midId = String(row.mid || '').trim();
      if (!midId) {
        toast.error('MID is missing');
        return;
      }
      if (!drill) {
        toast.error('Open a name from Funds first');
        navigate('/funds', { replace: true });
        return;
      }

      saveFundsDates(drill.startDate, drill.endDate);
      setFundsSelectedMid(midId);
      navigate('/funds/payin', {
        state: {
          midID: midId,
          name: drill.name,
          startDate: drill.startDate,
          endDate: drill.endDate,
          mids: drill.mids,
        },
      });
    },
    [drill, gatewayOnly, navigate],
  );

  const openEdit = useCallback(
    (row: FundsMidRow) => {
      setEditTarget({
        gatewayName: drill?.name,
        midName: String(row.mid || ''),
      });
      setEditOpen(true);
    },
    [drill?.name],
  );

  const columns = useMemo<CommonTableColumn<FundsMidRow>[]>(() => {
    const cols: CommonTableColumn<FundsMidRow>[] = [
      {
        id: '#',
        label: (
          <>
            Sr
            <br />
            No
          </>
        ),
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'mid',
        label: 'Mid',
        render: (row) => (
          <Box
            component="span"
            sx={{
              cursor: gatewayOnly ? 'default' : 'pointer',
              fontWeight: 600,
              color: gatewayOnly ? 'inherit' : '#ff9f0a',
            }}
          >
            {display(row.mid)}
          </Box>
        ),
      },
      {
        id: 'finalAmount',
        label: 'Final Amount',
        render: (row) => roundAmt(row.finalAmount),
      },
      {
        id: 'transactionAmount',
        label: 'Transaction Amount',
        render: (row) => roundAmt(row.transactionAmount),
      },
      {
        id: 'coinAmount',
        label: 'Coin Amount',
        render: (row) => display(row.coinAmount),
      },
      {
        id: 'coinAdd',
        label: 'Coin Add',
        render: (row) => display(row.coinAdd),
      },
      {
        id: 'coinRemove',
        label: 'Coin Remove',
        render: (row) => display(row.coinRemove),
      },
      {
        id: 'netCoin',
        label: 'Net Coin',
        render: (row) => display(row.netCoin),
      },
      {
        id: 'paymentGatewayCompany',
        label: 'Payment Gateway Company',
        render: (row) => display(row.paymentGatewayCompany),
      },
      {
        id: 'companyGroup',
        label: 'Company Group',
        render: (row) => display(row.companyGroup),
      },
    ];

    if (canEditAccess) {
      cols.push({
        id: 'updateAccess',
        label: 'Update Access',
        width: 120,
        render: (row) => (
          <Button
            size="small"
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            sx={orangeBtnSx}
          >
            Edit
          </Button>
        ),
      });
    }

    return cols;
  }, [canEditAccess, gatewayOnly, openEdit]);

  if (!drill) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Funds — MID
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No MID data. Open a gateway name from Funds.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const title = drill.name === 'coinRemove' ? 'Other Removal' : display(drill.name);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Funds — {title}
      </Typography>
      <Typography color="text.secondary" mb={1.5} fontSize={13}>
        Click a MID row to open the payment list
      </Typography>
      <TablePanel>
        <CommonTable
          columns={columns}
          rows={mids}
          getRowKey={(row, i) => `${row.mid}-${i}`}
          emptyMessage="No MID Data"
          minWidth={canEditAccess ? 1220 : 1100}
          onRowClick={gatewayOnly ? undefined : (row) => openPayin(row)}
          maxHeight="100%"
        />
      </TablePanel>

      <FundsEditAccessModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        target={editTarget}
      />
    </Box>
  );
}
