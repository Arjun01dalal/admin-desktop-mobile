import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { toast } from 'react-toastify';
import {
  asPaged,
  emptyPushCampaignForm,
  fromIstInputValue,
  pushCampaignIntervalLabel,
  toIstInputValue,
  unpackUploadImagePath,
  type PushCampaign,
  type PushCampaignForm,
  type PushCampaignStatus,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useReportQuery } from '@/screens/panel/shared';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type ConfirmAction = 'pause' | 'resume' | 'cancel' | 'send-now' | 'restart';

const headerFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const mutedTextSx = { color: '#9aa3b5', fontSize: 12, lineHeight: 1.35 };
const primaryTextSx = { color: '#e8e8ea', fontSize: 13, fontWeight: 600, lineHeight: 1.35 };

const STATUS_OPTIONS = ['All', 'Active', 'Paused', 'Completed', 'Cancelled'] as const;

const ACTION_TO_SECURE: Record<ConfirmAction, SecureAction> = {
  pause: 'ops.pushCampaignPause',
  resume: 'ops.pushCampaignResume',
  cancel: 'ops.pushCampaignCancel',
  'send-now': 'ops.pushCampaignSendNow',
  restart: 'ops.pushCampaignRestart',
};

const ACTION_SUCCESS: Record<ConfirmAction, string> = {
  pause: 'Push notification paused',
  resume: 'Push notification resumed',
  cancel: 'Push notification cancelled',
  'send-now': 'Notification sent to all subscribed users',
  restart: 'Push notification started again',
};

function statusChipProps(status: PushCampaignStatus): {
  label: string;
  sx: Record<string, unknown>;
} {
  const base = {
    height: 24,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'capitalize' as const,
    border: '1px solid',
  };
  if (status === 'active') {
    return {
      label: 'Active',
      sx: {
        ...base,
        color: '#6ee7b7',
        bgcolor: 'rgba(16,185,129,0.14)',
        borderColor: 'rgba(16,185,129,0.35)',
      },
    };
  }
  if (status === 'paused') {
    return {
      label: 'Paused',
      sx: {
        ...base,
        color: '#fbbf24',
        bgcolor: 'rgba(245,158,11,0.14)',
        borderColor: 'rgba(245,158,11,0.35)',
      },
    };
  }
  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      sx: {
        ...base,
        color: '#fca5a5',
        bgcolor: 'rgba(239,68,68,0.14)',
        borderColor: 'rgba(239,68,68,0.35)',
      },
    };
  }
  return {
    label: 'Completed',
    sx: {
      ...base,
      color: '#94a3b8',
      bgcolor: 'rgba(148,163,184,0.12)',
      borderColor: 'rgba(148,163,184,0.28)',
    },
  };
}

function formatCompactIst(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function confirmLabel(action: ConfirmAction): string {
  if (action === 'send-now') {
    return 'Send this notification to every device subscribed to all_app_topic_rn now?';
  }
  if (action === 'cancel') {
    return 'Cancel this push notification? It cannot be resumed later.';
  }
  if (action === 'pause') {
    return 'Pause this push notification? Scheduled sends will stop until you resume it.';
  }
  if (action === 'restart') {
    return 'Start this completed push notification again?';
  }
  return 'Resume this push notification?';
}

function PushRowActions({
  row,
  onEdit,
  onConfirm,
}: {
  row: PushCampaign;
  onEdit: (row: PushCampaign) => void;
  onConfirm: (id: string, action: ConfirmAction) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const canEdit =
    row.status === 'active' || row.status === 'paused' || row.status === 'completed';
  const canStart = row.status === 'completed';
  const canPause = row.status === 'active';
  const canResume = row.status === 'paused';
  const canSendOrCancel = row.status === 'active' || row.status === 'paused';

  const close = () => setAnchorEl(null);

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
        {canEdit ? (
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => onEdit(row)}
              sx={{
                color: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
                '&:hover': { bgcolor: 'rgba(255,159,10,0.18)' },
              }}
            >
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : null}
        {(canStart || canPause || canResume || canSendOrCancel) && (
          <Tooltip title="More actions">
            <IconButton
              size="small"
              onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
              sx={{
                color: '#c8cdd8',
                bgcolor: 'rgba(255,255,255,0.04)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              bgcolor: '#1a1a22',
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundImage: 'none',
            },
          },
        }}
      >
        {canStart ? (
          <MenuItem
            onClick={() => {
              close();
              onConfirm(row._id, 'restart');
            }}
          >
            <ListItemIcon>
              <PlayCircleOutlineIcon fontSize="small" sx={{ color: '#6ee7b7' }} />
            </ListItemIcon>
            <ListItemText>Start again</ListItemText>
          </MenuItem>
        ) : null}
        {canPause ? (
          <MenuItem
            onClick={() => {
              close();
              onConfirm(row._id, 'pause');
            }}
          >
            <ListItemIcon>
              <PauseCircleOutlineIcon fontSize="small" sx={{ color: '#fbbf24' }} />
            </ListItemIcon>
            <ListItemText>Pause</ListItemText>
          </MenuItem>
        ) : null}
        {canResume ? (
          <MenuItem
            onClick={() => {
              close();
              onConfirm(row._id, 'resume');
            }}
          >
            <ListItemIcon>
              <PlayCircleOutlineIcon fontSize="small" sx={{ color: '#6ee7b7' }} />
            </ListItemIcon>
            <ListItemText>Resume</ListItemText>
          </MenuItem>
        ) : null}
        {canSendOrCancel ? (
          <MenuItem
            onClick={() => {
              close();
              onConfirm(row._id, 'send-now');
            }}
          >
            <ListItemIcon>
              <SendOutlinedIcon fontSize="small" sx={{ color: '#ff9f0a' }} />
            </ListItemIcon>
            <ListItemText>Send now</ListItemText>
          </MenuItem>
        ) : null}
        {canSendOrCancel ? (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <MenuItem
              onClick={() => {
                close();
                onConfirm(row._id, 'cancel');
              }}
              sx={{ color: '#f87171' }}
            >
              <ListItemIcon>
                <CancelOutlinedIcon fontSize="small" sx={{ color: '#f87171' }} />
              </ListItemIcon>
              <ListItemText>Cancel</ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>
    </>
  );
}

export function PushNotificationsPage() {
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [appliedTitle, setAppliedTitle] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<PushCampaignForm>(emptyPushCampaignForm());
  const [titleError, setTitleError] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [startError, setStartError] = useState('');
  const [endError, setEndError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; action: ConfirmAction } | null>(null);

  const { rows, total, totalPages, loading, error, load } = useReportQuery<PushCampaign>({
    action: 'ops.pushCampaignList',
    buildPayload: () => {
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage: pageSize,
      };
      if (appliedTitle.trim()) payload.title = appliedTitle.trim();
      if (appliedStatus && appliedStatus !== 'All') {
        payload.status = appliedStatus.toLowerCase();
      }
      return payload;
    },
    unpack: (res) => asPaged<PushCampaign>(res.data),
    autoDeps: [page, pageSize, appliedTitle, appliedStatus],
    errorMessage: 'Failed to load push notifications',
  });

  const applyFilters = useCallback(() => {
    setAppliedTitle(titleFilter);
    setAppliedStatus(statusFilter);
    setPage(1);
  }, [titleFilter, statusFilter]);

  const clearFilters = useCallback(() => {
    setTitleFilter('');
    setStatusFilter('All');
    setAppliedTitle('');
    setAppliedStatus('All');
    setPage(1);
  }, []);

  const updateField = useCallback((key: keyof PushCampaignForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = useCallback(() => {
    setEditingId('');
    setForm(emptyPushCampaignForm());
    setTitleError('');
    setBodyError('');
    setStartError('');
    setEndError('');
    setImagePreview('');
    setImageBase64('');
    setImageFileName('');
    setRemoveImage(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: PushCampaign) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      body: item.body || '',
      startAt: toIstInputValue(item.startAt),
      endAt: toIstInputValue(item.endAt),
      sendOnce: Boolean(item.sendOnce),
      repeat: Boolean(item.intervalValue && item.intervalUnit),
      intervalValue: String(item.intervalValue || 1),
      intervalUnit: item.intervalUnit || 'hours',
    });
    setTitleError('');
    setBodyError('');
    setStartError('');
    setEndError('');
    setImagePreview(item.imageUrl || '');
    setImageBase64('');
    setImageFileName('');
    setRemoveImage(false);
    setFormOpen(true);
  }, []);

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Image must be 1 MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result?.toString() || '';
      setImageFileName(file.name);
      setImageBase64(result);
      setImagePreview(result);
      setRemoveImage(false);
    };
  }, []);

  const clearSelectedImage = useCallback(() => {
    setImageBase64('');
    setImageFileName('');
    setImagePreview('');
    setRemoveImage(true);
  }, []);

  const validateForm = useCallback((): boolean => {
    let valid = true;
    if (!form.title.trim()) {
      setTitleError('Enter title');
      valid = false;
    } else {
      setTitleError('');
    }
    if (!form.body.trim()) {
      setBodyError('Enter message');
      valid = false;
    } else if (form.body.trim().length > 500) {
      setBodyError('Message cannot exceed 500 characters');
      valid = false;
    } else {
      setBodyError('');
    }
    if (form.sendOnce) {
      setStartError('');
      setEndError('');
      return valid;
    }
    if (!form.startAt) {
      setStartError('Enter start time');
      valid = false;
    } else {
      setStartError('');
    }
    if (!form.endAt) {
      setEndError('Enter end time');
      valid = false;
    } else if (form.startAt && form.endAt <= form.startAt) {
      setEndError('End time must be after start time');
      valid = false;
    } else if (form.endAt <= toIstInputValue(new Date().toISOString())) {
      setEndError('End time must be in the future');
      valid = false;
    } else {
      setEndError('');
    }
    return valid;
  }, [form]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!validateForm()) return;

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        body: form.body.trim(),
        sendOnce: form.sendOnce,
      };
      if (form.sendOnce) {
        if (editingId) {
          payload.intervalValue = null;
          payload.intervalUnit = null;
        }
      } else {
        payload.startAt = fromIstInputValue(form.startAt);
        payload.endAt = fromIstInputValue(form.endAt);
        if (form.repeat) {
          payload.intervalValue = Number(form.intervalValue) || 1;
          payload.intervalUnit = form.intervalUnit;
        } else if (editingId) {
          payload.intervalValue = null;
          payload.intervalUnit = null;
        }
      }
      if (editingId) payload._id = editingId;

      setSubmitting(true);
      try {
        if (imageBase64 && imageFileName) {
          const upload = await secureApi('ops.bannersUploadImageEncrypted', {
            File_Name: `push-notifications/${Date.now()}-${imageFileName}`,
            Image: imageBase64,
          });
          if (!upload.ok) {
            toast.error(upload.message || 'Image upload failed');
            return;
          }
          const imagePath = unpackUploadImagePath(upload.data);
          if (!imagePath) {
            toast.error('Image upload failed');
            return;
          }
          payload.imageUrl = imagePath;
        } else if (editingId && removeImage) {
          payload.imageUrl = '';
        }

        const action = editingId ? 'ops.pushCampaignUpdate' : 'ops.pushCampaignCreate';
        const res = await secureApi(action, payload);
        if (!res.ok) {
          toast.error(res.message || 'Request failed');
          return;
        }
        toast.success(
          form.sendOnce
            ? 'Push notification sent'
            : editingId
              ? 'Push notification updated'
              : 'Push notification created',
        );
        setFormOpen(false);
        if (!editingId && page !== 1) setPage(1);
        else void load();
      } finally {
        setSubmitting(false);
      }
    },
    [validateForm, form, editingId, imageBase64, imageFileName, removeImage, page, load],
  );

  const runAction = useCallback(async () => {
    if (!confirm) return;
    const { id, action } = confirm;
    setConfirm(null);
    setSubmitting(true);
    try {
      const res = await secureApi(ACTION_TO_SECURE[action], { _id: id });
      if (!res.ok) {
        toast.error(res.message || 'Request failed');
        return;
      }
      toast.success(ACTION_SUCCESS[action]);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [confirm, load]);

  const columns = useMemo<CommonTableColumn<PushCampaign>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 48,
        align: 'center',
        render: (_row, index) => (
          <Typography sx={{ ...mutedTextSx, fontVariantNumeric: 'tabular-nums' }}>
            {(page - 1) * pageSize + index + 1}
          </Typography>
        ),
      },
      {
        id: 'campaign',
        label: 'Campaign',
        align: 'left',
        width: 420,
        headSx: { textAlign: 'left' },
        cellSx: {
          textAlign: 'left',
          maxWidth: 420,
          width: 420,
          overflow: 'hidden',
        },
        render: (row) => {
          const title = (row.title || '').trim() || 'Untitled';
          const body = (row.body || '').trim();
          const showBody = Boolean(body) && body !== title;
          const tip = showBody ? `${title}\n${body}` : title;
          return (
            <Tooltip
              title={
                <Box sx={{ whiteSpace: 'pre-wrap', maxWidth: 360, fontSize: 12, lineHeight: 1.4 }}>
                  {tip}
                </Box>
              }
              placement="top-start"
              enterDelay={400}
              slotProps={{
                popper: { sx: { zIndex: 1400 } },
                tooltip: {
                  sx: {
                    bgcolor: '#1f1f28',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  },
                },
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ py: 0.25, maxWidth: '100%', minWidth: 0 }}
              >
                {row.imageUrl ? (
                  <Box
                    component="img"
                    src={row.imageUrl}
                    alt=""
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.25,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.25,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      color: '#6b7280',
                    }}
                  >
                    <ImageOutlinedIcon sx={{ fontSize: 18 }} />
                  </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                  <Typography
                    sx={{
                      ...primaryTextSx,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mb: showBody ? 0.25 : 0,
                    }}
                  >
                    {title}
                  </Typography>
                  {showBody ? (
                    <Typography
                      sx={{
                        ...mutedTextSx,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {body}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            </Tooltip>
          );
        },
      },
      {
        id: 'schedule',
        label: 'Schedule (IST)',
        align: 'left',
        width: 168,
        cellSx: { textAlign: 'left' },
        render: (row) => {
          if (row.sendOnce) {
            return (
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={primaryTextSx}>Send once</Typography>
                <Typography sx={mutedTextSx}>Immediate</Typography>
              </Box>
            );
          }
          return (
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={primaryTextSx}>{formatCompactIst(row.startAt)}</Typography>
              <Typography sx={mutedTextSx}>→ {formatCompactIst(row.endAt)}</Typography>
            </Box>
          );
        },
      },
      {
        id: 'repeat',
        label: 'Repeat',
        width: 120,
        render: (row) => (
          <Typography sx={{ ...mutedTextSx, color: '#c8cdd8' }}>
            {pushCampaignIntervalLabel(row)}
          </Typography>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        render: (row) => {
          const chip = statusChipProps(row.status);
          return <Chip size="small" label={chip.label} sx={chip.sx} />;
        },
      },
      {
        id: 'delivery',
        label: 'Delivery',
        align: 'left',
        width: 130,
        cellSx: { textAlign: 'left' },
        render: (row) => (
          <Box sx={{ textAlign: 'left' }}>
            <Typography sx={primaryTextSx}>
              {row.sendCount || 0}{' '}
              <Box component="span" sx={{ ...mutedTextSx, fontWeight: 500 }}>
                sent
              </Box>
            </Typography>
            <Typography sx={mutedTextSx}>{formatCompactIst(row.lastSentAt)}</Typography>
          </Box>
        ),
      },
      {
        id: 'createdBy',
        label: 'Created by',
        width: 120,
        render: (row) => (
          <Typography sx={{ ...mutedTextSx, color: '#c8cdd8' }} noWrap title={row.createdByName}>
            {row.createdByName || '—'}
          </Typography>
        ),
      },
      {
        id: 'actions',
        label: 'Action',
        width: 96,
        render: (row) => (
          <PushRowActions
            row={row}
            onEdit={openEdit}
            onConfirm={(id, action) => setConfirm({ id, action })}
          />
        ),
      },
    ],
    [page, pageSize, openEdit],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title="Push Notifications"
        summary={`${total.toLocaleString('en-IN')} campaigns · topic all_app_topic_rn`}
        headerActions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={(event) => {
                event.stopPropagation();
                void load();
              }}
              disabled={loading || submitting}
              sx={{
                textTransform: 'none',
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#e8e8ea',
                '&:hover': { borderColor: '#ff9f0a', bgcolor: 'rgba(255,159,10,0.08)' },
              }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={(event) => {
                event.stopPropagation();
                openCreate();
              }}
              sx={{ ...orangeBtnSx, px: 1.75 }}
            >
              Add Notification
            </Button>
          </Stack>
        }
      >
        <Box
          sx={{
            mb: 1.75,
            px: 1.5,
            py: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(255,159,10,0.08)',
            border: '1px solid rgba(255,159,10,0.18)',
          }}
        >
          <Typography variant="body2" sx={{ color: '#d6dbe6', fontSize: 13 }}>
            Messages go to topic <Box component="span" sx={{ color: '#ff9f0a', fontWeight: 700 }}>all_app_topic_rn</Box> (IST). Every subscribed app user receives them.
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{ minWidth: 'max-content' }}
        >
          <TextField
            label="Title"
            size="small"
            placeholder="Search by title"
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
            sx={headerFieldSx}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ ...headerFieldSx, width: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyFilters}
            disabled={loading}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5, flexShrink: 0 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
          <Button
            variant="outlined"
            onClick={clearFilters}
            disabled={loading}
            sx={{
              height: 40,
              px: 2,
              flexShrink: 0,
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Clear
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography color="error" sx={{ mt: 1, mb: 1 }}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          rows.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ color: '#9aa3b5' }}>
                Page {page} of {Math.max(1, totalPages)} · {total.toLocaleString('en-IN')} total
              </Typography>
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, next) => setPage(next)}
                color="secondary"
                size="small"
              />
            </>
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No push notifications yet"
          getRowKey={(row) => row._id}
          dense
          hover
          stickyHeader
          maxHeight="100%"
          minWidth={1100}
        />
      </TablePanel>
      <Dialog
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#14141c',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
          },
        }}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
            {editingId ? 'Edit Push Notification' : 'Create Push Notification'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <TextField
                label="Title"
                fullWidth
                size="small"
                value={form.title}
                error={Boolean(titleError)}
                helperText={titleError}
                onChange={(e) => updateField('title', e.target.value)}
              />
              <TextField
                label="Message"
                fullWidth
                size="small"
                multiline
                minRows={4}
                value={form.body}
                error={Boolean(bodyError)}
                helperText={bodyError || `${form.body.length}/500`}
                onChange={(e) => updateField('body', e.target.value)}
              />
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px dashed rgba(255,255,255,0.14)',
                  bgcolor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Image (optional)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    sx={{ textTransform: 'none' }}
                  >
                    Choose image
                    <input hidden type="file" accept="image/*" onChange={handleImageChange} />
                  </Button>
                  {imagePreview ? (
                    <Button
                      variant="text"
                      size="small"
                      color="inherit"
                      onClick={clearSelectedImage}
                      sx={{ textTransform: 'none', color: '#9aa3b5' }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </Stack>
                <Typography variant="caption" display="block" sx={{ mt: 0.75, color: '#9aa3b5' }}>
                  JPG, PNG, or WebP · Max 1 MB
                </Typography>
                {imagePreview ? (
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Push preview"
                    sx={{
                      mt: 1.25,
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 1.25,
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  />
                ) : null}
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(255,255,255,0.02)',
                }}
              >
                <RadioGroup
                  value={form.sendOnce ? 'once' : 'schedule'}
                  onChange={(e) => {
                    const once = e.target.value === 'once';
                    setForm((prev) => ({
                      ...prev,
                      sendOnce: once,
                      repeat: once ? false : prev.repeat,
                    }));
                  }}
                >
                  <FormControlLabel
                    value="once"
                    control={<Radio size="small" />}
                    label="Send once now"
                  />
                  <Typography variant="caption" sx={{ color: '#9aa3b5', ml: 4, mb: 1 }}>
                    Sent immediately. Start and end time are not needed.
                  </Typography>
                  <FormControlLabel
                    value="schedule"
                    control={<Radio size="small" />}
                    label="Schedule"
                  />
                </RadioGroup>
                {!form.sendOnce ? (
                  <Stack spacing={2} sx={{ mt: 1.5 }}>
                    <TextField
                      label="Start time (IST)"
                      type="datetime-local"
                      fullWidth
                      size="small"
                      value={form.startAt}
                      error={Boolean(startError)}
                      helperText={startError}
                      InputLabelProps={{ shrink: true }}
                      onChange={(e) => updateField('startAt', e.target.value)}
                    />
                    <TextField
                      label="End time (IST)"
                      type="datetime-local"
                      fullWidth
                      size="small"
                      value={form.endAt}
                      error={Boolean(endError)}
                      helperText={endError}
                      InputLabelProps={{ shrink: true }}
                      onChange={(e) => updateField('endAt', e.target.value)}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={form.repeat}
                          onChange={(e) => updateField('repeat', e.target.checked)}
                        />
                      }
                      label="Repeat on an interval"
                    />
                    {form.repeat ? (
                      <Stack direction="row" spacing={1.5}>
                        <TextField
                          type="number"
                          label="Every"
                          size="small"
                          fullWidth
                          value={form.intervalValue}
                          onChange={(e) => updateField('intervalValue', e.target.value)}
                        />
                        <TextField
                          select
                          label="Unit"
                          size="small"
                          sx={{ minWidth: 120 }}
                          value={form.intervalUnit}
                          onChange={(e) =>
                            updateField('intervalUnit', e.target.value as 'hours' | 'days')
                          }
                        >
                          <MenuItem value="hours">Hours</MenuItem>
                          <MenuItem value="days">Days</MenuItem>
                        </TextField>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setFormOpen(false)}
              disabled={submitting}
              sx={{ textTransform: 'none', color: '#9aa3b5' }}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ ...orangeBtnSx, minWidth: 110 }}
            >
              {submitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : form.sendOnce && !editingId ? (
                'Send'
              ) : editingId ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => !submitting && setConfirm(null)}
        PaperProps={{
          sx: {
            bgcolor: '#14141c',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            minWidth: 360,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#c8cdd8', lineHeight: 1.5 }}>
            {confirm ? confirmLabel(confirm.action) : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirm(null)}
            disabled={submitting}
            sx={{ textTransform: 'none', color: '#9aa3b5' }}
          >
            No
          </Button>
          <Button
            variant="contained"
            onClick={() => void runAction()}
            disabled={submitting}
            sx={{
              ...orangeBtnSx,
              minWidth: 72,
              ...(confirm?.action === 'cancel'
                ? { bgcolor: '#dc2626', color: '#fff', '&:hover': { bgcolor: '#b91c1c' } }
                : null),
            }}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
