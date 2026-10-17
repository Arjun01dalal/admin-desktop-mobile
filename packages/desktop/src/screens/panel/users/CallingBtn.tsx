import { useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
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
  [key: string]: unknown;
};

type CallingBtnProps = {
  item: UserRow;
  reasonList?: string;
  botId?: string;
  /** Login / toolbar campaign id fallback (unused; kept for call-site compat). */
  campaignName?: string;
  /** Hide Bot Call button (New Registers parity). */
  hideBotCall?: boolean;
  /** Unused; kept for call-site compat. */
  isNewRegistration?: boolean;
  onSuccess?: () => void;
};

/**
 * Mobile number + optional Bot Call — ported from laxminarayan CallingBtn.
 * Number visible only when `show_mobile` responsibility is present.
 * Manual Dialer "Call" was removed; use C2C push instead.
 */
export function CallingBtn({
  item,
  reasonList = 'User List',
  botId = '1',
  hideBotCall = false,
}: CallingBtnProps) {
  const admin = getStoredUser<CallingAdmin>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [busy, setBusy] = useState(false);

  const mobile = String(item.mobile || item.userMobile || '');

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
      {!hideBotCall ? (
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
      ) : null}
    </Stack>
  );
}
