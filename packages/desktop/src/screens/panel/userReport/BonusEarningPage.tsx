import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type BonusRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  amount?: number;
  bonusWalletOpenBalance?: number;
  bonusWalletClosingBalance?: number;
  referredByName?: string;
  referredByMobile?: string;
  referredToName?: string;
  referredToMobile?: string;
  firstDepositPercentage?: number;
  referralPercentage?: number;
  bonusBy?: { name?: string; type?: string };
  remark?: string;
  createdOn?: string;
  updatedOn?: string;
  type?: string;
  clientName?: string;
  appName?: string;
};

type NavState = {
  User_ID?: string;
  Type?: string;
  obj?: { items?: BonusRow[]; count?: number; totalAmount?: number };
};

type FieldChip = { label: string; value: string };

function unpackItems(data: unknown): { items: BonusRow[]; totalPages: number } {
  let cur: unknown = data;
  for (let i = 0; i < 5; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const o = cur as Record<string, unknown>;
    if (Array.isArray(o.items)) {
      return {
        items: o.items as BonusRow[],
        totalPages: Number(o.totalPages) || 1,
      };
    }
    if (o.payload != null) {
      cur = o.payload;
      continue;
    }
    if (o.data != null) {
      cur = o.data;
      continue;
    }
    break;
  }
  return { items: [], totalPages: 1 };
}

function stamp(raw?: string): string {
  const d = formatDisplayDate(raw);
  const t = formatDisplayTime(raw);
  return d ? `${d} , ${t}` : '-';
}

function money(v: unknown): string {
  return `₹${formatAmount(v ?? 0)}`;
}

function bonusFields(r: BonusRow, canShowMobile: boolean): FieldChip[] {
  const mobile = (v?: string) => {
    if (!v) return '-';
    return canShowMobile ? v : `****** ${String(v).slice(-4)}`;
  };
  const pct = (v?: number) => (v != null ? `${v}%` : '-');
  return [
    { label: 'Name', value: r.name || '-' },
    { label: 'Mobile', value: mobile(r.mobile) },
    { label: 'App Name', value: r.clientName || r.appName || '-' },
    { label: 'Opening Balance', value: money(r.bonusWalletOpenBalance) },
    { label: 'Amount', value: money(r.amount) },
    { label: 'Closing Balance', value: money(r.bonusWalletClosingBalance) },
    { label: 'Referred By Name', value: r.referredByName || '-' },
    { label: 'Referred By Mobile', value: mobile(r.referredByMobile) },
    { label: 'Referred To Name', value: r.referredToName || '-' },
    { label: 'Referred To Mobile', value: mobile(r.referredToMobile) },
    { label: 'First Deposit %', value: pct(r.firstDepositPercentage) },
    { label: 'Referral %', value: pct(r.referralPercentage) },
    { label: 'Bonus By', value: r.bonusBy?.name || '-' },
    { label: 'Bonus Type', value: r.bonusBy?.type || r.type || '-' },
    { label: 'Remark', value: r.remark || '-' },
    { label: 'Created on', value: stamp(r.createdOn) },
    { label: 'Updated on', value: stamp(r.updatedOn) },
  ].filter((f) => f.value !== '-');
}

function FieldChips({ fields }: { fields: FieldChip[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
        gap: 0.5,
      }}
    >
      {fields.map((f) => (
        <Box
          key={f.label}
          sx={{
            minWidth: 0,
            px: 0.6,
            py: 0.35,
            bgcolor: '#f6f7f9',
            border: '1px solid #e5e7eb',
            borderRadius: 1,
          }}
        >
          <Typography
            noWrap
            title={f.label}
            sx={{ fontSize: 10, lineHeight: 1.15, color: '#667085' }}
          >
            {f.label}
          </Typography>
          <Typography
            noWrap
            title={f.value}
            sx={{ fontSize: 12, lineHeight: 1.35, fontWeight: 700, color: '#111827' }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        px: 0.75,
        py: 0.15,
        bgcolor: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: 1,
        maxWidth: '100%',
      }}
    >
      <Typography noWrap sx={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>
        {children}
      </Typography>
    </Box>
  );
}

/** Laxmi BonusWalletReferralEarning — opened from Wallet Overview clicks. */
export function BonusEarningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as NavState;
  const userId = String(state.User_ID || '');
  const type = String(state.Type || '');
  const canShowMobile = hasPermission('show_mobile');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{
    title: string;
    fields: FieldChip[];
  } | null>(null);

  const title =
    type === 'bonus'
      ? 'Bonus Earning Data'
      : type === 'availedBonus' || type === 'lapsedBonus'
        ? 'Availed Bonus Data'
        : 'Bonus Referral Earning Data';

  const load = useCallback(async () => {
    if (!userId) return;

    if (type === 'availedBonus' || type === 'lapsedBonus') {
      setRows(Array.isArray(state.obj?.items) ? state.obj!.items! : []);
      setTotalPages(1);
      return;
    }

    setLoading(true);
    try {
      const action =
        type === 'bonus'
          ? 'userReport.bonusWalletHistory'
          : 'userReport.bonusWalletHistoryReferral';
      const res = await secureApi(action, {
        pageNo: page,
        itemsPerPage: 20,
        filter: { userId },
        sort: { createdOn: -1 },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load bonus history');
        setRows([]);
        return;
      }
      const parsed = unpackItems(res.data);
      setRows(parsed.items);
      setTotalPages(Math.max(1, parsed.totalPages));
    } finally {
      setLoading(false);
    }
  }, [userId, type, page, state.obj]);

  useEffect(() => {
    if (!userId) {
      navigate('/users', { replace: true });
      return;
    }
    void load();
  }, [userId, load, navigate]);

  const cards = useMemo(
    () =>
      rows.map((r, i) => {
        const name = r.name || `Entry #${i + 1}`;
        const initial = name.trim().charAt(0).toUpperCase() || '?';
        const mobile = r.mobile
          ? canShowMobile
            ? r.mobile
            : `****** ${String(r.mobile).slice(-4)}`
          : '';
        const amount = money(r.amount);
        const bonusType = r.bonusBy?.type || r.type || '';
        const created = stamp(r.createdOn);
        const sub = [mobile, amount].filter(Boolean).join(' · ') || '—';
        return { r, i, name, initial, sub, amount, bonusType, created };
      }),
    [canShowMobile, rows],
  );

  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={700} mb={1.5}>
        {toDisplayText(title)}
      </Typography>

      {loading && rows.length === 0 ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : cards.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No bonus history
        </Typography>
      ) : (
        <Stack spacing={1}>
          {cards.map(({ r, i, name, initial, sub, amount, bonusType, created }) => (
            <Box
              key={String(r._id || i)}
              role="button"
              tabIndex={0}
              onClick={() =>
                setDetail({
                  title: name,
                  fields: bonusFields(r, canShowMobile),
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetail({
                    title: name,
                    fields: bonusFields(r, canShowMobile),
                  });
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
                '&:hover': {
                  borderColor: 'warning.main',
                  bgcolor: '#fffaf3',
                },
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(245, 179, 1, 0.15)',
                  border: '1px solid rgba(245, 179, 1, 0.4)',
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#c2410c' }}>
                  {initial}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {name}
                </Typography>
                <Typography noWrap sx={{ fontSize: 12, color: '#667085', mt: 0.15 }}>
                  {sub}
                </Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" mt={0.75}>
                  <Tag>{amount}</Tag>
                  {bonusType ? <Tag>{bonusType}</Tag> : null}
                  {created !== '-' ? <Tag>{created}</Tag> : null}
                </Stack>
              </Box>
              <Typography sx={{ color: '#98a2b3', fontSize: 22, fontWeight: 300, flexShrink: 0 }}>
                ›
              </Typography>
            </Box>
          ))}

          {totalPages > 1 ? (
            <Stack alignItems="center" py={1.5}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
              />
            </Stack>
          ) : null}
        </Stack>
      )}

      <Dialog open={detail != null} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{detail?.title ?? ''}</DialogTitle>
        <DialogContent dividers>
          {detail ? <FieldChips fields={detail.fields} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
