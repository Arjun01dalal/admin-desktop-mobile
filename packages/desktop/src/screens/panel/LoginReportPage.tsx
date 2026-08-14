import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { roleNamesMap } from '@/data/rolesData';
import { formatDisplayTime } from '@/utils/dates';

type LoginReportItem = {
  _id?: string;
  name?: string;
  lat?: number | string;
  long?: number | string;
  updatedOn?: string;
  address?: {
    addressLine2?: string;
    state?: string;
    city?: string;
    city_district?: string;
  };
  [key: string]: unknown;
};

type RoleGroup = {
  _id: string;
  items?: LoginReportItem[];
};

export function LoginReportPage() {
  const [grouped, setGrouped] = useState<Record<string, LoginReportItem[]>>({});
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<RoleGroup[] | { payload?: RoleGroup[] }>(
        'reports.loginByRole',
        {},
      );

      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load login report');
        setGrouped({});
        return;
      }

      const raw = res.data;
      const groups = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.payload)
          ? raw.payload
          : [];

      const nextGrouped: Record<string, LoginReportItem[]> = {};
      for (const group of groups) {
        if (group?._id) {
          nextGrouped[group._id] = Array.isArray(group.items) ? group.items : [];
        }
      }

      const names = roleNamesMap();
      setRoleNames(names);
      setGrouped(nextGrouped);

      const firstId = Object.keys(nextGrouped)[0] || '';
      setSelectedRoleId(firstId);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = grouped[selectedRoleId] || [];
  const deferredRows = useDeferredValue(rows);

  const columns = useMemo<CommonTableColumn<LoginReportItem>[]>(
    () => [
      { id: 'name', label: 'Name', render: (row) => row.name || '—' },
      {
        id: 'address',
        label: 'Address Line',
        render: (row) => row.address?.addressLine2 || '—',
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => row.address?.state || '—',
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => row.address?.city || '—',
      },
      {
        id: 'district',
        label: 'District',
        render: (row) => row.address?.city_district || '—',
      },
      { id: 'lat', label: 'Latitude', render: (row) => row.lat ?? '—' },
      { id: 'long', label: 'Longitude', render: (row) => row.long ?? '—' },
      {
        id: 'loginTime',
        label: 'Login Time',
        render: (row) =>
          row.updatedOn ? formatDisplayTime(row.updatedOn) : '—',
      },
    ],
    [],
  );

  const roleOptions = Object.keys(grouped);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Login Report
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', width: '100%' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap" useFlexGap>
          <TextField
            select
            label="Select Role"
            size="small"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            sx={{ minWidth: 240, flexShrink: 0 }}
            disabled={loading || roleOptions.length === 0}
          >
            {roleOptions.map((roleId) => (
              <MenuItem key={roleId} value={roleId}>
                {roleNames[roleId] || roleId}
              </MenuItem>
            ))}
          </TextField>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No login records found"
        stickyHeader
        dense
        maxHeight="calc(100vh - 225px)"
      />
    </Box>
  );
}
