import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { hasPermission } from '@/auth/permissions';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
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
};

type NavState = {
  User_ID?: string;
  Type?: string;
  obj?: { items?: BonusRow[]; count?: number; totalAmount?: number };
};

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

  const columns = useMemo<CommonTableColumn<BonusRow>[]>(
    () => [
      { id: '#', label: '#', width: 48, render: (_r, i) => i + 1 },
      { id: 'name', label: 'Name', render: (r) => r.name || '-' },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) =>
          canShowMobile
            ? r.mobile || '-'
            : r.mobile
              ? `****** ${String(r.mobile).slice(-4)}`
              : '-',
      },
      {
        id: 'open',
        label: 'Opening Balance',
        render: (r) => formatAmount(r.bonusWalletOpenBalance ?? 0),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (r) => formatAmount(r.amount ?? 0),
      },
      {
        id: 'close',
        label: 'Closing Balance',
        render: (r) => formatAmount(r.bonusWalletClosingBalance ?? 0),
      },
      {
        id: 'refBy',
        label: 'Referred By Name',
        render: (r) => r.referredByName || '-',
      },
      {
        id: 'refByM',
        label: 'Referred By Mobile',
        render: (r) => r.referredByMobile || '-',
      },
      {
        id: 'refTo',
        label: 'Referred To Name',
        render: (r) => r.referredToName || '-',
      },
      {
        id: 'refToM',
        label: 'Referred To Mobile',
        render: (r) => r.referredToMobile || '-',
      },
      {
        id: 'fd%',
        label: 'First Deposit %',
        render: (r) =>
          r.firstDepositPercentage != null ? `${r.firstDepositPercentage}%` : '-',
      },
      {
        id: 'ref%',
        label: 'Referral %',
        render: (r) =>
          r.referralPercentage != null ? `${r.referralPercentage}%` : '-',
      },
      {
        id: 'bonusBy',
        label: 'Bonus By',
        render: (r) => r.bonusBy?.name || '-',
      },
      {
        id: 'bonusType',
        label: 'Bonus Type',
        render: (r) => r.bonusBy?.type || r.type || '-',
      },
      { id: 'remark', label: 'Remark', render: (r) => r.remark || '-' },
      {
        id: 'created',
        label: 'Created on',
        render: (r) => {
          const d = formatDisplayDate(r.createdOn);
          const t = formatDisplayTime(r.createdOn);
          return d ? `${d} , ${t}` : '-';
        },
      },
      {
        id: 'updated',
        label: 'Updated on',
        render: (r) => {
          const d = formatDisplayDate(r.updatedOn);
          const t = formatDisplayTime(r.updatedOn);
          return d ? `${d} , ${t}` : '-';
        },
      },
    ],
    [canShowMobile],
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
      ) : (
        <TablePanel
          footer={
            totalPages > 1 ? (
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
              />
            ) : undefined
          }
          footerJustify="center"
        >
          <CommonTable
            columns={columns}
            rows={rows}
            getRowKey={(r, i) => String(r._id || i)}
            loading={loading}
            emptyMessage="No bonus history"
            minWidth={1400}
            dense
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
