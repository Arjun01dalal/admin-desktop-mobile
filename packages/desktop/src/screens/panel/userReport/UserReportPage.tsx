import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { BackRowActions } from '@/layout/BackRowActions';
import { WalletHistoryView } from './WalletHistoryView';
import { GameHistoryTab } from './GameHistoryTab';
import { MatkaHistoryTab } from './MatkaHistoryTab';
import { QtechHistoryTab } from './QtechHistoryTab';
import { ExchangeHistoryTab } from './ExchangeHistoryTab';
import { CoinsTab } from './CoinsTab';
import { AddBonusCoinsTab } from './AddBonusCoinsTab';
import { RemoveBonusTab } from './RemoveBonusTab';
import { FundRequestTab } from './FundRequestTab';
import { ProviderHistoryTab } from './ProviderHistoryTab';
import { QtechBetDetailsTab } from './QtechBetDetailsTab';
import { SettleJetfairModal } from './SettleJetfairModal';
import {
  canShowAddBonusCoinsTab,
  canShowCoinsTab,
} from './coinAccess';
import {
  USER_REPORT_TABS,
  type EncryptedUser,
  type UserReportTab,
} from './types';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

/** Short labels in the Back-adjacent dropdown. */
const SHORT_LABEL: Partial<Record<UserReportTab, string>> = {
  wallet_history: 'Wallet',
  game_history: 'Game',
  starline_history: 'Starline',
  king_bazar_history: 'King Bazar',
  worli_history: 'Instant Win',
  qtech_history: 'Qtech',
  jetfair_history: 'JetFair',
  falcon_history: 'Falcon',
  remove_bonus_coins: 'Remove Bonus',
  add_bonus_coins: 'Add Bonus',
  fund_request: 'Fund Request',
  provider_history: 'Qtech Provider',
  Qtech_Missing_Bets: 'Qtech Missing',
  jetfairprovider_history: 'Jetfair Provider',
  'sm_provider-history': 'SM Provider',
  qtech_bet_details: 'Qtech Bets',
  crazzy_wheel: 'Crazy Wheel',
  settle_sm: 'Settle SM',
  settle_jetfair: 'Settle Jetfair',
  player_rtp: 'Player RTP',
};

const HISTORY_IDS: UserReportTab[] = [
  'wallet_history',
  'game_history',
  'starline_history',
  'king_bazar_history',
  'worli_history',
  'qtech_history',
  'jetfair_history',
  'falcon_history',
  'crazzy_wheel',
];

const WALLET_IDS: UserReportTab[] = [
  'coins',
  'add_bonus_coins',
  'remove_bonus_coins',
  'fund_request',
];

const PROVIDER_IDS: UserReportTab[] = [
  'provider_history',
  'Qtech_Missing_Bets',
  'jetfairprovider_history',
  'sm_provider-history',
  'qtech_bet_details',
];

const ACTION_IDS: UserReportTab[] = [
  'settle_sm',
  'settle_jetfair',
  'player_rtp',
];

function tabLabel(id: UserReportTab, fullLabel: string): string {
  return toDisplayText(SHORT_LABEL[id] || fullLabel);
}

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
    case 'coins':
      return <CoinsTab userId={userId} />;
    case 'add_bonus_coins':
      return <AddBonusCoinsTab userId={userId} />;
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
  useRevealCodes();
  const { userId = '', userName = '' } = useParams<{
    userId: string;
    userName: string;
  }>();
  const navigate = useNavigate();
  const canOpen = hasPermission('wallet_history');
  const showCoinsTab = canShowCoinsTab();
  const showAddBonusTab = canShowAddBonusCoinsTab();
  const visibleTabs = useMemo(
    () =>
      USER_REPORT_TABS.filter((item) => {
        if (item.id === 'coins') return showCoinsTab;
        if (item.id === 'add_bonus_coins') return showAddBonusTab;
        return true;
      }),
    [showCoinsTab, showAddBonusTab],
  );
  const byId = useMemo(
    () => new Map(visibleTabs.map((t) => [t.id, t])),
    [visibleTabs],
  );

  const pickGroup = useCallback(
    (ids: UserReportTab[]) =>
      ids
        .map((id) => byId.get(id))
        .filter((t): t is { id: UserReportTab; label: string } => Boolean(t)),
    [byId],
  );

  const historyTabs = useMemo(() => pickGroup(HISTORY_IDS), [pickGroup]);
  const walletTabs = useMemo(() => pickGroup(WALLET_IDS), [pickGroup]);
  const providerTabs = useMemo(() => pickGroup(PROVIDER_IDS), [pickGroup]);
  const actionTabs = useMemo(() => pickGroup(ACTION_IDS), [pickGroup]);

  const [tab, setTab] = useState<UserReportTab>('wallet_history');
  const [loading, setLoading] = useState(true);
  const [encrypted, setEncrypted] = useState<EncryptedUser | null>(null);
  const [smSettleOpen, setSmSettleOpen] = useState(false);
  const [smBusy, setSmBusy] = useState(false);
  const [jetfairSettleOpen, setJetfairSettleOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const hit = byId.get(tab);
    return hit ? tabLabel(hit.id, hit.label) : 'Wallet';
  }, [byId, tab]);

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
        payload?: EncryptedUser & Record<string, unknown>;
      } & EncryptedUser &
        Record<string, unknown>;
      const nested = (data.payload || data) as EncryptedUser & Record<string, unknown>;
      setEncrypted({
        encryptedUserName: nested.encryptedUserName
          ? String(nested.encryptedUserName)
          : undefined,
        createdAt: nested.createdAt
          ? String(nested.createdAt)
          : nested.createdOn
            ? String(nested.createdOn)
            : undefined,
        activeUser: nested.activeUser
          ? String(nested.activeUser)
          : nested.lastActivity
            ? String(nested.lastActivity)
            : nested.updatedOn
              ? String(nested.updatedOn)
              : nested.updatedAt
                ? String(nested.updatedAt)
                : undefined,
        lastActivity: nested.lastActivity ? String(nested.lastActivity) : undefined,
        updatedOn: nested.updatedOn ? String(nested.updatedOn) : undefined,
        updatedAt: nested.updatedAt ? String(nested.updatedAt) : undefined,
      });
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

  const renderGroup = (
    title: string,
    items: { id: UserReportTab; label: string }[],
  ) => {
    if (items.length === 0) return null;
    return [
      <ListSubheader
        key={`${title}-h`}
        sx={{
          lineHeight: '24px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#8a94a4',
          bgcolor: '#f7f8fa',
          borderTop: '1px solid #edf0f4',
          borderBottom: '1px solid #edf0f4',
        }}
      >
        {title}
      </ListSubheader>,
      ...items.map((item) => (
        <MenuItem key={item.id} value={item.id} dense>
          {tabLabel(item.id, item.label)}
        </MenuItem>
      )),
    ];
  };

  const sectionSelect = useMemo(
    () => (
      <TextField
        select
        size="small"
        value={tab}
        onChange={(e) => {
          const id = e.target.value as UserReportTab;
          onTabClick(id);
        }}
        SelectProps={{
          displayEmpty: true,
          renderValue: () => currentLabel,
          MenuProps: {
            MenuListProps: { dense: true, sx: { py: 0 } },
            PaperProps: {
              sx: {
                mt: 0.5,
                minWidth: 180,
                maxHeight: 380,
                bgcolor: '#fff',
                borderRadius: '8px',
                border: '1px solid #e3e7ed',
                boxShadow: '0 10px 28px rgba(15,23,42,0.14)',
                '& .MuiMenuItem-root': {
                  fontSize: 12,
                  minHeight: 30,
                  color: '#344054',
                  '&:hover': { bgcolor: '#f2f4f7' },
                  '&.Mui-selected': {
                    bgcolor: '#e8f1fd',
                    color: '#1565c0',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#dceafb' },
                  },
                },
              },
            },
          },
        }}
        sx={{
          width: 136,
          '& .MuiOutlinedInput-root': {
            bgcolor: '#fff',
            color: '#111',
            fontSize: 11,
            fontWeight: 600,
            height: 32,
            borderRadius: '6px !important',
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
            '& fieldset': {
              borderColor: '#b8c2cf',
              borderWidth: '1px !important',
              borderRadius: '6px !important',
            },
            '&:hover fieldset': { borderColor: '#1976d2' },
            '&.Mui-focused fieldset': {
              borderColor: '#1976d2',
              borderWidth: '1px !important',
            },
          },
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            color: '#344054 !important',
            WebkitTextFillColor: '#344054 !important',
            py: '0 !important',
            pl: '10px !important',
            pr: '30px !important',
            minHeight: '0 !important',
          },
          '& .MuiSelect-icon': {
            color: '#667085',
            fontSize: 18,
            right: 7,
          },
        }}
      >
        {renderGroup('History', historyTabs)}
        {renderGroup('Wallet', walletTabs)}
        {renderGroup('Providers', providerTabs)}
        {renderGroup('Actions', actionTabs)}
      </TextField>
    ),
    // onTabClick closes over navigate/userId — intentional refresh when those change via tab/label/groups
    [tab, currentLabel, historyTabs, walletTabs, providerTabs, actionTabs, userId],
  );

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100%', p: { xs: 0.5, md: 0.75 } }}>
      {/* Renders beside AppShell Back button (same row, right side). */}
      <BackRowActions>{sectionSelect}</BackRowActions>

      <Typography
        sx={{
          fontSize: 12,
          color: 'rgba(0,0,0,0.55)',
          mb: 0.75,
          px: 0.25,
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
