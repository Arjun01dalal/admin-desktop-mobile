import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission } from '@/auth/permissions';
import { appCodeForName } from '@/constants/clientNames';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { formatDisplayDate, formatAmount } from '@/utils/dates';
import type { PointsReportDoc } from './types';

type DetailsState = {
  docs?: PointsReportDoc[];
};

export function PointsReportDetailsPage() {
  const location = useLocation();
  const docs = ((location.state || {}) as DetailsState).docs || [];
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const columns = useMemo<CommonTableColumn<PointsReportDoc>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        render: (_row, index) => index + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        render: (row) => row.userName || '—',
      },
      {
        id: 'userBankName',
        label: 'User Bank Name',
        render: (row) => row.userBankName || '—',
      },
      {
        id: 'userId',
        label: 'User Id',
        render: (row) => row.userId || '—',
      },
      {
        id: 'clientName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => (canShowMobile ? row.userMobile || '—' : '**********'),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'tag',
        label: 'Tag',
        render: (row) => row.tag || '—',
      },
      {
        id: 'reason',
        label: 'Reason',
        render: (row) => row.reason || '—',
      },
      {
        id: 'mid',
        label: 'Mid',
        render: (row) => row.mid || '—',
      },
      {
        id: 'remark',
        label: 'Remark',
        render: (row) => row.remakr || row.remark || '—',
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
    ],
    [canShowMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Coins Reports Report
      </Typography>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={docs}
          getRowKey={(row, index) => row._id || index}
          emptyMessage="No documents found"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
