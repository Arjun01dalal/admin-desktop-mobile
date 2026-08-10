import { useMemo, useState } from 'react';
import {
  Box,
  Button,
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
import { getStoredUser } from '@/utils/dates';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { buildBotDialoutSetting } from './toolbarHelpers';
import type { UserRow } from './utils';

type CallingAdmin = {
  _id?: string;
  name?: string;
  extensionId?: string[] | string;
  serverId?: string | number;
};

type CallingBtnProps = {
  item: UserRow;
  reasonList?: string;
  botId?: string;
  campaignName?: string;
  /** Hide Bot Call button (New Registers parity). */
  hideBotCall?: boolean;
  /** Log call via /User/call-logs-for-new-registration before dialer. */
  isNewRegistration?: boolean;
  onSuccess?: () => void;
};

function extensionIds(admin: CallingAdmin | null): string[] {
  const raw = admin?.extensionId;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

/**
 * Mobile + Call / Bot Call — ported from laxminarayan CallingBtn.
 * Number visible only when `show_mobile` responsibility is present.
 */
export function CallingBtn({
  item,
  reasonList = 'User List',
  botId = '1',
  campaignName,
  hideBotCall = false,
  isNewRegistration = false,
  onSuccess,
}: CallingBtnProps) {
  const admin = getStoredUser<CallingAdmin>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => extensionIds(admin), [admin]);
  const numericCampaignId = useMemo(
    () => ids.find((val) => /^\d+$/.test(val)) || '',
    [ids],
  );
  // Same values posted by externalDialerSingle / laxmi sendData
  const dialerListId = numericCampaignId ? `9${numericCampaignId}` : '—';
  const dialerListName = `${String(admin?.name || 'ADMIN').toUpperCase()} BOT CALLING LIST`;
  const dialerCampaignId = numericCampaignId || '—';
  const dialerCampaignLabel = campaignName?.trim() || dialerCampaignId;

  const mobile = String(item.mobile || item.userMobile || '');

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  /** Manual Call — external dialer single lead (laxminarayan sendData). */
  const sendData = async () => {
    if (!numericCampaignId) {
      toast.error('Dialer extension / campaign ID not found for this admin');
      return;
    }
    setBusy(true);
    try {
      if (isNewRegistration && item._id) {
        const logRes = await secureApi('users.callLogsForNewRegistration', {
          _id: item._id,
          who: {
            userId: admin?._id,
            userName: admin?.name,
          },
        });
        if (!logRes.ok) {
          toast.error(logRes.message || 'Failed to log call');
          return;
        }
      }

      const res = await secureApi('callLogs.externalDialerSingle', {
        details: {
          client_name: item.name || item.userName,
          phone_number: mobile,
          city: item.city,
          state: item.state,
          clientName: item.clientName,
          app_name: item.clientName,
          caller_user_id: item._id,
        },
        extensionId: ids,
        adminName: admin?.name || 'ADMIN',
        serverId: admin?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'API request failed');
        return;
      }
      toast.success(res.message || 'Data sent successfully');
      setOpen(false);
      onSuccess?.();
    } finally {
      setBusy(false);
    }
  };

  /** Bot Call — POST /SubAdmin/add-to-dialer (laxminarayan initiateBotCall). */
  const initiateBotCall = async () => {
    setBusy(true);
    try {
      const res = await secureApi('callLogs.addToBotDialer', {
        userId: admin?._id,
        created_by: admin?.name,
        dialout_settings: [buildBotDialoutSetting(item, botId, reasonList)],
      });
      if (!res.ok) {
        toast.error(res.message || 'Bot call failed');
        return;
      }
      toast.success(res.message || 'Call Initiated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ py: 0.25, maxWidth: '100%' }}>
      <Typography
        component="span"
        sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, color: 'text.primary' }}
      >
        {canShowMobile ? mobile || '—' : mobile ? '**********' : '—'}
      </Typography>
      <Stack direction="row" spacing={0.5}>
        <Button
          size="small"
          variant="contained"
          color="warning"
          disabled={busy || !mobile}
          onClick={handleOpen}
          sx={{
            minWidth: 48,
            px: 1,
            py: 0.2,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          Call
        </Button>
        {!hideBotCall && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={busy || !mobile}
            onClick={() => void initiateBotCall()}
            sx={{
              minWidth: 64,
              px: 1,
              py: 0.2,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Bot Call
          </Button>
        )}
      </Stack>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: 18 }}>
          Confirm Details
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: 2,
              p: 2,
              mt: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              CAMPAIGN ID
            </Typography>
            <Typography
              sx={{ fontWeight: 700, fontSize: 18, color: 'primary.main', mb: 1.5 }}
            >
              {dialerCampaignLabel}
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              LIST ID
            </Typography>
            <Typography
              sx={{ fontWeight: 700, fontSize: 18, color: 'primary.main', mb: 1.5 }}
            >
              {dialerListId}
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              LIST NAME
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
              {dialerListName}
            </Typography>
          </Box>
          <Typography sx={{ textAlign: 'center', mt: 2, fontSize: 13, color: 'text.secondary' }}>
            Do you want to proceed with this details?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button fullWidth variant="outlined" color="error" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => void sendData()}
            disabled={busy || !numericCampaignId}
            sx={{ fontWeight: 600 }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
