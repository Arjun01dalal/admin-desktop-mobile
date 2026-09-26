import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  ListItemText,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  ACTIVE_USER_WITHDRAWAL_SORT_BY,
  ACTIVE_USER_WITHDRAWAL_SORT_ORDER,
  ACTIVE_USER_WITHDRAWAL_STATUSES,
  DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE,
  buildActiveUserWithdrawalPayload,
  empCodeFromUser,
  normalizeActiveUserWithdrawals,
  type ActiveUserWithdrawalRow,
  type ActiveUserWithdrawalSortBy,
  type ActiveUserWithdrawalSortOrder,
} from '@astro/shared';
import {
  buildBenePendingOptions,
  normalizeBeneAccountCountSummary,
  type BenePendingOption,
} from '@astro/shared/beneficiaryAccountCounts';
import { unpackPayload, orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { TablePanel } from '@/components/TablePanel';
import { useReportQuery } from '@/screens/panel/shared';
import { secureApi } from '@/api/secureClient';
import { getStoredUser, todayIST } from '@/utils/dates';
import { pickPageSizes } from '@/utils/pagination';
import { WithdrawalActionTable } from '@/screens/panel/withdrawal/WithdrawalActionTable';
import { toWithdrawalRow } from '@/screens/panel/withdrawal/toWithdrawalRow';
import type { WithdrawalRow } from '@/screens/panel/withdrawal/types';

const PAGE_SIZES = pickPageSizes([20, 50, 100, 200]);

const auwFieldSx = {
  ...fieldSx,
  width: 148,
  flexShrink: 0,
};

type AppliedFilters = {
  empCode: string;
  startDate: string;
  endDate: string;
  status: string;
  sortBy: ActiveUserWithdrawalSortBy;
  sortOrder: ActiveUserWithdrawalSortOrder;
  beneficiaryAccounts: string[];
};

function todayOr(value: string): string {
  return value || todayIST();
}

export function ActiveUserWithdrawalPage() {
  const admin = getStoredUser<Record<string, unknown>>();
  const loginEmpCode = empCodeFromUser(admin);

  const [draftEmpCode, setDraftEmpCode] = useState(loginEmpCode);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState<ActiveUserWithdrawalSortBy>('activeUser');
  const [sortOrder, setSortOrder] = useState<ActiveUserWithdrawalSortOrder>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE);
  const [beneficiaryAccounts, setBeneficiaryAccounts] = useState<string[]>([]);
  const [draftBeneficiaryAccounts, setDraftBeneficiaryAccounts] = useState<string[]>([]);
  const [beneSelectOpen, setBeneSelectOpen] = useState(false);
  const draftBeneRef = useRef<string[]>([]);
  draftBeneRef.current = draftBeneficiaryAccounts;
  const [beneAccOptions, setBeneAccOptions] = useState<BenePendingOption[]>([]);

  const [applied, setApplied] = useState<AppliedFilters>({
    empCode: loginEmpCode,
    startDate: todayIST(),
    endDate: todayIST(),
    status: 'All',
    sortBy: 'activeUser',
    sortOrder: 'asc',
    beneficiaryAccounts: [],
  });

  useEffect(() => {
    if (!loginEmpCode) return;
    setDraftEmpCode((prev) => prev || loginEmpCode);
    setApplied((prev) => (prev.empCode ? prev : { ...prev, empCode: loginEmpCode }));
  }, [loginEmpCode]);

  const loadBeneOptions = useCallback(async () => {
    const [bankRes, countRes] = await Promise.all([
      secureApi('withdrawals.availableBanks', {}),
      secureApi('withdrawals.beneficiaryAccountsUserCount', {}),
    ]);
    let banks: string[] = [];
    if (bankRes.ok) {
      const body = unpackPayload(bankRes.data);
      const raw =
        (Array.isArray(body.availableBanks) && body.availableBanks) ||
        (Array.isArray(body.banks) && body.banks) ||
        (Array.isArray(body.items) && body.items) ||
        (Array.isArray(bankRes.data) && bankRes.data) ||
        [];
      banks = (raw as unknown[])
        .map((b) => (typeof b === 'string' ? b : String((b as { name?: string })?.name || '')))
        .filter(Boolean);
    }
    const counts = countRes.ok ? normalizeBeneAccountCountSummary(countRes.data).items : [];
    setBeneAccOptions(buildBenePendingOptions(banks, counts));
  }, []);

  useEffect(() => {
    void loadBeneOptions();
  }, [loadBeneOptions]);

  const { rows: apiRows, total, totalPages, loading, error, load } =
    useReportQuery<ActiveUserWithdrawalRow>({
      action: 'withdrawals.byActiveUser',
      buildPayload: () =>
        buildActiveUserWithdrawalPayload({
          empCode: applied.empCode,
          status: applied.status,
          sortBy: applied.sortBy,
          sortOrder: applied.sortOrder,
          startDate: applied.startDate,
          endDate: applied.endDate,
          pageNo: page,
          itemPerPage: pageSize,
          beneficiaryAccounts: applied.beneficiaryAccounts,
        }),
      unpack: (res) => normalizeActiveUserWithdrawals(res.data, pageSize),
      autoDeps: [applied, page, pageSize],
      errorMessage: 'Failed to load active user withdrawals',
      cacheTtlMs: 0,
    });

  const rows = useMemo<WithdrawalRow[]>(
    () => apiRows.map((row) => toWithdrawalRow(row)),
    [apiRows],
  );

  const handleRefresh = useCallback(() => {
    void load();
  }, [load]);

  const applyFilters = useCallback(() => {
    setApplied({
      empCode: draftEmpCode.trim(),
      startDate: todayOr(startDate),
      endDate: todayOr(endDate),
      status,
      sortBy,
      sortOrder,
      beneficiaryAccounts,
    });
    setPage(1);
  }, [
    draftEmpCode,
    startDate,
    endDate,
    status,
    sortBy,
    sortOrder,
    beneficiaryAccounts,
  ]);

  const handleClear = () => {
    const today = todayIST();
    setDraftEmpCode(loginEmpCode);
    setStartDate(today);
    setEndDate(today);
    setStatus('All');
    setSortBy('activeUser');
    setSortOrder('asc');
    setBeneficiaryAccounts([]);
    setDraftBeneficiaryAccounts([]);
    setBeneSelectOpen(false);
    setApplied({
      empCode: loginEmpCode,
      startDate: today,
      endDate: today,
      status: 'All',
      sortBy: 'activeUser',
      sortOrder: 'asc',
      beneficiaryAccounts: [],
    });
    setPage(1);
  };

  const applyBeneficiaryFilter = (next: string[]) => {
    setBeneficiaryAccounts(next);
    setDraftBeneficiaryAccounts(next);
    if (next.length > 0) {
      setStatus('Pending');
      setApplied((prev) => ({
        ...prev,
        empCode: draftEmpCode.trim() || prev.empCode,
        beneficiaryAccounts: next,
        status: 'Pending',
        startDate: '',
        endDate: '',
      }));
      setPage(1);
      return;
    }
    setStatus('All');
    setApplied((prev) => ({
      ...prev,
      empCode: draftEmpCode.trim() || prev.empCode,
      beneficiaryAccounts: [],
      status: 'All',
      startDate: todayOr(startDate),
      endDate: todayOr(endDate),
    }));
    setPage(1);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1 }}>
      <Box
        sx={{
          mb: 1.5,
          width: '100%',
          minWidth: 0,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{
            minHeight: 46,
            px: 1.5,
            py: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              Active User Withdrawal
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Withdrawals filtered by active-user mapping
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
            <Typography variant="body2" sx={{ color: '#9aa3b5', fontWeight: 600 }}>
              Total: {total.toLocaleString('en-IN')}
            </Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{ textTransform: 'none', color: '#e8e8ea' }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ p: 1.5, overflowX: 'auto' }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            useFlexGap
            sx={{ minWidth: 'max-content', flexWrap: 'nowrap' }}
          >
            <TextField
              label="Emp Code"
              size="small"
              value={draftEmpCode}
              onChange={(e) => setDraftEmpCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
              placeholder="e.g. EMP001"
              InputLabelProps={{ shrink: true }}
              sx={auwFieldSx}
            />
            <TextField
              label="Start Date"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={auwFieldSx}
            />
            <TextField
              label="End Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={auwFieldSx}
            />
            <TextField
              select
              label="Status"
              size="small"
              value={status}
              onChange={(e) => {
                const next = e.target.value;
                setStatus(next);
                setApplied((prev) => ({ ...prev, status: next }));
                setPage(1);
              }}
              sx={auwFieldSx}
            >
              {ACTIVE_USER_WITHDRAWAL_STATUSES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Beneficiary List (Pending)"
              size="small"
              value={draftBeneficiaryAccounts}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                const value = e.target.value;
                const next =
                  typeof value === 'string' ? value.split(',').filter(Boolean) : value;
                setDraftBeneficiaryAccounts(next);
              }}
              SelectProps={{
                multiple: true,
                displayEmpty: true,
                open: beneSelectOpen,
                onOpen: () => {
                  setDraftBeneficiaryAccounts(beneficiaryAccounts);
                  setBeneSelectOpen(true);
                },
                onClose: () => {
                  setBeneSelectOpen(false);
                  applyBeneficiaryFilter(draftBeneRef.current);
                },
                renderValue: (selected) => {
                  const values = selected as string[];
                  if (values.length === 0) return 'Choose…';
                  if (values.length === 1) {
                    const opt = beneAccOptions.find((o) => o.name === values[0]);
                    return opt ? `${opt.name} (${opt.pendingWithdrawalCount})` : values[0];
                  }
                  return `${values.length} selected`;
                },
                MenuProps: {
                  PaperProps: { sx: { maxHeight: 280 } },
                  disableScrollLock: true,
                },
              }}
              sx={{
                ...auwFieldSx,
                minWidth: 260,
                width: 280,
                '& .MuiSelect-select': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              {beneAccOptions.map((option) => (
                <MenuItem key={option.name} value={option.name}>
                  <Checkbox size="small" checked={draftBeneficiaryAccounts.includes(option.name)} />
                  <ListItemText
                    primary={`${option.name} (${option.pendingWithdrawalCount})`}
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Sort By"
              size="small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ActiveUserWithdrawalSortBy)}
              sx={{ ...auwFieldSx, width: 150 }}
            >
              {ACTIVE_USER_WITHDRAWAL_SORT_BY.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Sort Order"
              size="small"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as ActiveUserWithdrawalSortOrder)}
              sx={{ ...auwFieldSx, width: 140 }}
            >
              {ACTIVE_USER_WITHDRAWAL_SORT_ORDER.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Per Page"
              size="small"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE);
                setPage(1);
              }}
              sx={{ ...auwFieldSx, width: 110 }}
            >
              {PAGE_SIZES.map((n) => (
                <MenuItem key={n} value={String(n)}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              onClick={applyFilters}
              disabled={loading}
              sx={{ ...orangeBtnSx, height: 40, flexShrink: 0 }}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              onClick={handleClear}
              disabled={loading}
              sx={{ height: 40, flexShrink: 0, textTransform: 'none' }}
            >
              Clear
            </Button>
          </Stack>
        </Box>
      </Box>

      {error ? (
        <Typography color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          totalPages > 1 || rows.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ color: '#9aa3b5' }}>
                Page {page} / {Math.max(1, totalPages)}
              </Typography>
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, next) => setPage(next)}
                color="primary"
                shape="rounded"
                size="small"
                disabled={loading}
              />
            </>
          ) : undefined
        }
      >
        <WithdrawalActionTable
          rows={rows}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onRefresh={handleRefresh}
          hideColumnFilters
          showTotalBeneList={false}
        />
      </TablePanel>
    </Box>
  );
}
