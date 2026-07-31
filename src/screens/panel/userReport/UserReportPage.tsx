import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { WalletHistoryView } from './WalletHistoryView';
import { GameHistoryTab } from './GameHistoryTab';
import { MatkaHistoryTab } from './MatkaHistoryTab';
import { QtechHistoryTab } from './QtechHistoryTab';
import { ExchangeHistoryTab } from './ExchangeHistoryTab';
import { RemoveBonusTab } from './RemoveBonusTab';
import { FundRequestTab } from './FundRequestTab';
import { ProviderHistoryTab } from './ProviderHistoryTab';
import { QtechBetDetailsTab } from './QtechBetDetailsTab';
import { SettleJetfairModal } from './SettleJetfairModal';
import { laxmiTabBtnSx } from './laxmiButtonSx';
import {
  USER_REPORT_TABS,
  type EncryptedUser,
  type UserReportTab,
} from './types';

function TabBody({
  tab,
  userId,
  encrypted,
}: {
  tab: UserReportTab;
  userId: string;
  encrypted: EncryptedUser | null;
}): ReactNode {
  switch (tab) {
    case 'wallet_history':
      return <WalletHistoryView userId={userId} encrypted={encrypted} />;
    case 'game_history':
      return <GameHistoryTab userId={userId} />;
    case 'starline_history':
      return <MatkaHistoryTab userId={userId} variant="starline" />;
    case 'king_bazar_history':
      return <MatkaHistoryTab userId={userId} variant="king" />;
    case 'worli_history':
      return <MatkaHistoryTab userId={userId} variant="worli" />;
    case 'crazzy_wheel':
      return <MatkaHistoryTab userId={userId} variant="crazy" />;
    case 'qtech_history':
      return <QtechHistoryTab userId={userId} />;
    case 'jetfair_history':
      return <ExchangeHistoryTab userId={userId} variant="jetfair" />;
    case 'falcon_history':
      return <ExchangeHistoryTab userId={userId} variant="falcon" />;
    case 'remove_bonus_coins':
      return <RemoveBonusTab userId={userId} />;
    case 'fund_request':
      return <FundRequestTab userId={userId} />;
    case 'provider_history':
      return <ProviderHistoryTab userId={userId} kind="qtech" />;
    case 'Qtech_Missing_Bets':
      return <ProviderHistoryTab userId={userId} kind="missing" />;
    case 'jetfairprovider_history':
      return <ProviderHistoryTab userId={userId} kind="jetfair" />;
    case 'sm_provider-history':
      return <ProviderHistoryTab userId={userId} kind="sm" />;
    case 'qtech_bet_details':
      return <QtechBetDetailsTab userId={userId} />;
    default:
      return (
        <Typography color="text.secondary">
          Unknown tab: {tab}
        </Typography>
      );
  }
}

/** User Report hub — opened from Users name click (wallet_history). */
export function UserReportPage() {
  const { userId = '', userName = '' } = useParams<{
    userId: string;
    userName: string;
  }>();
  const navigate = useNavigate();
  const canOpen = hasPermission('wallet_history');
  const [tab, setTab] = useState<UserReportTab>('wallet_history');
  const [loading, setLoading] = useState(true);
  const [encrypted, setEncrypted] = useState<EncryptedUser | null>(null);
  const [smSettleOpen, setSmSettleOpen] = useState(false);
  const [smBusy, setSmBusy] = useState(false);
  const [jetfairSettleOpen, setJetfairSettleOpen] = useState(false);

  const loadEncrypted = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await secureApi('userReport.encryptedId', { userId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load user');
        setEncrypted(null);
        return;
      }
      const data = (res.data || {}) as {
        payload?: EncryptedUser;
      } & EncryptedUser;
      setEncrypted(data.payload || data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!canOpen) {
      navigate('/users', { replace: true });
      return;
    }
    void loadEncrypted();
  }, [canOpen, loadEncrypted, navigate]);

  const onTabClick = (id: UserReportTab) => {
    if (id === 'player_rtp') {
      navigate('/playerRtp', { state: { id: userId, fromUserReport: true } });
      return;
    }
    if (id === 'settle_sm') {
      setSmSettleOpen(true);
      return;
    }
    if (id === 'settle_jetfair') {
      setJetfairSettleOpen(true);
      return;
    }
    setTab(id);
  };

  const settleSm = async () => {
    setSmBusy(true);
    try {
      const res = await secureApi('userReport.settleSmBets', { userId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to settle SM bets');
        return;
      }
      toast.success('Bet Settle Successfully.');
      setSmSettleOpen(false);
    } finally {
      setSmBusy(false);
    }
  };

  const decodedName = decodeURIComponent(userName || '');

  if (!canOpen) return null;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100%', p: { xs: 1, md: 1.5 } }}>
      <Typography
        sx={{
          fontSize: 14,
          color: 'rgba(0,0,0,0.55)',
          mb: 1.5,
          px: 0.5,
        }}
      >
        <Box component="span" sx={{ opacity: 0.7 }}>
          User :{' '}
        </Box>
        / {decodedName}
        {encrypted?.encryptedUserName
          ? ` / ${encrypted.encryptedUserName}`
          : ''}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 1,
        }}
      >
        {USER_REPORT_TABS.map((item) => (
          <Button
            key={item.id}
            variant="contained"
            color="inherit"
            disableElevation
            disableRipple
            onClick={() => onTabClick(item.id)}
            sx={laxmiTabBtnSx(tab === item.id)}
          >
            {item.label}
          </Button>
        ))}
      </Box>

      {loading && !encrypted ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : (
        <TabBody tab={tab} userId={userId} encrypted={encrypted} />
      )}

      <Dialog open={smSettleOpen} onClose={() => setSmSettleOpen(false)}>
        <DialogTitle>Settle SM Bets</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to settle SM bets?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSmSettleOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="inherit"
            disableElevation
            disabled={smBusy}
            onClick={() => void settleSm()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <SettleJetfairModal
        open={jetfairSettleOpen}
        onClose={() => setJetfairSettleOpen(false)}
      />
    </Box>
  );
}
