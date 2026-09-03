import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

export type SosBlockRow = {
  _id?: string;
  enabled?: boolean;
  type?: string;
  location?: string;
  targetCallerId?: string;
  blockedById?: string;
  blockedByName?: string;
  blockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

function unpackSosBlocks(data: unknown): SosBlockRow[] {
  if (Array.isArray(data)) return data as SosBlockRow[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;

  for (const key of ['blocks', 'items', 'list', 'docs', 'data', 'users'] as const) {
    const value = nested[key];
    if (Array.isArray(value)) return value as SosBlockRow[];
  }

  // Single active block envelope: { block: { ... } }
  if (nested.block && typeof nested.block === 'object' && !Array.isArray(nested.block)) {
    return [nested.block as SosBlockRow];
  }

  return [];
}

function display(value: unknown): string {
  if (value == null || value === '') return '—';
  return toDisplayText(String(value));
}

function formatWhen(value?: string): string {
  if (!value) return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  if (d === '—' && t === '—') return value;
  return `${d} ${t}`.trim();
}

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  '&:hover': { bgcolor: '#e08c00' },
};

export function SosBlockedUsersPage() {
  const [rows, setRows] = useState<SosBlockRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('auth.getAllSosBlocks', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load SOS blocked users');
        setRows([]);
        return;
      }
      setRows(unpackSosBlocks(res.data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load SOS blocked users');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<SosBlockRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'blockedByName',
        label: 'Blocked By',
        render: (row) => display(row.blockedByName),
      },
      {
        id: 'blockedById',
        label: 'Blocked By ID',
        render: (row) => display(row.blockedById),
      },
      {
        id: 'type',
        label: 'Type',
        render: (row) => display(row.type),
      },
      {
        id: 'location',
        label: 'Location',
        render: (row) => display(row.location),
      },
      {
        id: 'targetCallerId',
        label: 'Target Caller ID',
        render: (row) => display(row.targetCallerId),
      },
      {
        id: 'enabled',
        label: 'Status',
        render: (row) => {
          const active = row.enabled === true;
          return (
            <Chip
              size="small"
              label={active ? 'Active' : 'Inactive'}
              color={active ? 'error' : 'default'}
              sx={{ fontWeight: 700 }}
            />
          );
        },
      },
      {
        id: 'blockedAt',
        label: 'Blocked At',
        render: (row) =>
          formatWhen(
            row.blockedAt ||
              (typeof row.createdAt === 'string' ? row.createdAt : undefined) ||
              (typeof row.updatedAt === 'string' ? row.updatedAt : undefined),
          ),
      },
    ],
    [],
  );

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        mb={2}
        flexWrap="wrap"
      >
        <Typography variant="h5" fontWeight={700}>
          SOS Blocked Users
        </Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          disabled={loading}
          onClick={() => void load()}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Total: {rows.length}
      </Typography>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, i) => String(row._id || row.blockedById || row.targetCallerId || i)}
          loading={loading}
          emptyMessage="No SOS blocks found"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
