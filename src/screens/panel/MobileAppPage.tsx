import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';

type AppLink = {
  name: string;
  key: string;
  registrationLink: string;
  depositLink: string;
};

export function MobileAppPage() {
  const user = getStoredUser<{ empCode?: string }>();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await secureApi<AppLink[]>('mobileApp.getLinks', {
          empCode: user?.empCode || '001',
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to load app links');
          return;
        }
        setApps(res.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.empCode]);

  const columns = useMemo<CommonTableColumn<AppLink>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'App Name',
        render: (row) => row.name,
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

      {loading ? (
        <CircularProgress />
      ) : (
        <CommonTable
          columns={columns}
          rows={apps}
          getRowKey={(row) => row.key}
          loading={loading}
          emptyMessage="No apps"
        />
      )}
    </Box>
  );
}
