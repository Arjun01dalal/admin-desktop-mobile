import { memo, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
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

const WA_ICON = 'https://img.icons8.com/?size=1200&id=16713&format=jpg';
const TG_ICON =
  'https://i1.wp.com/sethisfy.com/wp-content/uploads/2020/10/Telegram_software-Logo.wine_.png';

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

function statusChipColor(
  status: string,
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'success' || s === 'approved-clr') return 'success';
  if (s === 'pending' || s === 'processing') return 'warning';
  if (s === 'rejected' || s === 'failed' || s === 'cancel') return 'error';
  if (s === 'on hold' || s === 'reverse') return 'info';
  return 'default';
}

export { depositRowBg } from './logic';

type MobileCellProps = {
  row: DepositRow;
  canShowMobile: boolean;
  canWhatsApp: boolean;
};

export const MobileCell = memo(function MobileCell({
  row,
  canShowMobile,
  canWhatsApp,
}: MobileCellProps) {
  const mobile = String(row.userMobile || row.mobile || '');
  const pending = String(row.status || '').toLowerCase() === 'pending';

  if (!mobile) return <>—</>;
  if (!canShowMobile) return <>**********</>;

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ py: 0.25 }}>
      <Stack direction="row" alignItems="center" spacing={0.25}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
          {mobile}
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            void copyToClipboard(mobile).then((ok) => {
              if (ok) toast.success(`${mobile} Copied`);
            });
          }}
          sx={{ p: 0.25 }}
        >
          <ContentCopyIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Stack>
      {canWhatsApp && pending ? (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            component="button"
            type="button"
            onClick={() => openWhatsApp(row)}
            sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', lineHeight: 0 }}
          >
            <Box component="img" src={WA_ICON} alt="WhatsApp" sx={{ width: 32, height: 32 }} />
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => openTelegram(row)}
            sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', lineHeight: 0 }}
          >
            <Box component="img" src={TG_ICON} alt="Telegram" sx={{ width: 48, height: 28, objectFit: 'contain' }} />
          </Box>
        </Stack>
      ) : null}
    </Stack>
  );
});

type PaymentMethodCellProps = {
  row: DepositRow;
  canEdit?: boolean;
  onEdit?: (row: DepositRow) => void;
};

export const PaymentMethodCell = memo(function PaymentMethodCell({
  row,
  canEdit,
  onEdit,
}: PaymentMethodCellProps) {
  return (
    <Stack alignItems="center" spacing={0.25}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'normal', maxWidth: 140 }}>
        {display(row.paymentGatewayName)}
      </Typography>
      <Typography sx={{ fontSize: 11 }}>{display(row.mid)}</Typography>
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
  canEdit: boolean;
  onEdit: (row: DepositRow) => void;
};

export const TxnDetailsCell = memo(function TxnDetailsCell({
  row,
  canEdit,
  onEdit,
}: TxnDetailsCellProps) {
  const status = String(row.status || '');

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: 12, lineHeight: 1.2 }}>
        {formatDisplayDate(row.createdOn) || '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, opacity: 0.75, lineHeight: 1.2 }}>
        {formatDisplayTime(row.createdOn) || '—'}
      </Typography>
      {status ? (
        <Chip
          size="small"
          label={status}
          color={statusChipColor(status)}
          variant={
            status.toLowerCase() === 'approved' || status.toLowerCase() === 'success'
              ? 'outlined'
              : 'filled'
          }
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            ...(status.toLowerCase() === 'approved' ||
            status.toLowerCase() === 'success' ||
            status.toLowerCase() === 'approved-clr'
              ? {
                  borderColor: '#84d184',
                  color: '#84d184',
                  bgcolor: 'transparent',
                }
              : null),
          }}
        />
      ) : (
        '—'
      )}
      {canEdit ? (
        <IconButton
          size="small"
          onClick={() => onEdit(row)}
          sx={{ p: 0.25 }}
          aria-label="Settle deposit"
        >
          <EditIcon sx={{ fontSize: 16, color: '#ff9f0a' }} />
        </IconButton>
      ) : null}
    </Stack>
  );
});

type LastActivityCellProps = { row: DepositRow };

export const LastActivityCell = memo(function LastActivityCell({ row }: LastActivityCellProps) {
  const ts = row.lastActivity || row.updatedOn;
  if (!ts) return <>—</>;
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
};

export const PersonCell = memo(function PersonCell({
  person,
  canCheck,
  checking,
  onCheck,
}: PersonCellProps) {
  if (person?.name) {
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
        sx={{ color: '#ff9f0a' }}
      >
        <CheckBoxOutlinedIcon fontSize="small" />
      </IconButton>
    );
  }
  return <>—</>;
});

type SecondaryNameCellProps = {
  row: DepositRow;
  onSaved: () => void;
};

export const SecondaryNameCell = memo(function SecondaryNameCell({
  row,
  onSaved,
}: SecondaryNameCellProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const names = Array.isArray(row.oldMultipleNames) ? row.oldMultipleNames : [];
  const pending = String(row.status || '').toLowerCase() === 'pending';

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
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={0.75} sx={{ minWidth: 160, maxWidth: 200, py: 0.5, mx: 'auto' }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
        {names.length ? names.join(', ') : '—'}
      </Typography>
      {pending ? (
        <>
          <TextField
            size="small"
            placeholder="Secondary name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 } }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={busy || !name.trim()}
            onClick={(e) => void add(e)}
            sx={{
              textTransform: 'none',
              bgcolor: '#ff9f0a',
              color: '#1a1200',
              fontWeight: 700,
              '&:hover': { bgcolor: '#e08c00' },
            }}
          >
            ADD
          </Button>
        </>
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
};

export const IndexCell = memo(function IndexCell({
  index,
  page,
  itemsPerPage,
  row,
  selectable,
  selected,
  onToggle,
}: IndexCellProps) {
  return (
    <Stack alignItems="center" spacing={0.25}>
      <Typography sx={{ fontSize: 12 }}>{(page - 1) * itemsPerPage + index + 1}</Typography>
      {selectable ? (
        <Checkbox
          size="small"
          checked={selected}
          onChange={(e) => onToggle(row, e.target.checked)}
          sx={{ p: 0.25 }}
        />
      ) : null}
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
export const UserUpiCell = memo(function UserUpiCell({ row }: { row: DepositRow }) {
  const upis = normalizeUserUpiList(row.userDepositUpiIds);
  if (!upis.length) {
    return <>{display(row.userUpiId)}</>;
  }
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={0.5}
      justifyContent="center"
      sx={{ maxWidth: 220, py: 0.5 }}
    >
      {upis.map((upi) => (
        <Box
          key={upi}
          component="span"
          sx={{
            fontSize: 11,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(255,159,10,0.15)',
            color: '#ff9f0a',
            border: '1px solid rgba(255,159,10,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          {upi}
        </Box>
      ))}
    </Stack>
  );
});
