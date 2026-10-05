import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  ListItemText,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { formatDisplayDate, getStoredUser, todayIST } from '@/utils/dates';
import { SheetDownloadOtpModal } from '@/components/SheetDownloadOtpModal';
import { saveWorkbook } from '@/utils/downloadSheet';
import type { SheetDownloadFilter } from '@/utils/sheetDownloadAudit';
import { asPaged, asList, useReportQuery } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import {
  orangeBtnSx,
  fieldSx,
  filterSelectSx,
  toolbarBoxSx,
  chipSx,
  WITHDRAWAL_STATUSES,
  PAGE_SIZE_OPTIONS,
  type MidOption,
  unpackPayload,
} from '@/screens/panel/transactions/shared';
import {
  type WithdrawalRow,
  type ColumnFilters,
  type QueryState,
  type WithdrawalSummary,
  EMPTY_FILTERS,
  WIN_IN_OPTIONS,
  asWithdrawalSummary,
  emptyWithdrawalSummary,
  withdrawalStatLabel,
} from '@/screens/panel/withdrawal/types';
import { orderIdOf, midLabel, sendToBankName, displayUserName } from '@/screens/panel/withdrawal/logic';
import {
  WithdrawalActionTable,
  type WithdrawalColumnFilterSlots,
} from '@/screens/panel/withdrawal/WithdrawalActionTable';
import {
  buildBenePendingOptions,
  normalizeBeneAccountCountSummary,
  type BenePendingOption,
} from '@astro/shared/beneficiaryAccountCounts';

const CLIENT_NAME_OPTIONS = ['', ...CLIENT_NAMES];
const STATE_OPTIONS = ['', ...INDIA_STATES];

/** Withdrawal — filters/downloads + shared action table (check/lock/status/bulk/bene). */
export function WithdrawalPage() {
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    mobile?: string;
    allotedApps?: string | string[];
    clientName?: string | string[];
  }>();

  const canDownload = hasPermission('Download_Withdrawal') || hasPermission('show_download_botton');
  const showAllInProgress = hasPermission('show_all_withdrawal');
  const location = useLocation();
  const navState = (location.state ?? null) as {
    status?: string;
    startDate?: string;
    endDate?: string;
  } | null;
  const today = todayIST();

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [startDate, setStartDate] = useState(navState?.startDate || today);
  const [endDate, setEndDate] = useState(navState?.endDate || today);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnFilters>({
    ...EMPTY_FILTERS,
    status: navState?.status || '',
  });
  const [query, setQuery] = useState<QueryState>({
    startDate: navState?.startDate || today,
    endDate: navState?.endDate || today,
    allData: false,
    filters: { ...EMPTY_FILTERS, status: navState?.status || '' },
  });

  const [mids, setMids] = useState<MidOption[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [beneAccOptions, setBeneAccOptions] = useState<BenePendingOption[]>([]);
  const [selectedBeneficiaryAccounts, setSelectedBeneficiaryAccounts] = useState<string[]>([]);
  const [draftBeneficiaryAccounts, setDraftBeneficiaryAccounts] = useState<string[]>([]);
  const [beneSelectOpen, setBeneSelectOpen] = useState(false);
  const draftBeneRef = useRef<string[]>([]);
  draftBeneRef.current = draftBeneficiaryAccounts;
  const [summary, setSummary] = useState<WithdrawalSummary>(emptyWithdrawalSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sheetOtp, setSheetOtp] = useState<{ open: boolean; filter: SheetDownloadFilter }>({
    open: false,
    filter: { type: 'Withdrawal Sheet' },
  });
  const sheetAfterOtp = useRef<(() => void) | null>(null);
  const requestSheetDownload = (filter: SheetDownloadFilter, run: () => void) => {
    sheetAfterOtp.current = run;
    setSheetOtp({ open: true, filter });
  };

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    const f = query.filters;
    if (f.userName.trim()) filter.userName = f.userName.trim();
    if (f.empCode.trim()) filter.empCode = f.empCode.trim();
    if (f.mobile.trim()) filter.mobile = f.mobile.trim();
    if (f.amount.trim()) filter.amount = f.amount.trim();
    if (selectedBeneficiaryAccounts.length > 0) {
      filter.beneficiaryAccounts = selectedBeneficiaryAccounts;
      filter.status = 'Pending';
    } else if (f.status) {
      filter.status = f.status;
    }
    if (f.clientName) filter.clientName = f.clientName;
    if (f.state) filter.state = f.state;
    if (f.city.trim()) filter.city = f.city.trim();
    if (f.transactionId.trim()) filter.transactionId = f.transactionId.trim();
    if (f.dp_id.trim()) filter.dp_id = f.dp_id.trim();
    if (f.accountNo.trim()) filter.accountNo = f.accountNo.trim();
    if (f.ifscCode.trim()) filter.ifscCode = f.ifscCode.trim();
    if (f.mid) filter.mid = f.mid;
    if (f.playedGames) filter.playedGames = f.playedGames;

    const effectiveStatus =
      selectedBeneficiaryAccounts.length > 0 ? 'Pending' : f.status;
    if (effectiveStatus === 'IN PROGRESS' && !showAllInProgress && admin?.name) {
      filter.name = admin.name;
    }

    const payload: Record<string, unknown> = {
      type: 'withdrawal',
      itemsPerPage,
      pageNo: page,
      filter,
    };
    if (!query.allData) {
      if (query.startDate) payload.startDate = query.startDate;
      if (query.endDate) payload.endDate = query.endDate;
    }
    const apps = admin?.clientName || admin?.allotedApps;
    if (apps) payload.app = apps;
    return payload;
  }, [
    query,
    page,
    itemsPerPage,
    showAllInProgress,
    admin?.name,
    admin?.clientName,
    admin?.allotedApps,
    selectedBeneficiaryAccounts,
  ]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<WithdrawalRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<WithdrawalRow>({
    action: 'withdrawals.transactions',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, query, selectedBeneficiaryAccounts],
    errorMessage: 'Failed to load withdrawals',
    cacheTtlMs: 0,
  });

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (!query.allData) {
        payload.startDate = query.startDate || todayIST();
        payload.endDate = query.endDate || todayIST();
      }
      const res = await secureApi('withdrawals.fundRequest', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load withdrawal summary');
        return;
      }
      setSummary(asWithdrawalSummary(res.data));
    } finally {
      setSummaryLoading(false);
    }
  }, [query.allData, query.startDate, query.endDate]);

  const loadLookups = useCallback(async () => {
    const [midRes, bankRes, countRes] = await Promise.all([
      secureApi('withdrawals.mids', {}),
      secureApi('withdrawals.availableBanks', {}),
      secureApi('withdrawals.beneficiaryAccountsUserCount', {}),
    ]);
    if (midRes.ok) setMids(asList<MidOption>(midRes.data));
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
      setAvailableBanks(banks);
    }
    const countItems = countRes.ok
      ? normalizeBeneAccountCountSummary(countRes.data).items
      : [];
    setBeneAccOptions(buildBenePendingOptions(banks, countItems));
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const appliedNavKey = useRef(location.key);
  useEffect(() => {
    if (location.key === appliedNavKey.current) return;
    appliedNavKey.current = location.key;
    if (!navState?.status) return;
    const nextStart = navState.startDate || todayIST();
    const nextEnd = navState.endDate || todayIST();
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setDraft((prev) => ({ ...prev, status: navState.status || '' }));
    setQuery((prev) => ({
      ...prev,
      startDate: nextStart,
      endDate: nextEnd,
      allData: false,
      filters: { ...prev.filters, status: navState.status || '' },
    }));
    setPage(1);
  }, [location.key, navState]);

  const commitQuery = useCallback(
    (opts?: { allData?: boolean; filters?: ColumnFilters }) => {
      const nextAllData = opts?.allData ?? false;
      setQuery({
        startDate: nextAllData ? '' : startDate,
        endDate: nextAllData ? '' : endDate,
        allData: nextAllData,
        filters: opts?.filters ?? draft,
      });
      setPage(1);
    },
    [startDate, endDate, draft],
  );

  const clearAll = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setDraft(EMPTY_FILTERS);
    setSelectedBeneficiaryAccounts([]);
    setDraftBeneficiaryAccounts([]);
    setBeneSelectOpen(false);
    setQuery({ startDate: '', endDate: '', allData: false, filters: EMPTY_FILTERS });
    setPage(1);
  }, []);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const onDraftChange = useCallback(
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value),
    [setDraftField],
  );

  const onDraftSelect = useCallback(
    (key: keyof ColumnFilters) => (value: string) => {
      setDraftField(key)(value);
      commitQuery({ filters: { ...draft, [key]: value } });
    },
    [draft, setDraftField, commitQuery],
  );

  const refreshAll = useCallback(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  const downloadExcel = useCallback(() => {
    const data = rows.map((row, index) => ({
      'Sr No': index + 1,
      Date: row.createdOn ? formatDisplayDate(row.createdOn) : '',
      accountHolderName: displayUserName(row),
      'Name (send to bank)': sendToBankName(row),
      bankName: row.bankName || '',
      city: row.city || '',
      state: row.state || '',
      status: row.status || '',
      dp_id: row.dp_id || '',
      transactionId: orderIdOf(row),
      'Acc No': row.accountNo || '',
      Amount: row.amount ?? '',
      userBankName: row.userBankName || '',
      ifscCode: row.ifscCode || '',
    }));
    return saveWorkbook(data, {
      sheetName: 'Withdrawal Data',
      filename: `Withdrawal_Data_${Date.now()}.xlsx`,
    });
  }, [rows]);

  const downloadYesBank = useCallback(() => {
    const data = rows.map((row, index) => ({
      'Sr No': index + 1,
      Name: displayUserName(row),
      'Transfer Type': 'IMPS',
      'Acc No': row.accountNo || '',
      Amount: row.amount ?? '',
      IFSC: row.ifscCode || '',
      'Phone No': row.userMobile || row.mobile || '',
      Remarks: 'payment',
    }));
    return saveWorkbook(data, {
      sheetName: 'Yes Bank',
      filename: `yes_bank_sheet_${Date.now()}.xlsx`,
    });
  }, [rows]);

  const downloadPayOk = useCallback(() => {
    const data = rows.map((row) => ({
      'Bank Name (IFSC)': row.ifscCode || '',
      'Bank Account': row.accountNo || '',
      'Amount(INR)': row.amount ?? '',
      'Phone Number': row.userMobile || row.mobile || '',
      AccountName: row.userBankName || '',
      Email: '',
    }));
    return saveWorkbook(data, {
      sheetName: 'Pay OK',
      filename: `pay_ok_sheet_${Date.now()}.xlsx`,
    });
  }, [rows]);

  const searchFilter = useCallback(
    (key: keyof ColumnFilters, placeholder: string) => (
      <TableSearchBar
        value={draft[key]}
        onChange={onDraftChange(key)}
        onSearch={() => commitQuery()}
        placeholder={placeholder}
      />
    ),
    [draft, onDraftChange, commitQuery],
  );

  const selectFilter = useCallback(
    (key: keyof ColumnFilters, options: readonly string[], labelFor?: (v: string) => string) => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft[key]}
        onChange={(e) => onDraftSelect(key)(e.target.value)}
        sx={filterSelectSx}
      >
        {options.map((o) => (
          <MenuItem key={o || 'all'} value={o}>
            {labelFor ? labelFor(o) : o || 'All'}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft, onDraftSelect],
  );

  const midSelect = useMemo(
    () => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft.mid}
        onChange={(e) => onDraftSelect('mid')(e.target.value)}
        sx={filterSelectSx}
      >
        <MenuItem value="">All</MenuItem>
        {mids.map((m, i) => (
          <MenuItem key={`${m.mid ?? ''}-${i}`} value={String(m.mid ?? '')}>
            {midLabel(m)}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft.mid, mids, onDraftSelect],
  );

  const columnFilters = useMemo<WithdrawalColumnFilterSlots>(
    () => ({
      userName: searchFilter('userName', 'User name'),
      mobile: searchFilter('mobile', 'Mobile'),
      clientName: selectFilter('clientName', CLIENT_NAME_OPTIONS, (v) =>
        v ? appCodeForName(v) : 'All',
      ),
      empCode: searchFilter('empCode', 'Emp code'),
      amount: searchFilter('amount', 'Amount'),
      state: selectFilter('state', STATE_OPTIONS),
      city: searchFilter('city', 'City'),
      playedGames: selectFilter('playedGames', WIN_IN_OPTIONS, (v) => v || 'All'),
      status: selectFilter('status', WITHDRAWAL_STATUSES),
      transactionId: searchFilter('transactionId', 'Transaction id'),
      dp_id: searchFilter('dp_id', 'DP id'),
      accountNo: searchFilter('accountNo', 'Account no'),
      ifscCode: searchFilter('ifscCode', 'IFSC'),
      mid: midSelect,
    }),
    [searchFilter, selectFilter, midSelect],
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 1.5,
        py: 1,
      }}
    >
      <Box
        sx={{
          ...toolbarBoxSx,
          flexShrink: 0,
          mb: 1,
          p: 0,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          onClick={() => setFiltersOpen((open) => !open)}
          sx={{
            minHeight: 44,
            px: 1.5,
            py: 0.75,
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: filtersOpen ? '1px solid' : 'none',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <TuneIcon sx={{ color: '#ff9f0a', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Withdrawal
            </Typography>
            {!filtersOpen ? (
              <>
                <Chip
                  size="small"
                  label={`${startDate} → ${endDate}`}
                  variant="outlined"
                  sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 24 }}
                />
                <Chip
                  size="small"
                  label={`${itemsPerPage} / page`}
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    height: 24,
                    fontWeight: 700,
                    color: '#c77a18',
                    bgcolor: 'rgba(255,159,10,0.12)',
                  }}
                />
              </>
            ) : null}
          </Stack>
          <IconButton
            size="small"
            aria-label={filtersOpen ? 'Collapse filters' : 'Expand filters'}
            onClick={(event) => {
              event.stopPropagation();
              setFiltersOpen((open) => !open);
            }}
          >
            {filtersOpen ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>

        <Collapse in={filtersOpen} timeout="auto" unmountOnExit>
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.25} alignItems="center">
              <TextField
                size="small"
                type="date"
                label="From Date"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={{ ...fieldSx, width: 160 }}
              />
              <TextField
                size="small"
                type="date"
                label="To Date"
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={{ ...fieldSx, width: 160 }}
              />
              <TextField
                select
                size="small"
                label="Items / Page"
                value={String(itemsPerPage)}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value) || 10);
                  setPage(1);
                }}
                sx={{ ...fieldSx, width: 120 }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                disabled={loading}
                onClick={() => commitQuery()}
                sx={orangeBtnSx}
              >
                Apply
              </Button>
              <Button
                variant="contained"
                disabled={loading}
                onClick={() => commitQuery({ allData: true })}
                sx={orangeBtnSx}
              >
                All Data
              </Button>
              <Button variant="contained" disabled={loading} onClick={clearAll} sx={orangeBtnSx}>
                Clear
              </Button>
              <Button
                variant="contained"
                startIcon={
                  loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />
                }
                disabled={loading}
                onClick={refreshAll}
                sx={orangeBtnSx}
              >
                Refresh
              </Button>
              {canDownload ? (
                <>
                  <Button
                    variant="contained"
                    disabled={loading}
                    onClick={() =>
                      requestSheetDownload(
                        { mid: query.filters.mid || 'withdrawal', type: 'Withdrawal Sheet' },
                        downloadExcel,
                      )
                    }
                    sx={orangeBtnSx}
                  >
                    Download Data
                  </Button>
                  <Button
                    variant="contained"
                    disabled={loading}
                    onClick={() =>
                      requestSheetDownload(
                        { mid: 'yesBank', type: 'Yes Bank Sheet' },
                        downloadYesBank,
                      )
                    }
                    sx={orangeBtnSx}
                  >
                    Yes Bank Data
                  </Button>
                  <Button
                    variant="contained"
                    disabled={loading}
                    onClick={() =>
                      requestSheetDownload({ mid: 'payok', type: 'Pay OK Sheet' }, downloadPayOk)
                    }
                    sx={orangeBtnSx}
                  >
                    Pay OK Data
                  </Button>
                </>
              ) : null}
            </Stack>

            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              spacing={1}
              alignItems="center"
              sx={{ mt: 1.25 }}
            >
              <TextField
                select
                size="small"
                label="Beneficiary List (Pending)"
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
                    setDraftBeneficiaryAccounts(selectedBeneficiaryAccounts);
                    setBeneSelectOpen(true);
                  },
                  onClose: () => {
                    setBeneSelectOpen(false);
                    const next = draftBeneRef.current;
                    setSelectedBeneficiaryAccounts(next);
                    if (next.length > 0) {
                      setDraft((prev) => ({ ...prev, status: 'Pending' }));
                    }
                    setPage(1);
                  },
                  renderValue: (selected) => {
                    const values = selected as string[];
                    if (values.length === 0) return 'Choose…';
                    if (values.length === 1) {
                      const opt = beneAccOptions.find((o) => o.name === values[0]);
                      return opt
                        ? `${opt.name} (${opt.pendingWithdrawalCount})`
                        : values[0];
                    }
                    return `${values.length} selected`;
                  },
                  MenuProps: {
                    PaperProps: { sx: { maxHeight: 280 } },
                    disableScrollLock: true,
                  },
                }}
                sx={{
                  ...fieldSx,
                  minWidth: 260,
                  width: 280,
                  flex: '0 0 auto',
                  '& .MuiSelect-select': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                {(beneAccOptions.length
                  ? beneAccOptions
                  : availableBanks.map((name) => ({ name, pendingWithdrawalCount: 0 }))
                ).map((option) => (
                  <MenuItem key={option.name} value={option.name}>
                    <Checkbox
                      size="small"
                      checked={draftBeneficiaryAccounts.includes(option.name)}
                    />
                    <ListItemText
                      primary={`${option.name} (${option.pendingWithdrawalCount})`}
                      primaryTypographyProps={{ fontSize: 13 }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>
        </Collapse>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 1, flexShrink: 0 }}
      >
        <Chip label={`Total User : ${total}`} sx={chipSx} />
        <Chip
          label={withdrawalStatLabel(
            'Approved',
            summary.totalApprovedCount,
            summary.totalApprovedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Pending',
            summary.totalPendingCount,
            summary.totalPendingAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Rejected',
            summary.totalRejectedCount,
            summary.totalRejectedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Reverse',
            summary.totalReversedCount,
            summary.totalReversedAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'On Hold',
            summary.totalOnholdCount,
            summary.totalOnholdAmount,
          )}
          sx={chipSx}
        />
        <Chip
          label={withdrawalStatLabel(
            'Cancelled',
            summary.totalCanceledCount,
            summary.totalCanceledAmount,
          )}
          sx={chipSx}
        />
        {summaryLoading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
      </Stack>

      <TablePanel
        footer={
          <>
            <Typography variant="body2" color="text.secondary">
              Total: {total}
            </Typography>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
      >
        <WithdrawalActionTable
          rows={rows}
          page={page}
          pageSize={itemsPerPage}
          loading={loading}
          onRefresh={refreshAll}
          showTotalBeneList
          columnFilters={columnFilters}
          onLookupsChanged={loadLookups}
        />
      </TablePanel>

      <SheetDownloadOtpModal
        open={sheetOtp.open}
        filter={sheetOtp.filter}
        onClose={() => setSheetOtp((s) => ({ ...s, open: false }))}
        onVerified={() => sheetAfterOtp.current?.()}
      />
    </Box>
  );
}
