import { memo, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { copyToClipboard } from '@/utils/clipboard';
import {
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { display } from '@/screens/panel/shared';

export type DepositRow = {
  _id: string;
  userId?: string;
  userName?: string;
  empCode?: string;
  userMobile?: string;
  mobile?: string;
  clientName?: string;
  amount?: number | string;
  status?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  ifscCode?: string;
  orderId?: string;
  orderKeyID?: string;
  paymentGatewayName?: string;
  paymentType?: string;
  mid?: string | number;
  createdOn?: string;
  updatedOn?: string;
  lastActivity?: string;
  reason?: string;
  upiId?: string;
  userUpiId?: string;
  userDepositUpiIds?: Array<string | { upiId?: string; upi?: string }> | string;
  oldMultipleNames?: string[];
  checkBy?: { name?: string; city?: string; state?: string; date?: string };
  crossCheckBy?: { name?: string; city?: string; state?: string; date?: string };
  updatedBy?: { name?: string } | string;
};

const WaIcon = ({ size = 28 }: { size?: number }) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden
  >
    <path
      fill="#25D366"
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.19c-.24.68-1.4 1.25-1.93 1.33-.49.07-1.11.1-1.79-.11-.41-.13-.94-.3-1.62-.59-2.85-1.23-4.71-4.11-4.85-4.3-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.36.26-.29.57-.36.76-.36h.55c.17 0 .41-.06.64.49.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.56.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.21 2.17 1.35.27.14.43.12.58-.07.16-.19.66-.77.84-1.04.17-.26.35-.22.59-.13.24.09 1.53.72 1.79.85.26.13.44.2.5.31.07.11.07.64-.17 1.32z"
    />
  </Box>
);

const TgIcon = ({ size = 28 }: { size?: number }) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden
  >
    <path
      fill="#2AABEE"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
    />
  </Box>
);

function formatPhone(raw?: string): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.length === 10) n = `91${n}`;
  return n;
}

export function openWhatsApp(row: DepositRow) {
  const raw = row.userMobile || row.mobile;
  if (!raw) return;
  const formatted = formatPhone(raw);
  const state = row.userState || row.state || '';
  const stateWiseMsg =
    state === 'Karnataka'
      ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nನೀವು ಠೇವಣಿ ಮಾಡಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರುವಿರಿ ಎಂದು ಕಾಣುತ್ತದೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`
      : ['Telangana', 'Andhra Pradesh'].includes(state)
        ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nమీరు డిపాజిట్ చేయడానికి ప్రయత్నిస్తున్నారని నేను చూస్తున్నాను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?`
        : ['Tamil Nadu', 'Tiruchirappalli'].includes(state)
          ? `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nநீங்கள் டெப்பாசிட் செய்ய முயற்சிக்கிறீர்கள் என்று பார்க்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
          : `Hello {USER_NAME} Sir,\nWelcome to ${row.clientName || ''} Games.\nI see you're trying to make a deposit. How can I assist you today?`;
  const message = stateWiseMsg.replace(
    '{USER_NAME}',
    (row.userName || '').split(' ')[0] || '',
  );
  const encoded = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `whatsapp://send?phone=${formatted}&text=${encoded}`;
  } else {
    window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
  }
}

export function openTelegram(row: DepositRow) {
  const raw = row.userMobile || row.mobile;
  if (!raw) return;
  const formatted = formatPhone(raw);
  const appUrl = `tg://resolve?phone=${formatted}`;
  const webUrl = `https://t.me/+${formatted}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = appUrl;
    window.setTimeout(() => {
      window.location.href = webUrl;
    }, 800);
  } else {
    window.open(webUrl, '_blank');
  }
}

function statusVisual(status: string): {
  color: string;
  Icon: typeof CheckCircleOutlineIcon;
  label: string;
} {
  const s = status.toLowerCase();
  const label = status.trim() || '—';
  if (s === 'approved' || s === 'success' || s === 'approved-clr') {
    return { color: '#9AFF4D', Icon: CheckCircleOutlineIcon, label };
  }
  if (s === 'pending' || s === 'processing') {
    return { color: '#ff9f0a', Icon: HourglassTopOutlinedIcon, label };
  }
  if (s === 'rejected' || s === 'failed' || s === 'cancel') {
    return { color: '#ef5350', Icon: CancelOutlinedIcon, label };
  }
  if (s === 'on hold') {
    return { color: '#42a5f5', Icon: PauseCircleOutlineIcon, label };
  }
  if (s === 'reverse') {
    return { color: '#29b6f6', Icon: ReplayOutlinedIcon, label };
  }
  return { color: '#9e9e9e', Icon: InfoOutlinedIcon, label };
}

export { depositRowBg } from './logic';

type MobileCellProps = {
  row: DepositRow;
  canShowMobile: boolean;
  canWhatsApp: boolean;
  compact?: boolean;
};

export const MobileCell = memo(function MobileCell({
  row,
  canShowMobile,
  canWhatsApp,
  compact,
}: MobileCellProps) {
  const mobile = String(row.userMobile || row.mobile || '');
  const pending = String(row.status || '').toLowerCase() === 'pending';

  if (!mobile) return <>—</>;
  if (!canShowMobile) return <>**********</>;

  const iconSize = compact ? 18 : 32;
  const chat =
    canWhatsApp && pending ? (
      <Stack direction="row" alignItems="center" spacing={compact ? 0.5 : 0.85} sx={{ flexShrink: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={() => openWhatsApp(row)}
          aria-label="Open WhatsApp"
          sx={{
            border: 0,
            bgcolor: 'transparent',
            p: 0,
            cursor: 'pointer',
            lineHeight: 0,
            display: 'inline-flex',
            '&:hover': { opacity: 0.85 },
          }}
        >
          <WaIcon size={iconSize} />
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => openTelegram(row)}
          aria-label="Open Telegram"
          sx={{
            border: 0,
            bgcolor: 'transparent',
            p: 0,
            cursor: 'pointer',
            lineHeight: 0,
            display: 'inline-flex',
            '&:hover': { opacity: 0.85 },
          }}
        >
          <TgIcon size={iconSize} />
        </Box>
      </Stack>
    ) : null;

  const number = (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: compact && pending ? 11.5 : 12,
          fontWeight: 600,
          lineHeight: 1.05,
          whiteSpace: 'nowrap',
        }}
      >
        {mobile}
      </Typography>
      <IconButton
        size="small"
        onClick={() => {
          void copyToClipboard(mobile).then((ok) => {
            if (ok) toast.success(`${mobile} Copied`);
          });
        }}
        sx={{ p: compact ? 0.05 : 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: compact ? 12 : 15 }} />
      </IconButton>
    </Stack>
  );

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={compact ? 0.25 : 0.4}
      sx={{ py: 0, minWidth: 0, width: '100%' }}
    >
      {number}
      {chat}
    </Stack>
  );
});

type PaymentMethodCellProps = {
  row: DepositRow;
  canEdit?: boolean;
  onEdit?: (row: DepositRow) => void;
  compact?: boolean;
};

export const PaymentMethodCell = memo(function PaymentMethodCell({
  row,
  canEdit,
  onEdit,
  compact,
}: PaymentMethodCellProps) {
  const pending = String(row.status || '').toLowerCase() === 'pending';
  const gateway = display(row.paymentGatewayName);
  const mid = display(row.mid);
  const title = [gateway, mid].filter((v) => v && v !== '—').join(' · ');

  if (compact) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={0.35}
        title={title}
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          px: 0.25,
          flexWrap: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <Typography
          sx={{
            fontSize: pending ? 11.5 : 12,
            fontWeight: 600,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          {gateway}
        </Typography>
        <Typography
          sx={{
            fontSize: 10.5,
            opacity: 0.85,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 0,
            maxWidth: 48,
          }}
        >
          {mid}
        </Typography>
        {canEdit ? (
          <IconButton size="small" onClick={() => onEdit?.(row)} sx={{ p: 0.05, flexShrink: 0 }}>
            <EditIcon sx={{ fontSize: 13 }} />
          </IconButton>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack
      alignItems="center"
      spacing={0.25}
      title={title}
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 0.25,
        overflow: 'hidden',
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 600,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          textAlign: 'center',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {gateway}
      </Typography>
      <Typography
        sx={{
          fontSize: 11,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}
      >
        {mid}
      </Typography>
      {canEdit ? (
        <IconButton size="small" onClick={() => onEdit?.(row)} sx={{ p: 0.25 }}>
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ) : null}
    </Stack>
  );
});

type TxnDetailsCellProps = {
  row: DepositRow;
  compact?: boolean;
};

export const TxnDetailsCell = memo(function TxnDetailsCell({
  row,
  compact,
}: TxnDetailsCellProps) {
  if (compact) {
    return (
      <Typography sx={{ fontSize: 11.5, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
        {`${formatDisplayDate(row.createdOn) || '—'} ${formatDisplayTime(row.createdOn) || ''}`.trim()}
      </Typography>
    );
  }

  return (
    <Stack alignItems="center" spacing={0.25} sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: 12, lineHeight: 1.2 }}>
        {formatDisplayDate(row.createdOn) || '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, opacity: 0.75, lineHeight: 1.2 }}>
        {formatDisplayTime(row.createdOn) || '—'}
      </Typography>
    </Stack>
  );
});

type LastActivityCellProps = { row: DepositRow; compact?: boolean };

export const LastActivityCell = memo(function LastActivityCell({
  row,
  compact,
}: LastActivityCellProps) {
  const ts = row.lastActivity || row.updatedOn;
  if (!ts) return <>—</>;
  if (compact) {
    return (
      <Typography sx={{ fontSize: 11.5, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {`${formatDisplayDate(ts) || '—'} ${formatDisplayTime(ts) || ''}`.trim()}
      </Typography>
    );
  }
  return (
    <Stack alignItems="center" spacing={0.25}>
      <Typography sx={{ fontSize: 12, lineHeight: 1.2 }}>{formatDisplayDate(ts) || '—'}</Typography>
      <Typography sx={{ fontSize: 11, opacity: 0.75, lineHeight: 1.2 }}>
        {formatDisplayTime(ts) || '—'}
      </Typography>
    </Stack>
  );
});

type PersonCellProps = {
  person?: { name?: string; city?: string; state?: string; date?: string };
  /** When no person yet — show check icon */
  canCheck?: boolean;
  checking?: boolean;
  onCheck?: () => void;
  compact?: boolean;
};

export const PersonCell = memo(function PersonCell({
  person,
  canCheck,
  checking,
  onCheck,
  compact,
}: PersonCellProps) {
  if (person?.name) {
    if (compact) {
      const place = [person.city, person.state].filter(Boolean).join(', ');
      return (
        <Typography
          sx={{
            fontSize: 11,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 120,
          }}
        >
          {person.name}
          {place ? ` · ${place}` : ''}
        </Typography>
      );
    }
    return (
      <Stack alignItems="center" spacing={0.15}>
        <Typography sx={{ fontSize: 12 }}>{person.name}</Typography>
        {person.city ? <Typography sx={{ fontSize: 11 }}>{person.city}</Typography> : null}
        {person.state ? <Typography sx={{ fontSize: 11 }}>{person.state}</Typography> : null}
        {person.date ? (
          <Typography sx={{ fontSize: 11 }}>
            {formatDisplayDate(person.date)} {formatDisplayTime(person.date)}
          </Typography>
        ) : null}
      </Stack>
    );
  }
  if (canCheck) {
    return (
      <IconButton
        size="small"
        disabled={checking}
        onClick={onCheck}
        aria-label="Mark checked"
        sx={{ color: '#ff9f0a', p: compact ? 0.15 : undefined }}
      >
        <CheckBoxOutlinedIcon sx={compact ? { fontSize: 16 } : undefined} fontSize="small" />
      </IconButton>
    );
  }
  return <>—</>;
});

type SecondaryNameCellProps = {
  row: DepositRow;
  onSaved: () => void;
  compact?: boolean;
};

export const SecondaryNameCell = memo(function SecondaryNameCell({
  row,
  onSaved,
  compact,
}: SecondaryNameCellProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  /** Keep the add form collapsed so pending rows stay one-line tall. */
  const [formOpen, setFormOpen] = useState(false);
  const names = Array.isArray(row.oldMultipleNames) ? row.oldMultipleNames : [];
  const pending = String(row.status || '').toLowerCase() === 'pending';
  const namesLabel = names.length ? names.join(', ') : '—';

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (names.some((n) => n?.toLowerCase() === trimmed.toLowerCase())) {
      toast.warn(`"${trimmed}" already exists in the list!`);
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi('deposits.updateUserOldName', {
        userId: row.userId,
        name: trimmed,
        transactionId: row.orderId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add secondary name');
        return;
      }
      toast.success('Secondary User Name Added successfully!');
      setName('');
      setFormOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack
      spacing={formOpen ? 0.5 : 0}
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        mx: 'auto',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={0.35}
        sx={{ minWidth: 0, width: '100%' }}
      >
        <Typography
          title={namesLabel === '—' ? undefined : namesLabel}
          sx={{
            fontSize: compact ? 11 : 12,
            color: 'text.secondary',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: '1 1 auto',
            textAlign: 'center',
          }}
        >
          {namesLabel}
        </Typography>
        {pending ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setFormOpen((v) => !v);
            }}
            aria-label="Add secondary name"
            title="Add secondary name"
            sx={{
              p: 0.2,
              flexShrink: 0,
              color: '#ff9f0a',
              border: '1px solid rgba(255,159,10,0.4)',
              borderRadius: 1,
              bgcolor: formOpen ? 'rgba(255,159,10,0.18)' : 'rgba(255,159,10,0.08)',
              '&:hover': { bgcolor: 'rgba(255,159,10,0.2)' },
            }}
          >
            <AddCircleOutlineIcon sx={{ fontSize: compact ? 14 : 15 }} />
          </IconButton>
        ) : null}
      </Stack>

      {pending && formOpen ? (
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ width: '100%', minWidth: 0 }}
        >
          <TextField
            size="small"
            placeholder="Secondary name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add(e);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              '& .MuiInputBase-root': {
                bgcolor: 'background.paper',
                color: 'text.primary',
                fontSize: compact ? 11 : 12,
                minHeight: compact ? 26 : 30,
              },
              '& .MuiInputBase-input': {
                py: compact ? 0.35 : 0.5,
                color: 'text.primary',
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={busy || !name.trim()}
            onClick={(e) => void add(e)}
            sx={{
              textTransform: 'none',
              minWidth: compact ? 40 : 48,
              px: 1,
              py: compact ? 0.2 : 0.35,
              fontSize: compact ? 10.5 : 11,
              bgcolor: '#ff9f0a',
              color: '#1a1200',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#ffb340', boxShadow: 'none' },
            }}
          >
            ADD
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
});

type IndexCellProps = {
  index: number;
  page: number;
  itemsPerPage: number;
  row: DepositRow;
  selectable: boolean;
  selected: boolean;
  onToggle: (row: DepositRow, checked: boolean) => void;
  compact?: boolean;
  canEdit?: boolean;
  onEdit?: (row: DepositRow) => void;
};

export const IndexCell = memo(function IndexCell({
  index,
  page,
  itemsPerPage,
  row,
  selectable,
  selected,
  onToggle,
  compact,
  canEdit,
  onEdit,
}: IndexCellProps) {
  const status = String(row.status || '');
  const visual = status ? statusVisual(status) : null;
  const StatusIcon = visual?.Icon;

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={0.2}
      sx={{ minWidth: 0 }}
    >
      <Typography sx={{ fontSize: 12, lineHeight: 1.1 }}>
        {(page - 1) * itemsPerPage + index + 1}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.15}>
        {visual && StatusIcon ? (
          <Tooltip title={visual.label} arrow>
            <IconButton
              size="small"
              aria-label={visual.label}
              onClick={
                canEdit && onEdit
                  ? (e) => {
                      e.stopPropagation();
                      onEdit(row);
                    }
                  : undefined
              }
              sx={{
                p: 0.1,
                color: visual.color,
                border: '1px solid',
                borderColor: visual.color,
                borderRadius: 1,
                bgcolor: `${visual.color}22`,
                cursor: canEdit ? 'pointer' : 'default',
                ...(canEdit
                  ? {
                      '&:hover': {
                        bgcolor: `${visual.color}33`,
                        boxShadow: `0 0 0 1px ${visual.color}`,
                      },
                    }
                  : {
                      '&:hover': { bgcolor: `${visual.color}22` },
                    }),
              }}
            >
              <StatusIcon sx={{ fontSize: compact ? 12 : 13 }} />
            </IconButton>
          </Tooltip>
        ) : null}
        {selectable ? (
          <Checkbox
            size="small"
            checked={selected}
            onChange={(e) => onToggle(row, e.target.checked)}
            sx={{ p: 0.05, '& .MuiSvgIcon-root': { fontSize: 16 } }}
          />
        ) : null}
      </Stack>
    </Stack>
  );
});

export function canUseDepositPencil(): boolean {
  return hasPermission('Deposit_Pensil');
}

function normalizeUserUpiList(
  raw: DepositRow['userDepositUpiIds'],
): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  return list
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      return String(item?.upiId || item?.upi || '').trim();
    })
    .filter(Boolean);
}

/** User UPI ID column — renders `userDepositUpiIds` like old Deposit. */
export const UserUpiCell = memo(function UserUpiCell({
  row,
  compact,
}: {
  row: DepositRow;
  compact?: boolean;
}) {
  const upis = normalizeUserUpiList(row.userDepositUpiIds);
  if (!upis.length) {
    return <>{display(row.userUpiId)}</>;
  }
  return (
    <Stack
      direction="row"
      flexWrap="nowrap"
      useFlexGap
      spacing={compact ? 0.25 : 0.5}
      justifyContent="center"
      sx={{ maxWidth: 220, py: 0, overflow: 'hidden' }}
    >
      {(compact ? upis.slice(0, 1) : upis).map((upi) => (
        <Box
          key={upi}
          component="span"
          sx={{
            fontSize: compact ? 10 : 11,
            px: compact ? 0.5 : 0.75,
            py: compact ? 0 : 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(255,159,10,0.15)',
            color: '#ff9f0a',
            border: '1px solid rgba(255,159,10,0.35)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: compact ? 160 : undefined,
          }}
        >
          {upi}
        </Box>
      ))}
      {compact && upis.length > 1 ? (
        <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.05 }}>
          +{upis.length - 1}
        </Typography>
      ) : null}
    </Stack>
  );
});
