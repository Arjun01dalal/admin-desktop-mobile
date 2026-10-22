import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  formatC2cCallerChipLabel,
  isC2cLeadCampaign,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { CampaignStats } from './CampaignStats';
import { LeadSheetUpload } from './LeadSheetUpload';

type Props = {
  selectedId: string;
  selected: C2cCampaign | null;
  customers: C2cCampaignCustomer[];
  customerColumns: CommonTableColumn<C2cCampaignCustomer>[];
  customerTotal: number;
  customerPage: number;
  customerTotalPages: number;
  customersLoading: boolean;
  customerSearchInput: string;
  customerStatus: C2cCustomerStatus;
  customerAssignedTo: string;
  saving: boolean;
  onBack: () => void;
  onEdit: () => void;
  onRefreshCustomers: () => void;
  onCustomerPage: (page: number) => void;
  onCustomerSearchInput: (v: string) => void;
  onCustomerStatus: (v: C2cCustomerStatus) => void;
  onCustomerAssignedTo: (v: string) => void;
  onApplyCustomerFilters: () => void;
  onClearCustomerFilters: () => void;
  onReloadCampaign: () => void;
  formDialog: ReactNode;
};

export function C2cCampaignDetailView({
  selectedId,
  selected,
  customers,
  customerColumns,
  customerTotal,
  customerPage,
  customerTotalPages,
  customersLoading,
  customerSearchInput,
  customerStatus,
  customerAssignedTo,
  saving,
  onBack,
  onEdit,
  onRefreshCustomers,
  onCustomerPage,
  onCustomerSearchInput,
  onCustomerStatus,
  onCustomerAssignedTo,
  onApplyCustomerFilters,
  onClearCustomerFilters,
  onReloadCampaign,
  formDialog,
}: Props) {
  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        minHeight: 0,
        height: '100%',
      }}
    >
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ p: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              onClick={onBack}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: 'text.primary' }}
            >
              ← Back
            </Button>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>
                {selected?.campaignName || 'Campaign'}
              </Typography>
              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: 12,
                  color: 'text.secondary',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  wordBreak: 'break-all',
                }}
              >
                {selected?._id || selectedId}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={selected?.isActive ? 'Active' : 'Inactive'}
              sx={{
                height: 26,
                fontWeight: 800,
                fontSize: 12,
                borderRadius: 999,
                ...(selected?.isActive
                  ? {
                      bgcolor: alpha('#4ade80', 0.16),
                      color: '#4ade80',
                      border: `1px solid ${alpha('#4ade80', 0.35)}`,
                    }
                  : {
                      bgcolor: alpha('#94a3b8', 0.12),
                      color: 'text.secondary',
                      border: `1px solid ${alpha('#94a3b8', 0.28)}`,
                    }),
              }}
            />
            {isC2cLeadCampaign(selected) ? (
              <Chip
                size="small"
                label="Lead"
                sx={{
                  height: 26,
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 999,
                  bgcolor: alpha('#ff9f0a', 0.16),
                  color: '#ff9f0a',
                  border: `1px solid ${alpha('#ff9f0a', 0.4)}`,
                }}
              />
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {selected ? <CampaignStats campaign={selected} /> : null}
            {selected && isC2cLeadCampaign(selected) ? (
              <LeadSheetUpload
                campaignId={selected._id}
                onUploaded={() => {
                  onReloadCampaign();
                  onRefreshCustomers();
                }}
              />
            ) : null}
            <Button
              size="small"
              variant="outlined"
              disabled={!selected || saving}
              onClick={onEdit}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: 'text.primary' }}
            >
              Edit
            </Button>
          </Stack>
        </Stack>

        {selected ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ px: 1.75, py: 1.25 }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              Callers
            </Typography>
            {(selected.callers || []).length ? (
              selected.callers.map((c) => (
                <Chip
                  key={c._id}
                  size="small"
                  label={formatC2cCallerChipLabel(c)}
                  sx={{ height: 24, fontWeight: 600, bgcolor: alpha('#ff9f0a', 0.1) }}
                />
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                No callers
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Fixed after creation
            </Typography>
          </Stack>
        ) : null}
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={1}
          sx={{ p: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800 }}>Campaign customers</Typography>
            <Typography variant="caption" color="text.secondary">
              Filter by status, assignee, or search name / mobile
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={`${customerTotal} rows`} sx={{ fontWeight: 700 }} />
            <Button
              size="small"
              variant="outlined"
              disabled={customersLoading}
              onClick={onRefreshCustomers}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider' }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ px: 1.75, pt: 1.75, pb: 1 }}
        >
          <TextField
            size="small"
            placeholder="Search name / mobile…"
            value={customerSearchInput}
            onChange={(e) => onCustomerSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyCustomerFilters();
            }}
            sx={{ ...fieldSx, width: 220, flexShrink: 0 }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={customerStatus}
            onChange={(e) => onCustomerStatus(e.target.value as C2cCustomerStatus)}
            sx={{ ...fieldSx, width: 140, flexShrink: 0 }}
          >
            <MenuItem value="">All status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="assigned">Assigned</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Assigned to"
            value={customerAssignedTo}
            onChange={(e) => onCustomerAssignedTo(e.target.value)}
            sx={{ ...fieldSx, width: 180, flexShrink: 0 }}
          >
            <MenuItem value="">Assigned to (all)</MenuItem>
            {(selected?.callers || []).map((c) => (
              <MenuItem key={c._id} value={c._id}>
                {c.name}
                {c.empCode ? ` (${c.empCode})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" sx={orangeBtnSx} onClick={onApplyCustomerFilters} disabled={customersLoading}>
            Search
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={onClearCustomerFilters}
            disabled={customersLoading}
            sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider' }}
          >
            Clear
          </Button>
        </Stack>

        <Box sx={{ px: 1.75, pb: 1.75, flex: 1, minHeight: 0 }}>
          <TablePanel>
            <CommonTable
              rows={customers}
              columns={customerColumns}
              loading={customersLoading}
              getRowKey={(r) => r._id}
              emptyMessage="No customers in this view"
              dense
            />
          </TablePanel>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Pagination
              page={customerPage}
              count={customerTotalPages}
              onChange={(_, p) => onCustomerPage(p)}
              color="primary"
              size="small"
            />
          </Stack>
        </Box>
      </Box>

      {formDialog}
    </Box>
  );
}
