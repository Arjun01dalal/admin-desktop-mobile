import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { getStoredUser } from '@/utils/dates';
import { buildMobileAppLinks } from '@/constants/mobileAppLinks';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import type { MobileAppLink } from '@/constants/mobileAppLinks';

export function MobileAppPage() {
  const user = getStoredUser<{ empCode?: string }>();
  const empCode = String(user?.empCode || '001').trim() || '001';
  const apps = useMemo(() => buildMobileAppLinks(empCode), [empCode]);

  const columns = useMemo<CommonTableColumn<MobileAppLink>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'App Code',
        width: 100,
        render: (row) => row.code,
      },
      {
        id: 'registration',
        label: 'Registration Link',
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <CopyText value={row.registrationLink} breakAll />,
      },
      {
        id: 'deposit',
        label: 'Deposit Link',
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <CopyText value={row.depositLink} breakAll />,
      },
    ],
    [],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Mobile App
      </Typography>

      <CommonTable
        columns={columns}
        rows={apps}
        getRowKey={(row) => row.key}
        emptyMessage="No apps"
      />
    </Box>
  );
}
