import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getSessionUser, hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatDisplayDate, formatDisplayTime, todayIST, formatAmount } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import {
  useReportQuery,
  asPaged,
  display,
  maskMobile,
} from './shared';

type NewDepositsRow = {
  _id: string;
  name?: string;
  mobile?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  encryptedUserName?: string;
  previousCaller?: { name?: string; Dp_ID?: string; DP_ID?: string };
  previousCallerName?: string;
  previousCallerDpId?: string;
  currentCaller?: { name?: string };
  referredCode?: string;
  referredReferralCode?: string;
  referralCodeUser?: string;
  referralCode?: string;
  deviceType?: string;
  subDomain?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  balance?: number;
  createdOn?: string;
  updatedAt?: string;
  bonusWalletBalance?: number;
};

type Filters = { name: string; mobile: string };

const EMPTY_FILTERS: Filters = { name: '', mobile: '' };

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={{
        minWidth: 140,
        '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
      }}
    />
  );
}

/** New Deposits — ops.newDeposits (CommonTable UI, same as New Registers). */
export function NewDepositsPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const canShowMobile = hasPermission('show_mobile');

  const accessibleStates = useMemo(() => {
    const user = getSessionUser();
    const raw = (user as { accessibleStates?: unknown })?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
  }, []);

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    return filter;
  }, [applied]);

  const { rows: rawRows, totalPages, total, loading, load } =
    useReportQuery<NewDepositsRow>({
      action: 'ops.newDeposits',
      buildPayload: () => ({
        itemsPerPage,
        pageNo: page,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        filter: buildFilter(),
      }),
      unpack: (res) => asPaged<NewDepositsRow>(res.data),
      autoDeps: [page, itemsPerPage, applied],
      errorMessage: 'Failed to load new deposits',
    });

  const rows = useMemo(() => {
    if (accessibleStates.length === 0) return rawRows;
    return rawRows.filter((row) =>
      accessibleStates.includes(String(row.state || '').toLowerCase()),
    );
  }, [rawRows, accessibleStates]);

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const applyDates = useCallback(() => {
    setPage(1);
    void load();
  }, [load]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const columns = useMemo<CommonTableColumn<NewDepositsRow>[]>(
    () => [
      {
        id: 'index',
        label: 'Sr.No',
        width: 70,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <ColumnSearch
            value={draft.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Search by name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'mobile',
        label: 'Mobile Phone',
        filter: (
          <ColumnSearch
            value={draft.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Search by mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'userBankName', label: 'User Bank Name', render: (row) => display(row.userBankName) },
      {
        id: 'encryptedDpId',
        label: 'User Encrypted Dp ID',
        render: (row) => display(row.encryptedUserName),
      },
      { id: 'account', label: 'Account No', render: (row) => display(row.accountNumber) },
      { id: 'aadhar', label: 'Aadhar No', render: (row) => display(row.aadhaarNumber) },
      {
        id: 'email',
        label: 'Email',
        render: (row) => (canShowMobile ? display(row.email) : '**********'),
      },
      { id: 'city', label: 'City', render: (row) => display(row.city) },
      { id: 'state', label: 'State', render: (row) => display(row.state) },
      {
        id: 'previousCallerName',
        label: 'Previous Caller Name',
        render: (row) => display(row.previousCaller?.name ?? row.previousCallerName),
      },
      {
        id: 'previousCallerDpId',
        label: 'Previous Caller DP ID',
        render: (row) =>
          display(
            row.previousCaller?.Dp_ID ??
              row.previousCaller?.DP_ID ??
              row.previousCallerDpId,
          ),
      },
      {
        id: 'currentCaller',
        label: 'Current Caller',
        render: (row) => display(row.currentCaller?.name),
      },
      {
        id: 'referredCode',
        label: 'Referred Referral Code',
        render: (row) => display(row.referredCode ?? row.referredReferralCode),
      },
      {
        id: 'referralCode',
        label: 'Referral Code',
        render: (row) => display(row.referralCodeUser ?? row.referralCode),
      },
      { id: 'device', label: 'Device Type', render: (row) => display(row.deviceType) },
      { id: 'platform', label: 'Platform', render: (row) => display(row.subDomain) },
      {
        id: 'currentAppVersion',
        label: 'Current App Version',
        render: (row) => display(row.currentAppVersion),
      },
      {
        id: 'updatedAppVersion',
        label: 'Updated App Version',
        render: (row) => display(row.updatedAppVersion),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'created',
        label: 'Created',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => (row.createdOn ? formatDisplayTime(row.createdOn) : '—'),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.updatedAt
            ? `${formatDisplayDate(row.updatedAt)} | ${formatDisplayTime(row.updatedAt)}`
            : '—',
      },
      {
        id: 'bonusBalance',
        label: 'Bonus Balance',
        render: (row) => formatAmount(row.bonusWalletBalance ?? 0),
      },
    ],
    [page, itemsPerPage, draft, search, canShowMobile, setDraftField],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        New Deposits
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1);
            }}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyDates}
            disabled={loading}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Apply
          </Button>
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No new deposits found"
        stickyHeader
        minWidth={2200}
        dense
        maxHeight="calc(100vh - 300px)"
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mt={2}>
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
      </Stack>
    </Box>
  );
}
