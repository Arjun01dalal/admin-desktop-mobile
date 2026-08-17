import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  MenuItem,
  Modal,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { canAccessNavItem, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { dateTime, formatDisplayDate, todayIST } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { appCodeForName } from '@/constants/clientNames';
import { CLIENT_NAMES } from '@/screens/panel/shared/clientNames';
import { display } from '@/screens/panel/shared';

type KycListRow = {
  _id: string;
  name?: string;
  ifsc?: string;
  clientName?: string;
  aadhaarNumber?: string;
  accountNumber?: string;
  bankName?: string;
  upiId?: string;
  currentKycNote?: string;
  adharImageURL?: string;
  kycDocCheckBy?: { name?: string; date?: string };
  kycDocCrossCheckBy?: { name?: string; date?: string };
  KycUpdatedBy?: { name?: string; date?: string };
  manualKycUpdatedBy?: { name?: string; date?: string };
  [key: string]: unknown;
};

type Filters = {
  name: string;
  dpId: string;
  accountNumber: string;
  aadhaarNumber: string;
  mobile: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  accountNumber: '',
  aadhaarNumber: '',
  mobile: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  height: 36,
  px: 2.5,
  borderRadius: 1,
  '&:hover': { bgcolor: '#e08c00' },
};

const fieldSx = {
  width: 160,
  flex: '0 0 auto',
  '& .MuiInputBase-root': { bgcolor: '#121218' },
};

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
        minWidth: 110,
        '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
      }}
    />
  );
}

export function KycListPage() {
  const navigate = useNavigate();
  const canView = canAccessNavItem({
    id: 'usersKyc',
    permission: Permissions.View_KYCs,
  });

  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<KycListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, filtersOverride?: Filters) => {
      const active = filtersOverride ?? appliedFilters;
      const gen = next();
      begin();
      setLoading(true);
      try {
        const filter: Record<string, string> = {};
        if (active.name.trim()) filter.name = active.name.trim();
        if (active.dpId.trim()) filter._id = active.dpId.trim();
        if (active.mobile.trim()) filter.mobile = active.mobile.trim();
        if (active.aadhaarNumber.trim()) {
          filter.aadhaarNumber = active.aadhaarNumber.trim();
        }
        if (active.accountNumber.trim()) {
          filter.accountNumber = active.accountNumber.trim();
        }
        if (appClientName) filter.clientName = appClientName;

        const payload: Record<string, unknown> = {
          itemsPerPage: pageSize,
          pageNo,
          filter,
        };
        if (startDate && endDate) {
          payload.kycStartDate = dateTime(startDate);
          payload.kycEndDate = dateTime(endDate);
        }

        const res = await secureApi('users.getAll', payload);
        if (!isCurrent(gen)) return;
        if (!res.ok || res.success === false) {
          toast.error(res.message || 'Failed to load KYC list');
          setRows([]);
          setTotalPages(1);
          return;
        }

        const data = (res.data || {}) as Record<string, unknown>;
        const items = Array.isArray(data.users)
          ? (data.users as KycListRow[])
          : Array.isArray(data.items)
            ? (data.items as KycListRow[])
            : [];
        setRows(items);
        setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      page,
      pageSize,
      startDate,
      endDate,
      appClientName,
      appliedFilters,
      next,
      begin,
      end,
      isCurrent,
    ],
  );

  useEffect(() => {
    if (canView) void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appClientName, canView]);

  const apply = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    void load(1, draftFilters);
  }, [draftFilters, load]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const columns = useMemo<CommonTableColumn<KycListRow>[]>(
    () => [
      {
        id: 'name',
        label: 'User Name',
        filter: (
          <ColumnSearch
            value={draftFilters.name}
            onChange={setDraftField('name')}
            onSearch={apply}
            placeholder="Search by name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'dpId',
        label: 'User ID',
        filter: (
          <ColumnSearch
            value={draftFilters.dpId}
            onChange={setDraftField('dpId')}
            onSearch={apply}
            placeholder="Search by DP ID"
          />
        ),
        render: (row) => display(row._id),
      },
      {
        id: 'ifsc',
        label: 'IFSC',
        render: (row) => display(row.ifsc),
      },
      {
        id: 'app',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={appClientName}
            onChange={(e) => {
              setAppClientName(e.target.value);
              setPage(1);
            }}
            sx={{
              minWidth: 120,
              '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
            }}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'docCheck',
        label: 'Doc Checked By',
        render: (row) =>
          row.kycDocCheckBy?.name ? (
            <Stack spacing={0.25}>
              <span>{row.kycDocCheckBy.name}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {row.kycDocCheckBy.date
                  ? formatDisplayDate(row.kycDocCheckBy.date)
                  : ''}
              </span>
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        id: 'docCross',
        label: 'Doc Cross Checked By',
        render: (row) =>
          row.kycDocCrossCheckBy?.name ? (
            <Stack spacing={0.25}>
              <span>{row.kycDocCrossCheckBy.name}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {row.kycDocCrossCheckBy.date
                  ? formatDisplayDate(row.kycDocCrossCheckBy.date)
                  : ''}
              </span>
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        id: 'note',
        label: 'Note',
        width: 220,
        render: (row) => display(row.currentKycNote),
      },
      {
        id: 'aadhaar',
        label: 'Aadhar No',
        filter: (
          <ColumnSearch
            value={draftFilters.aadhaarNumber}
            onChange={setDraftField('aadhaarNumber')}
            onSearch={apply}
            placeholder="Search by Aadhar No"
          />
        ),
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'aadhaarImg',
        label: 'Aadhar Image',
        render: (row) =>
          row.adharImageURL ? (
            <Button
              size="small"
              onClick={() => setPreviewImage(String(row.adharImageURL))}
              sx={{ textTransform: 'none', color: '#0b5fff' }}
            >
              View Aadhar Card
            </Button>
          ) : (
            '—'
          ),
      },
      {
        id: 'account',
        label: 'Account No',
        filter: (
          <ColumnSearch
            value={draftFilters.accountNumber}
            onChange={setDraftField('accountNumber')}
            onSearch={apply}
            placeholder="Search by Account No"
          />
        ),
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'bank',
        label: 'Bank Name',
        render: (row) => display(row.bankName),
      },
      {
        id: 'upi',
        label: 'UPI ID',
        render: (row) => display(row.upiId),
      },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) => {
          const by = row.KycUpdatedBy || row.manualKycUpdatedBy;
          if (!by?.name) return '—';
          return (
            <Stack spacing={0.25}>
              <span>{by.name}</span>
              {row.manualKycUpdatedBy?.date ? (
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  {formatDisplayDate(row.manualKycUpdatedBy.date)}
                </span>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [draftFilters, setDraftField, apply, appClientName],
  );

  if (!canView) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          KYC User List
        </Typography>
        <Typography color="text.secondary">
          You do not have permission to view this page.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <CollapsibleFilterPanel
        title="KYC User List"
        summary={`${startDate} → ${endDate}`}
        sx={{ overflow: 'visible' }}
        contentSx={{ pt: 2.25 }}
      >
        <Box sx={{ overflowX: 'auto', overflowY: 'visible', pb: 0.25 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ pt: 1, minWidth: 'max-content' }}
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            fullWidth={false}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...fieldSx, width: 130 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={apply}
            disabled={loading}
            sx={orangeBtnSx}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/users-kyc')}
            sx={orangeBtnSx}
          >
            KYC
          </Button>
        </Stack>
        </Box>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          <>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No KYC records found"
          stickyHeader
          dense
          minWidth={1600}
          maxHeight="100%"
        />
      </TablePanel>

      <Modal open={Boolean(previewImage)} onClose={() => setPreviewImage('')}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: '#fff',
            boxShadow: 24,
            p: 2,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <img
            src={previewImage}
            alt="Aadhar"
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain' }}
          />
        </Box>
      </Modal>
    </Box>
  );
}
