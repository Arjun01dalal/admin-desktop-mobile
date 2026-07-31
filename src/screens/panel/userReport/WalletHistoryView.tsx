import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { formatAmount, formatDisplayDate } from '@/utils/dates';
import { WalletLedgerTable } from './WalletLedgerTable';
import type { EncryptedUser } from './types';

type Props = {
  userId: string;
  encrypted?: EncryptedUser | null;
};

type BonusEarning = {
  userReferral?: number;
  userReferralCount?: number;
  userOwnEarning?: number;
  userOwnEarningCount?: number;
};

type AvailedBonus = {
  totalAmount?: number;
  count?: number;
};

const BAZAR_ROWS = ['Regular', 'Starline', 'King Bazar', 'Casino'] as const;

function unpackPayload<T>(data: unknown): T | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as { payload?: T };
  return (rec.payload ?? data) as T;
}

/** Wallet History tab — layout mirrors admin-panel WalletHistory.css */
export function WalletHistoryView({ userId, encrypted }: Props) {
  const showProfit = hasPermission('show_profit_loss');
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
      const [walletRes, bonusRes, availedRes, exposureRes] = await Promise.all([
        secureApi('userReport.walletHistory', {
          itemsPerPage: 1,
          pageNo: 1,
          filter: { userId },
        }),
        secureApi('userReport.bonusTotalEarning', {
          userId,
          itemsPerPage: 10,
          pageNo: 1,
        }),
        secureApi('userReport.bonusApprovedTotal', { userId }),
        secureApi('userReport.userExposure', { _id: userId }),
      ]);

      if (walletRes.ok) {
        const nested = unpackPayload<{
          totalDeposit?: number;
          totalWithdrawal?: number;
          balance?: number;
          bonusWalletBalance?: number;
          pendingWithdrawal?: number;
        }>(walletRes.data);
        setDepositTotal(Number(nested?.totalDeposit) || 0);
        setWithdrawalTotal(Number(nested?.totalWithdrawal) || 0);
        setBalanceTotal(Math.floor(Number(nested?.balance) || 0));
        setBonusBalance(Number(nested?.bonusWalletBalance) || 0);
        setPendingWithdrawal(Number(nested?.pendingWithdrawal) || 0);
      }

      if (bonusRes.ok) {
        setBonusData(unpackPayload<BonusEarning>(bonusRes.data));
      }
      if (availedRes.ok) {
        setAvailedBonus(unpackPayload<AvailedBonus>(availedRes.data));
      }
      if (exposureRes.ok) {
        const expo = unpackPayload<number | { total?: number }>(exposureRes.data);
        if (typeof expo === 'number') setUserExposure(expo);
        else setUserExposure(Number(expo?.total) || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const profit = depositTotal - withdrawalTotal;
  const profitAfter =
    depositTotal - withdrawalTotal - balanceTotal - pendingWithdrawal;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          gap: 1.25,
          my: 2.5,
          width: '100%',
        }}
      >
        {/* Orange bazar stub — ~70% */}
        <Box
          sx={{
            flex: { md: '1 1 70%' },
            width: { xs: '100%', md: '70%' },
            bgcolor: '#FF9A43',
            p: 1.25,
            display: 'flex',
            justifyContent: 'space-between',
            color: '#000',
          }}
        >
          <BazarCol
            header="Bazar"
            rows={[...BAZAR_ROWS]}
            footer="Grand Total"
          />
          <BazarCol
            header="(Win - Loss)"
            rows={['0 - 0', '0 - 0', '0 - 0', '0 - 0']}
            footer="-"
          />
          <BazarCol
            header="Total"
            rows={[':0', ':0', ':0', ':0']}
            footer=":0"
          />
        </Box>

        {/* Stats panel — white + shadow */}
        <Box
          sx={{
            flex: { md: '1 1 26%' },
            width: { xs: '100%', md: '26%' },
            bgcolor: '#fff',
            p: 1.25,
            boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
            color: '#000',
          }}
        >
          {loading ? (
            <Stack alignItems="center" py={3}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={0}>
              <StatText>{`Deposit: ${formatAmount(depositTotal)}`}</StatText>
              <StatText>{`Withdraw: ${formatAmount(withdrawalTotal)}`}</StatText>
              <StatText>{`Balance: ${formatAmount(balanceTotal)}`}</StatText>
              <StatText>{`Bonus Wallet Balance: ${formatAmount(bonusBalance)}`}</StatText>
              <StatText>{`Pending withdrawal: ${formatAmount(pendingWithdrawal)}`}</StatText>
              <StatText>
                {`Created At: ${formatDisplayDate(encrypted?.createdAt) || '-'}`}
              </StatText>
              <StatText>
                {`Last Activity: ${formatDisplayDate(encrypted?.activeUser) || '-'}`}
              </StatText>

              {showProfit && (
                <>
                  <Box sx={{ borderTop: '1px solid #000', mt: 1.25, pt: 1.25 }}>
                    <Typography
                      sx={{
                        fontSize: 15,
                        py: 0.5,
                        fontWeight: 600,
                        color: profit < 0 ? 'red' : 'green',
                      }}
                    >
                      {profit < 0 ? 'Loss' : 'Profit'}: {formatAmount(profit)}
                    </Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid #000', mt: 1.25, pt: 1.25 }}>
                    <Typography
                      sx={{
                        fontSize: 15,
                        py: 0.5,
                        fontWeight: 600,
                        color: profitAfter < 0 ? 'red' : 'green',
                      }}
                    >
                      {profitAfter < 0
                        ? 'Loss After Withdrawal'
                        : 'Profit After Withdrawal'}
                      : {formatAmount(profitAfter)}
                    </Typography>
                  </Box>
                </>
              )}

              <Typography sx={{ fontSize: 15, py: 0.5, fontWeight: 700 }}>
                Bonus Earning ({bonusData?.userOwnEarningCount ?? 0}) :{' '}
                {formatAmount(bonusData?.userOwnEarning ?? 0)}
              </Typography>
              <Typography sx={{ fontSize: 15, py: 0.5, fontWeight: 700 }}>
                Bonus Earning ({availedBonus?.count ?? 0}) :{' '}
                {formatAmount(availedBonus?.totalAmount ?? 0)}
              </Typography>
              <Typography sx={{ fontSize: 15, py: 0.5, fontWeight: 700 }}>
                Bonus Referral Earning ({bonusData?.userReferralCount ?? 0}) :{' '}
                {formatAmount(bonusData?.userReferral ?? 0)}
              </Typography>
              <Typography sx={{ fontSize: 15, py: 0.5, fontWeight: 700 }}>
                User Exposure Total Sum : {formatAmount(userExposure)}
              </Typography>
            </Stack>
          )}
        </Box>
      </Box>

      <WalletLedgerTable userId={userId} />
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
    <Box sx={{ width: '30%' }}>
      <Box sx={{ borderBottom: '1px solid #000', mb: 1.25 }}>
        <Typography sx={{ fontSize: 15, py: 0.5, mb: 0, color: '#000' }}>
          {header}
        </Typography>
      </Box>
      {rows.map((row, i) => (
        <Typography key={`${header}-${i}`} sx={{ fontSize: 15, py: 0.5, color: '#000' }}>
          {row}
        </Typography>
      ))}
      <Box sx={{ borderTop: '1px solid #000', mt: 1.25 }}>
        <Typography sx={{ fontSize: 15, py: 0.5, color: '#000' }}>{footer}</Typography>
      </Box>
    </Box>
  );
}

function StatText({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 15, py: 0.5, mb: 0, color: '#000' }}>
      {children}
    </Typography>
  );
}
