import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES } from '@/constants/clientNames';
import {
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { asList, display, useReportQuery } from '@/screens/panel/shared';
import { ArrayFieldEditor } from './depositProviders/ArrayFieldEditor';
import { INDIAN_STATES } from './depositProviders/constants';

type AuditUser = {
  userName?: string;
  userId?: string;
  time?: string;
  remark?: string;
};

type DepositProviderRow = {
  _id: string;
  name?: string;
  displayName?: string;
  gatewayImage?: string;
  displayImage?: string;
  mid?: string;
  midArray?: string[];
  link?: string;
  upiArray?: string[];
  redirectionLink?: string;
  whatsAppNumbers?: string[];
  status?: boolean;
  PaymentType?: string;
  paymentType?: string;
  stateNotAllowed?: string[];
  cityNotAllowed?: string[];
  gatewayType?: string;
  order?: number;
  clientName?: string[];
  clients?: Record<string, { minDeposit?: number; maxDeposit?: number }>;
  bonus?: {
    percentage?: number;
    text?: string;
    tiers?: { minAmount?: number; maxAmount?: number; percentage?: number }[];
  };
  bonusStatus?: boolean;
  updatedBy?: AuditUser;
  updatedOn?: string;
  stateUpdatedBy?: AuditUser;
  orderUpdatedBy?: AuditUser;
  amtUpdatedBy?: AuditUser;
};

type UpdateKind = 'displayName' | 'gatewayImg' | 'name' | 'mid' | 'link';

const EMPTY_FORM = {
  name: '',
  link: '',
  PaymentType: '',
  mid: '',
  displayName: '',
  displayImage: '',
  redirectionLink: '',
  gatewayType: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none' },
};

/** Compact actions inside Updated Payment Config column */
const configBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 9,
  lineHeight: 1.2,
  textTransform: 'uppercase' as const,
  boxShadow: 'none',
  whiteSpace: 'normal' as const,
  minWidth: 78,
  width: 78,
  maxWidth: 78,
  flex: '0 0 78px',
  px: 0.4,
  py: 0.55,
  borderRadius: 1,
  height: 'auto',
  minHeight: 36,
  overflow: 'hidden',
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none' },
};

const dateFieldSx = {
  width: 160,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function auditLine(user?: AuditUser, fallbackTime?: string) {
  if (!user?.userName && !fallbackTime && !user?.time) return '—';
  const time = user?.time || fallbackTime;
  return (
    <Stack spacing={0.25} alignItems="center">
      {user?.remark ? (
        <Typography variant="caption" sx={{ color: '#ffd28a' }}>
          {user.remark}
        </Typography>
      ) : null}
      <Typography variant="body2">{display(user?.userName)}</Typography>
      {time ? (
        <Typography variant="caption" color="text.secondary">
          {formatDisplayDate(time)} {formatDisplayTime(time)}
        </Typography>
      ) : null}
    </Stack>
  );
}

export function DepositProvidersPage() {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const canAdd = hasPermission(Permissions.Add_PayIn_Account);
  const canToggle = hasPermission(Permissions.Toggle_PayIn_Account);
  const canDelete = hasPermission(Permissions.Delete_PayIn_Account);
  const canEdit = !hasPermission(Permissions.Disable_Deposit_Provider_Edit);
  const canUpdateAmount = hasPermission(Permissions.Update_Deposit_Amount_Edit);

  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [appliedStart, setAppliedStart] = useState(() => todayIST());
  const [appliedEnd, setAppliedEnd] = useState(() => todayIST());

  const [searchGatewayName, setSearchGatewayName] = useState('');
  const [searchDisplayName, setSearchDisplayName] = useState('');
  const [searchMid, setSearchMid] = useState('');
  const [searchLink, setSearchLink] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [intentOpen, setIntentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const [activeId, setActiveId] = useState('');
  const [activeRow, setActiveRow] = useState<DepositProviderRow | null>(null);
  const [updateKind, setUpdateKind] = useState<UpdateKind>('displayName');
  const [updateText, setUpdateText] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [intentName, setIntentName] = useState('');
  const [intentMid, setIntentMid] = useState('');
  const [orderValue, setOrderValue] = useState(1);
  const [orderRemark, setOrderRemark] = useState('');
  const [amountApp, setAmountApp] = useState('');
  const [minDeposit, setMinDeposit] = useState('');
  const [maxDeposit, setMaxDeposit] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  const [bonusText, setBonusText] = useState('');
  const [bonusStatus, setBonusStatus] = useState(false);
  const [stateDraft, setStateDraft] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (appliedStart) payload.startDate = appliedStart;
    if (appliedEnd) payload.endDate = appliedEnd;
    return payload;
  }, [appliedStart, appliedEnd]);

  const unpack = useCallback((res: { data?: unknown }) => {
    const list = asList<DepositProviderRow>(res.data).sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status ? -1 : 1;
    });
    return { rows: list };
  }, []);

  const { rows, loading, load, setRows } = useReportQuery<DepositProviderRow>({
    action: 'depositProviders.list',
    buildPayload,
    unpack,
    autoDeps: [appliedStart, appliedEnd],
    errorMessage: 'Failed to load deposit providers',
  });

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        searchGatewayName &&
        !String(row.name || '')
          .toLowerCase()
          .includes(searchGatewayName.toLowerCase())
      ) {
        return false;
      }
      if (
        searchDisplayName &&
        !String(row.displayName || '')
          .toLowerCase()
          .includes(searchDisplayName.toLowerCase())
      ) {
        return false;
      }
      if (
        searchMid &&
        !String(row.mid ?? '')
          .toLowerCase()
          .includes(searchMid.toLowerCase())
      ) {
        return false;
      }
      if (searchLink) {
        const hay = `${row.link || ''} ${row.redirectionLink || ''}`.toLowerCase();
        if (!hay.includes(searchLink.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, searchGatewayName, searchDisplayName, searchMid, searchLink]);

  const applyDates = () => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const clearDates = () => {
    const today = todayIST();
    setStartDate(today);
    setEndDate(today);
    setAppliedStart(today);
    setAppliedEnd(today);
  };

  const openUpdate = (row: DepositProviderRow, kind: UpdateKind, current?: string) => {
    if (!canEdit) return;
    setActiveId(row._id);
    setActiveRow(row);
    setUpdateKind(kind);
    setUpdateText(current || '');
    setUpdateOpen(true);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.link.trim() ||
      !form.PaymentType.trim() ||
      !form.mid.trim() ||
      !form.displayImage.trim() ||
      !form.displayName.trim() ||
      !form.gatewayType.trim() ||
      !form.redirectionLink.trim()
    ) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.create', {
        name: form.name.trim(),
        link: form.link.trim(),
        status: false,
        PaymentType: form.PaymentType.trim(),
        mid: form.mid.trim(),
        state: [],
        displayName: form.displayName.trim(),
        displayImage: form.displayImage.trim(),
        redirectionLink: form.redirectionLink.trim(),
        gatewayType: form.gatewayType.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add deposit provider');
        return;
      }
      toast.success('Deposit provider added');
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleIntentPay = async (event: FormEvent) => {
    event.preventDefault();
    if (!intentName.trim() || !intentMid.trim()) {
      toast.error('Enter parent company and mid');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.cloneIntentPay', {
        name: intentName.trim(),
        mid: intentMid.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to create intent pay mid');
        return;
      }
      toast.success('Intent pay mid added');
      setIntentOpen(false);
      setIntentName('');
      setIntentMid('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateField = async () => {
    if (!updateText.trim()) {
      toast.error('Please enter a value');
      return;
    }
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = { _id: activeId };
      if (updateKind === 'mid') data.mid = updateText.trim();
      else if (updateKind === 'displayName') data.displayName = updateText.trim();
      else if (updateKind === 'gatewayImg') data.gatewayImage = updateText.trim();
      else if (updateKind === 'name') data.name = updateText.trim();
      else data.link = updateText.trim();

      const res = await secureApi('depositProviders.updateMidNameLink', data);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update');
        return;
      }
      toast.success('Updated');
      setUpdateOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (row: DepositProviderRow, next: boolean) => {
    setTogglingId(row._id);
    try {
      const res = await secureApi('depositProviders.update', {
        _id: row._id,
        status: next,
        name: row.name,
        updatedBy: { userId: user?._id, userName: user?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      setRows((prev) =>
        prev.map((item) => {
          if (item._id === row._id) return { ...item, status: next };
          if (next && item.name === row.name && item._id !== row._id) {
            return { ...item, status: false };
          }
          return item;
        }),
      );
      void load();
    } finally {
      setTogglingId('');
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.delete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete');
        return;
      }
      toast.success('Deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const saveStates = async (row: DepositProviderRow) => {
    const states = stateDraft[row._id] ?? asStringList(row.stateNotAllowed);
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.updateBonusAndClients', {
        _id: row._id,
        stateNotAllowed: { states, action: 'add' },
        updatedBy: { userId: user?._id, userName: user?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update states');
        return;
      }
      toast.success('States updated');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitOrder = async () => {
    if (!orderRemark.trim()) {
      toast.error('Please enter remark');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.updateOrder', {
        _id: activeId,
        order: orderValue,
        orderUpdatedBy: {
          userId: user?._id,
          userName: user?.name,
          remark: orderRemark.trim(),
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update order');
        return;
      }
      toast.success('Order updated');
      setOrderOpen(false);
      setOrderRemark('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitAmount = async () => {
    if (!amountApp || !minDeposit || !maxDeposit || !activeRow?.mid) {
      toast.error('Select app and enter min/max deposit');
      return;
    }
    const min = Number(minDeposit);
    const max = Number(maxDeposit);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      toast.error('Enter valid min/max deposit');
      return;
    }

    const apps =
      amountApp === 'All'
        ? (activeRow.clientName?.length ? activeRow.clientName.map(String) : [...CLIENT_NAMES])
        : [amountApp];

    setSubmitting(true);
    try {
      let okCount = 0;
      let failCount = 0;
      for (const appName of apps) {
        const res = await secureApi('depositProviders.updateGatewayAmt', {
          appName,
          mid: activeRow.mid,
          minDeposit: min,
          maxDeposit: max,
          amtUpdatedBy: { userId: user?._id, userName: user?.name },
        });
        if (res.ok) okCount += 1;
        else failCount += 1;
      }

      if (okCount === 0) {
        toast.error('Failed to update amount');
        return;
      }
      if (failCount > 0) {
        toast.warning(`Updated ${okCount} app(s), failed ${failCount}`);
      } else {
        toast.success(
          amountApp === 'All'
            ? `Min/Max updated for all ${okCount} apps`
            : 'Amount updated',
        );
      }
      setAmountOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitBonus = async () => {
    if (!activeRow) return;
    setSubmitting(true);
    try {
      const res = await secureApi('depositProviders.updateBonusAndClients', {
        _id: activeRow._id,
        bonus: {
          percentage: Number(bonusPercent) || 0,
          text: bonusText,
          tiers: activeRow.bonus?.tiers || [],
        },
        bonusStatus,
        updatedBy: { userId: user?._id, userName: user?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update bonus');
        return;
      }
      toast.success('Bonus updated');
      setBonusOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<CommonTableColumn<DepositProviderRow>[]>(() => {
    const cols: CommonTableColumn<DepositProviderRow>[] = [];

    if (canDelete) {
      cols.push({
        id: 'delete',
        label: '',
        width: 48,
        filter: <Box />,
        render: (row) => (
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setActiveId(row._id);
              setDeleteOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      });
    }

    cols.push(
      {
        id: 'name',
        label: 'Gateway Name',
        filter: (
          <TableSearchBar
            value={searchGatewayName}
            onChange={(e) => setSearchGatewayName(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search Gateway"
            width={130}
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'displayName',
        label: 'Gateway Display Name',
        filter: (
          <TableSearchBar
            value={searchDisplayName}
            onChange={(e) => setSearchDisplayName(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search Display"
            width={130}
          />
        ),
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.displayName)}</Typography>
            {canEdit && (
              <IconButton size="small" onClick={() => openUpdate(row, 'displayName', row.displayName)}>
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </Stack>
        ),
      },
    );

    if (canToggle) {
      cols.push({
        id: 'status',
        label: 'Status',
        filter: <Box />,
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onChange={(_, checked) => void handleToggle(row, checked)}
          />
        ),
      });
    }

    cols.push(
      {
        id: 'image',
        label: 'Gateway Image',
        filter: <Box />,
        render: (row) => {
          const src = row.gatewayImage || row.displayImage;
          return (
            <Stack spacing={0.5} alignItems="center">
              {src ? (
                <Box
                  component="img"
                  src={src}
                  alt={row.displayName || row.name || 'gateway'}
                  sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 1, bgcolor: '#fff' }}
                />
              ) : (
                '—'
              )}
              {canEdit && (
                <IconButton size="small" onClick={() => openUpdate(row, 'gatewayImg', src)}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        id: 'mid',
        label: 'Mid',
        filter: (
          <TableSearchBar
            value={searchMid}
            onChange={(e) => setSearchMid(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search Mid"
            width={110}
          />
        ),
        render: (row) => {
          const mids = asStringList(row.midArray);
          if (mids.length > 0) {
            return (
              <ArrayFieldEditor
                rowId={row._id}
                values={mids}
                selectedValue={row.mid}
                label="MID"
                placeholder="Add Mid"
                arrayAction="depositProviders.updateMidArray"
                arrayKey="midArray"
                selectedKey="mid"
                onRefresh={() => void load()}
              />
            );
          }
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography variant="body2">{display(row.mid)}</Typography>
              {canEdit && (
                <IconButton size="small" onClick={() => openUpdate(row, 'mid', row.mid)}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        id: 'link',
        label: 'Link',
        filter: (
          <TableSearchBar
            value={searchLink}
            onChange={(e) => setSearchLink(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search Link"
            width={120}
          />
        ),
        render: (row) => {
          const links = asStringList(row.upiArray);
          if (links.length > 0 || row.upiArray) {
            return (
              <ArrayFieldEditor
                rowId={row._id}
                values={links.length ? links : row.link ? [row.link] : []}
                selectedValue={row.link}
                label="Link"
                placeholder="Add Link"
                arrayAction="depositProviders.updateUpiArray"
                arrayKey="upiArray"
                selectedKey="link"
                onRefresh={() => void load()}
              />
            );
          }
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography
                variant="body2"
                sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {display(row.link)}
              </Typography>
              {canEdit && (
                <IconButton size="small" onClick={() => openUpdate(row, 'link', row.link)}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        id: 'restriction',
        label: 'Restriction Info',
        filter: <Box />,
        render: (row) => (
          <ArrayFieldEditor
            rowId={row._id}
            values={asStringList(row.whatsAppNumbers)}
            selectedValue={
              row.redirectionLink?.includes('wa.me/')
                ? row.redirectionLink.split('wa.me/')[1]
                : row.redirectionLink
            }
            label="Mobile No"
            placeholder="Add Mobile"
            arrayAction="depositProviders.updateWhatsappNumbers"
            arrayKey="whatsAppNumbers"
            selectedKey="redirectionLink"
            onRefresh={() => void load()}
          />
        ),
      },
      {
        id: 'states',
        label: 'State (Whom to show/not show)',
        width: 220,
        cellSx: {
          whiteSpace: 'normal',
          maxWidth: 220,
          overflow: 'hidden',
          verticalAlign: 'top',
        },
        filter: <Box />,
        render: (row) => {
          const selected = stateDraft[row._id] ?? asStringList(row.stateNotAllowed);
          return (
            <Stack
              spacing={0.75}
              sx={{
                width: '100%',
                maxWidth: 200,
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <Select
                multiple
                size="small"
                fullWidth
                value={selected}
                onChange={(e) => {
                  const value = e.target.value;
                  setStateDraft((prev) => ({
                    ...prev,
                    [row._id]: typeof value === 'string' ? value.split(',') : value,
                  }));
                }}
                input={<OutlinedInput />}
                renderValue={(vals) =>
                  vals.length > 2 ? `${vals.slice(0, 2).join(', ')} +${vals.length - 2}` : vals.join(', ')
                }
                sx={{
                  bgcolor: '#121218',
                  fontSize: 12,
                  maxWidth: '100%',
                  '& .MuiSelect-select': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              >
                {INDIAN_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    <Checkbox size="small" checked={selected.includes(state)} />
                    <ListItemText primary={state} />
                  </MenuItem>
                ))}
              </Select>
              <Button
                size="small"
                variant="contained"
                sx={orangeBtnSx}
                disabled={submitting}
                onClick={() => void saveStates(row)}
              >
                Submit
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'city',
        label: 'City (Whom to show/not show)',
        width: 200,
        cellSx: {
          whiteSpace: 'normal',
          maxWidth: 200,
          overflow: 'hidden',
          verticalAlign: 'top',
        },
        filter: <Box />,
        render: (row) => (
          <ArrayFieldEditor
            rowId={row._id}
            values={asStringList(row.cityNotAllowed)}
            label="City"
            placeholder="Add City"
            selectedKey="city"
            onRefresh={() => void load()}
            userId={user?._id}
            userName={user?.name}
          />
        ),
      },
      {
        id: 'stateUpdatedBy',
        label: 'State Updated By',
        filter: <Box />,
        render: (row) => auditLine(row.stateUpdatedBy),
      },
      {
        id: 'paymentType',
        label: 'Payment type',
        filter: <Box />,
        render: (row) => display(row.PaymentType || row.paymentType),
      },
      {
        id: 'enableBy',
        label: 'Status Change By',
        filter: <Box />,
        render: (row) => auditLine(row.updatedBy, row.updatedOn),
      },
      {
        id: 'order',
        label: 'Order',
        filter: <Box />,
        render: (row) => (
          <TextField
            select
            size="small"
            value={String(row.order ?? 1)}
            onChange={(e) => {
              setActiveId(row._id);
              setOrderValue(Number(e.target.value));
              setOrderRemark('');
              setOrderOpen(true);
            }}
            sx={{ width: 72, '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        ),
      },
      {
        id: 'orderUpdatedBy',
        label: 'Status Updated By',
        filter: <Box />,
        render: (row) => auditLine(row.orderUpdatedBy),
      },
      {
        id: 'paymentConfig',
        label: (
          <>
            Updated
            <br />
            Payment Config
          </>
        ),
        width: 176,
        headSx: {
          whiteSpace: 'normal',
          lineHeight: 1.2,
          maxWidth: 176,
          px: 0.75,
        },
        cellSx: {
          whiteSpace: 'normal',
          maxWidth: 176,
          width: 176,
          overflow: 'hidden',
          verticalAlign: 'middle',
          px: 0.75,
        },
        filter: <Box />,
        render: (row) =>
          canUpdateAmount ? (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              justifyContent="center"
              sx={{ py: 0.25, width: '100%', maxWidth: 168 }}
            >
              <Button
                size="small"
                variant="contained"
                sx={configBtnSx}
                onClick={() => {
                  setActiveRow(row);
                  setAmountApp(row.clientName?.[0] || CLIENT_NAMES[0] || '');
                  const client = row.clients?.[row.clientName?.[0] || ''];
                  setMinDeposit(String(client?.minDeposit ?? ''));
                  setMaxDeposit(String(client?.maxDeposit ?? ''));
                  setAmountOpen(true);
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                  }}
                >
                  Update
                  <br />
                  Amount
                </Box>
              </Button>
              <Button
                size="small"
                variant="contained"
                sx={configBtnSx}
                onClick={() => {
                  setActiveRow(row);
                  setBonusPercent(String(row.bonus?.percentage ?? ''));
                  setBonusText(row.bonus?.text || '');
                  setBonusStatus(Boolean(row.bonusStatus));
                  setBonusOpen(true);
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    lineHeight: 1.15,
                    overflow: 'hidden',
                    fontSize: 8.5,
                  }}
                >
                  Update
                  <br />
                  Bonus
                </Box>
              </Button>
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        id: 'amtUpdatedBy',
        label: 'Amount updated By',
        filter: <Box />,
        render: (row) => auditLine(row.amtUpdatedBy),
      },
    );

    return cols.map((col) => ({
      ...col,
      cellSx: [{ verticalAlign: 'top', py: 1 }, col.cellSx] as typeof col.cellSx,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchGatewayName,
    searchDisplayName,
    searchMid,
    searchLink,
    canDelete,
    canToggle,
    canEdit,
    canUpdateAmount,
    togglingId,
    stateDraft,
    submitting,
    user?._id,
    user?.name,
  ]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: '#1a1a1f',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{ overflowX: 'auto', '& > *': { flexShrink: 0 } }}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={dateFieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={dateFieldSx}
          />
          <Button variant="contained" onClick={applyDates} sx={orangeBtnSx}>
            Apply
          </Button>
          <Button variant="contained" onClick={clearDates} sx={orangeBtnSx}>
            Clear All
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={loading}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          {canAdd && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setForm(EMPTY_FORM);
                setAddOpen(true);
              }}
              sx={orangeBtnSx}
            >
              Add
            </Button>
          )}
          {canAdd && (
            <Button
              variant="contained"
              onClick={() => {
                setIntentName('');
                setIntentMid('');
                setIntentOpen(true);
              }}
              sx={orangeBtnSx}
            >
              Instant Payout
            </Button>
          )}
        </Stack>
      </Box>

      <CommonTable
        columns={columns}
        rows={filteredRows}
        loading={loading}
        getRowKey={(row) => row._id}
        emptyMessage="No deposit providers"
        dense
        virtualize={false}
      />

      {/* Add provider */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Deposit Provider</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleCreate(e)}>
          <DialogContent>
            <Stack spacing={1.5}>
              {(
                [
                  ['name', 'Gateway Name'],
                  ['displayName', 'Display Name'],
                  ['displayImage', 'Gateway Image URL'],
                  ['mid', 'Mid'],
                  ['link', 'Link'],
                  ['redirectionLink', 'Redirection Link'],
                  ['PaymentType', 'Payment Type'],
                  ['gatewayType', 'Gateway Type'],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  fullWidth
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Instant / Intent Pay */}
      <Dialog open={intentOpen} onClose={() => setIntentOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Intent Pay Mid</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleIntentPay(e)}>
          <DialogContent>
            <Stack spacing={1.5}>
              <TextField
                label="Parent Company / Name"
                fullWidth
                value={intentName}
                onChange={(e) => setIntentName(e.target.value)}
              />
              <TextField
                label="Mid"
                fullWidth
                value={intentMid}
                onChange={(e) => setIntentMid(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIntentOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Inline field update */}
      <Dialog open={updateOpen} onClose={() => setUpdateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => void handleUpdateField()} sx={orangeBtnSx}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order remark */}
      <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update Order ({orderValue})</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Remark"
            value={orderRemark}
            onChange={(e) => setOrderRemark(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => void submitOrder()} sx={orangeBtnSx}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update amount */}
      <Dialog open={amountOpen} onClose={() => setAmountOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update Amount</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              select
              label="App / Client"
              fullWidth
              value={amountApp}
              onChange={(e) => {
                const next = e.target.value;
                setAmountApp(next);
                if (next === 'All') return;
                const client = activeRow?.clients?.[next];
                setMinDeposit(String(client?.minDeposit ?? ''));
                setMaxDeposit(String(client?.maxDeposit ?? ''));
              }}
            >
              <MenuItem value="All">All</MenuItem>
              {CLIENT_NAMES.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Min Deposit"
              fullWidth
              value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)}
            />
            <TextField
              label="Max Deposit"
              fullWidth
              value={maxDeposit}
              onChange={(e) => setMaxDeposit(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAmountOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => void submitAmount()} sx={orangeBtnSx}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update bonus */}
      <Dialog open={bonusOpen} onClose={() => setBonusOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update Bonus / MaxPay</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Bonus %"
              fullWidth
              value={bonusPercent}
              onChange={(e) => setBonusPercent(e.target.value)}
            />
            <TextField
              label="Bonus Text"
              fullWidth
              value={bonusText}
              onChange={(e) => setBonusText(e.target.value)}
            />
            <FormControlLabel
              control={
                <Switch checked={bonusStatus} onChange={(_, v) => setBonusStatus(v)} />
              }
              label="Bonus Status"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBonusOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => void submitBonus()} sx={orangeBtnSx}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Are You Sure?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={submitting} onClick={() => void handleDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
