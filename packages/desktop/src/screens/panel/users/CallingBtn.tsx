import { useMemo, useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import {
  collectCallerExtensionIds,
  resolveCallerDialerIdsFromUser,
} from '@astro/shared';
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
  [key: string]: unknown;
};

type CallingBtnProps = {
  item: UserRow;
  reasonList?: string;
  botId?: string;
  /** Login / toolbar campaign id fallback (e.g. K_1009). */
  campaignName?: string;
  /** Hide Bot Call button (New Registers parity). */
  hideBotCall?: boolean;
  /** Log call via /User/call-logs-for-new-registration before dialer. */
  isNewRegistration?: boolean;
  onSuccess?: () => void;
};

/**
 * Mobile + Call / Bot Call — ported from laxminarayan CallingBtn.
 * Number visible only when `show_mobile` responsibility is present.
 * Call dials immediately (no confirm modal) using login campaign id (e.g. K_1009)
 * and list_id `90` + digits (e.g. 901009).
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
  const [busy, setBusy] = useState(false);

  const dialerIds = useMemo(
    () =>
      resolveCallerDialerIdsFromUser(
        admin as Record<string, unknown> | null,
        campaignName,
      ),
    [admin, campaignName],
  );

  const extensionIdPayload = useMemo(() => {
    const fromLogin = collectCallerExtensionIds(admin as Record<string, unknown> | null);
    if (dialerIds?.campaignId && !fromLogin.includes(dialerIds.campaignId)) {
      fromLogin.push(dialerIds.campaignId);
    }
    if (dialerIds?.numericPart && !fromLogin.includes(dialerIds.numericPart)) {
      fromLogin.push(dialerIds.numericPart);
    }
    return fromLogin;
  }, [admin, dialerIds]);

  const mobile = String(item.mobile || item.userMobile || '');

  /** Manual Call — external dialer single lead (login campaign + 90<id> list). */
  const sendData = async () => {
    if (!mobile) {
      toast.error('Mobile number not found');
      return;
    }
    if (!dialerIds) {
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
        extensionId: extensionIdPayload.length ? extensionIdPayload : [dialerIds.campaignId],
        adminName: admin?.name || 'ADMIN',
        serverId: admin?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'API request failed');
        return;
      }
      toast.success(res.message || 'Data sent successfully');
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
          disabled={busy || !mobile || !dialerIds}
          onClick={() => void sendData()}
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
    </Stack>
  );
}
