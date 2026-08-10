import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { display } from '@/screens/panel/shared';
import {
  clearFundsSelectedMid,
  readFundsDrill,
  roundAmt,
  saveFundsDates,
  setFundsSelectedMid,
  type FundsMidRow,
} from '@/screens/panel/funds/utils';

export function FundsMidPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getSessionUser();
  const gatewayOnly = hasPermission(Permissions.show_gateway_only);

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
    [location.state, location.key],
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

  const columns = useMemo<CommonTableColumn<FundsMidRow>[]>(
    () => [
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
    ],
    [gatewayOnly],
  );

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

  const title =
    drill.name === 'coinRemove' ? 'Other Removal' : display(drill.name);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Funds — {title}
      </Typography>
      <Typography color="text.secondary" mb={1.5} fontSize={13}>
        Click a MID row to open the payment list
      </Typography>
      <CommonTable
        columns={columns}
        rows={mids}
        getRowKey={(row, i) => `${row.mid}-${i}`}
        emptyMessage="No MID Data"
        minWidth={1100}
        onRowClick={gatewayOnly ? undefined : (row) => openPayin(row)}
      />
    </Box>
  );
}
