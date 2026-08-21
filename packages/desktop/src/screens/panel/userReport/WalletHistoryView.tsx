import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { secureApi } from '@/api/secureClient';
import { isCallerRole, getRoleId, getRoleName } from '@/auth/permissions';
import { formatAmount, formatLocalDate } from '@/utils/dates';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { CALLER_HEAD_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';
import { WalletLedgerTable } from './WalletLedgerTable';
import type { EncryptedUser } from './types';

type Props = {
  userId: string;
  encrypted?: EncryptedUser | null;
};

/** Callers (+ caller heads): only Exposure + Bonus Earning tiles. */
function restrictCallerAmountTiles(): boolean {
  if (isCallerRole()) return true;
  const id = String(getRoleId() || '');
  if (id && CALLER_HEAD_ROLE_IDS.has(id)) return true;
  const name = String(getRoleName() || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return (
    name === 'caller' ||
    name === 'caller_new' ||
    name.startsWith('caller_head')
  );
}

type BonusEarning = {
  userReferral?: number;
  userReferralCount?: number;
  userOwnEarning?: number;
  userOwnEarningCount?: number;
};

type AvailedBonus = {
  totalAmount?: number;
  count?: number;
  items?: Record<string, unknown>[];
};

const BAZAR_ROWS = ['Regular', 'Starline', 'King Bazar', 'Casino'] as const;

/** Dig through common secure-bridge wrappers to the wallet summary object. */
function unpackWalletSummary(data: unknown): Record<string, unknown> {
  let cur: unknown = data;
  for (let i = 0; i < 4; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (
      obj.totalDeposit != null ||
      obj.totalWithdrawal != null ||
      obj.balance != null ||
      obj.walletHistory != null
    ) {
      return obj;
    }
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      cur = obj.payload;
      continue;
    }
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      cur = obj.data;
      continue;
    }
    break;
  }
  return cur && typeof cur === 'object' && !Array.isArray(cur)
    ? (cur as Record<string, unknown>)
    : {};
}

/**
 * Peel nested `payload` / `data` wrappers. Secure bridge usually returns the
 * inner payload already, but number totals (user exposure) and nested envelopes
 * still need a careful unwrap — `typeof number !== 'object'`.
 */
function unwrapDeep(data: unknown): unknown {
  let cur: unknown = data;
  for (let i = 0; i < 5; i += 1) {
    if (cur == null) return cur;
    if (typeof cur === 'number' || typeof cur === 'boolean') return cur;
    if (typeof cur === 'string') return cur;
    if (Array.isArray(cur)) return cur;
    if (typeof cur !== 'object') return cur;
    const o = cur as Record<string, unknown>;
    if (o.payload !== undefined) {
      cur = o.payload;
      continue;
    }
    if (o.data !== undefined) {
      cur = o.data;
      continue;
    }
    return cur;
  }
  return cur;
}

function asBonusEarning(data: unknown): BonusEarning | null {
  const v = unwrapDeep(data);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as BonusEarning;
}

function asAvailedBonus(data: unknown): AvailedBonus | null {
  const v = unwrapDeep(data);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as AvailedBonus;
}

function asExposureTotal(data: unknown): number {
  const v = unwrapDeep(data);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const n = Number(o.total ?? o.userExposure ?? o.exposure ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Laxmi `formatDate` — DD-MM-YYYY, but never NaN-NaN-NaN. */
function formatReportDate(value: unknown): string {
  return formatLocalDate(value) || '-';
}

function pickLastActivity(encrypted?: EncryptedUser | null): unknown {
  if (!encrypted) return null;
  return (
    encrypted.activeUser ||
    encrypted.lastActivity ||
    encrypted.updatedOn ||
    encrypted.updatedAt ||
    null
  );
}

/** Wallet History tab — layout mirrors admin-panel WalletHistory.css */
export function WalletHistoryView({ userId, encrypted }: Props) {
  const navigate = useNavigate();
  const isCaller = useMemo(() => restrictCallerAmountTiles(), []);

  const [summaryOpen, setSummaryOpen] = useState(() => restrictCallerAmountTiles());
  const [loading, setLoading] = useState(true);
  const [depositTotal, setDepositTotal] = useState(0);
  const [withdrawalTotal, setWithdrawalTotal] = useState(0);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [bonusData, setBonusData] = useState<BonusEarning | null>(null);
  const [availedBonus, setAvailedBonus] = useState<AvailedBonus | null>(null);
  const [userExposure, setUserExposure] = useState(0);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const requests: Array<Promise<{ ok: boolean; data?: unknown }>> = [
        secureApi('userReport.bonusTotalEarning', {
          userId,
          itemsPerPage: 10,
          pageNo: 1,
        }),
        secureApi('userReport.userExposure', { _id: userId }),
      ];
      if (!isCaller) {
        requests.unshift(
          secureApi('userReport.walletHistory', {
            itemsPerPage: 1,
            pageNo: 1,
            filter: { userId },
          }),
          secureApi('userReport.bonusApprovedTotal', { userId }),
        );
      }

      const results = await Promise.all(requests);

      if (isCaller) {
        const [bonusRes, exposureRes] = results;
        if (bonusRes.ok) setBonusData(asBonusEarning(bonusRes.data));
        if (exposureRes.ok) setUserExposure(asExposureTotal(exposureRes.data));
      } else {
        const [walletRes, availedRes, bonusRes, exposureRes] = results;
        if (walletRes.ok) {
          const nested = unpackWalletSummary(walletRes.data);
          setDepositTotal(Number(nested.totalDeposit) || 0);
          setWithdrawalTotal(Number(nested.totalWithdrawal) || 0);
          setBalanceTotal(Math.floor(Number(nested.balance) || 0));
          setBonusBalance(Number(nested.bonusWalletBalance) || 0);
          setPendingWithdrawal(Number(nested.pendingWithdrawal) || 0);
        }
        if (availedRes.ok) setAvailedBonus(asAvailedBonus(availedRes.data));
        if (bonusRes.ok) setBonusData(asBonusEarning(bonusRes.data));
        if (exposureRes.ok) setUserExposure(asExposureTotal(exposureRes.data));
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isCaller]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const openBonusEarning = (Type?: string, obj?: AvailedBonus | null) => {
    navigate('/bonus-wallet-referral-earning', {
      state: { User_ID: userId, Type, obj },
    });
  };

  const openUserExposure = () => {
    if (userExposure > 0) {
      navigate('/user_exposure', { state: userId });
    }
  };

  const profit = depositTotal - withdrawalTotal;
  const profitAfter =
    depositTotal - withdrawalTotal - balanceTotal - pendingWithdrawal;

  const ownEarning = Number(bonusData?.userOwnEarning) || 0;
  const ownEarningCount = Number(bonusData?.userOwnEarningCount) || 0;
  const referralEarning = Number(bonusData?.userReferral) || 0;
  const referralCount = Number(bonusData?.userReferralCount) || 0;
  const availedAmount = Number(availedBonus?.totalAmount) || 0;
  const availedCount = Number(availedBonus?.count) || 0;

  const callerStats = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
        gap: 0.5,
      }}
    >
      <CompactStat
        label={`Bonus Earning (${ownEarningCount})`}
        value={formatAmount(ownEarning)}
        strong
        clickable={ownEarning > 0}
        onClick={() => openBonusEarning('bonus')}
      />
      <CompactStat
        label="User Exposure"
        value={formatAmount(userExposure)}
        strong
        clickable={userExposure > 0}
        onClick={openUserExposure}
      />
    </Box>
  );

  const fullStats = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
        gap: 0.5,
      }}
    >
      <CompactStat label="Deposit" value={formatAmount(depositTotal)} />
      <CompactStat label="Withdraw" value={formatAmount(withdrawalTotal)} />
      <CompactStat label="Balance" value={formatAmount(balanceTotal)} />
      <CompactStat label="Bonus Wallet" value={formatAmount(bonusBalance)} />
      <CompactStat
        label="Pending Withdrawal"
        value={formatAmount(pendingWithdrawal)}
      />
      <CompactStat
        label="Created"
        value={formatReportDate(encrypted?.createdAt)}
      />
      <CompactStat
        label="Last Activity"
        value={formatReportDate(pickLastActivity(encrypted))}
      />
      <CompactStat
        label={profit < 0 ? 'Loss' : 'Profit'}
        value={formatAmount(profit)}
        tone={profit < 0 ? 'error' : 'success'}
        strong
      />
      <CompactStat
        label={toDisplayText(
          profitAfter < 0
            ? 'Loss After Withdrawal'
            : 'Profit After Withdrawal',
        )}
        value={formatAmount(profitAfter)}
        tone={profitAfter < 0 ? 'error' : 'success'}
        strong
      />
      <CompactStat
        label={`Bonus Earning (${ownEarningCount})`}
        value={formatAmount(ownEarning)}
        strong
        clickable={ownEarning > 0}
        onClick={() => openBonusEarning('bonus')}
      />
      <CompactStat
        label={
          availedAmount > 0
            ? `Availed Bonus (${availedCount})`
            : 'Bonus Earning (0)'
        }
        value={formatAmount(availedAmount)}
        strong
        clickable={availedAmount > 0}
        onClick={() => openBonusEarning('availedBonus', availedBonus)}
      />
      <CompactStat
        label={`${toDisplayText('Bonus Referral Earning')} (${referralCount})`}
        value={formatAmount(referralEarning)}
        strong
        clickable={referralEarning > 0}
        onClick={() => openBonusEarning()}
      />
      <CompactStat
        label="User Exposure"
        value={formatAmount(userExposure)}
        strong
        clickable={userExposure > 0}
        onClick={openUserExposure}
      />
    </Box>
  );

  const summaryBody = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 1,
        px: 1,
        pb: 1,
        pt: 0.5,
        width: '100%',
      }}
    >
      {!isCaller ? (
        <Box
          sx={{
            flex: { md: '1 1 56%' },
            width: { xs: '100%', md: '56%' },
            minWidth: 0,
            bgcolor: '#FF9A43',
            px: 1,
            py: 0.75,
            display: 'flex',
            justifyContent: 'space-between',
            color: '#000',
            border: '1px solid #e7812d',
            borderRadius: 1.5,
          }}
        >
          <BazarCol header="Bazar" rows={[...BAZAR_ROWS]} footer="Grand Total" />
          <BazarCol
            header={toDisplayText('(Win - Loss)')}
            rows={['0 - 0', '0 - 0', '0 - 0', '0 - 0']}
            footer="-"
          />
          <BazarCol header="Total" rows={[':0', ':0', ':0', ':0']} footer=":0" />
        </Box>
      ) : null}

      <Box
        sx={{
          flex: isCaller ? '1 1 100%' : { md: '1 1 44%' },
          width: isCaller ? '100%' : { xs: '100%', md: '44%' },
          minWidth: isCaller ? 0 : { md: 320 },
          bgcolor: '#fff',
          px: 1,
          py: 0.75,
          border: '1px solid #d9dde3',
          borderRadius: 1.5,
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
          color: '#000',
        }}
      >
        {loading ? (
          <Stack alignItems="center" py={2}>
            <CircularProgress size={24} />
          </Stack>
        ) : isCaller ? (
          callerStats
        ) : (
          fullStats
        )}
      </Box>
    </Box>
  );

  return (
    <Box>
      <WalletLedgerTable
        userId={userId}
        wrapOverview={({ overview, table }) => (
          <>
            <Box
              sx={{
                my: 1,
                bgcolor: '#fff',
                border: '1px solid #dde2e8',
                borderRadius: 1.5,
                boxShadow: '0 2px 6px rgba(15,23,42,0.05)',
                overflow: 'hidden',
              }}
            >
              <Box
                role="button"
                tabIndex={0}
                aria-expanded={summaryOpen}
                onClick={() => setSummaryOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSummaryOpen((v) => !v);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1,
                  py: 0.65,
                  cursor: 'pointer',
                  userSelect: 'none',
                  bgcolor: summaryOpen ? '#f8fafc' : '#fff',
                  '&:hover': { bgcolor: '#f8fafc' },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}
                  >
                    Wallet Overview
                  </Typography>
                  {!loading && (
                    <Typography sx={{ fontSize: 11, color: '#667085' }}>
                      {isCaller
                        ? `· Bonus Earning ₹${formatAmount(ownEarning)} · Exposure ₹${formatAmount(userExposure)}`
                        : `· Deposit ₹${formatAmount(depositTotal)} · Balance ₹${formatAmount(balanceTotal)} · ${
                            profit < 0 ? 'Loss' : 'Profit'
                          } ₹${formatAmount(profit)}`}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  size="small"
                  aria-label={
                    summaryOpen
                      ? 'Collapse wallet overview'
                      : 'Expand wallet overview'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setSummaryOpen((v) => !v);
                  }}
                  sx={{ p: 0.25, color: '#667085' }}
                >
                  {summaryOpen ? (
                    <ExpandLessIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Box>

              <Collapse in={summaryOpen} timeout="auto" unmountOnExit>
                <Box sx={{ borderTop: '1px solid #eef1f4' }}>
                  {summaryBody}
                  <Box sx={{ px: 1, pb: 1 }}>{overview}</Box>
                </Box>
              </Collapse>
            </Box>
            {table}
          </>
        )}
      />
    </Box>
  );
}

function BazarCol({
  header,
  rows,
  footer,
}: {
  header: string;
  rows: string[];
  footer: string;
}) {
  return (
    <Box sx={{ width: '32%', minWidth: 0 }}>
      <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.45)', mb: 0.25, pb: 0.25 }}>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, color: '#000' }}>
          {header}
        </Typography>
      </Box>
      {rows.map((row, i) => (
        <Typography
          key={`${header}-${i}`}
          noWrap
          sx={{ fontSize: 11, lineHeight: 1.7, color: 'rgba(0,0,0,0.82)' }}
        >
          {toDisplayText(row)}
        </Typography>
      ))}
      <Box sx={{ borderTop: '1px solid rgba(0,0,0,0.45)', mt: 0.25, pt: 0.25 }}>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, color: '#000' }}>
          {footer}
        </Typography>
      </Box>
    </Box>
  );
}

function CompactStat({
  label,
  value,
  tone,
  strong = false,
  clickable = false,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'success' | 'error';
  strong?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  const toneColor = tone === 'error' ? '#b42318' : tone === 'success' ? '#15803d' : '#111827';

  return (
    <Box
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      sx={{
        minWidth: 0,
        px: 0.6,
        py: 0.35,
        bgcolor: tone ? (tone === 'error' ? '#fff1f0' : '#edfdf3') : '#f6f7f9',
        border: `1px solid ${tone ? (tone === 'error' ? '#fecdca' : '#abefc6') : '#e5e7eb'}`,
        borderRadius: 1,
        cursor: clickable ? 'pointer' : 'default',
        ...(clickable
          ? {
              '&:hover': {
                borderColor: '#f97316',
                bgcolor: '#fff7ed',
              },
            }
          : null),
      }}
    >
      <Typography
        noWrap
        title={String(label)}
        sx={{ fontSize: 10, lineHeight: 1.15, color: '#667085' }}
      >
        {label}
      </Typography>
      <Typography
        noWrap
        title={String(value)}
        sx={{
          fontSize: 12,
          lineHeight: 1.35,
          fontWeight: strong ? 700 : 600,
          color: clickable ? '#c2410c' : toneColor,
          textDecoration: clickable ? 'underline' : 'none',
          textUnderlineOffset: 2,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
