import { useState } from 'react';
import { Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import { toast } from 'react-toastify';
import { sanitizeGtelPhone } from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { useGtelClickToCall } from '@/screens/panel/gtel/useGtelClickToCall';
import { gtelIconBtnSx } from '@/screens/panel/gtel/styles';
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
 * Mobile number + Gtel C2C icon + optional Bot Call — ported from laxminarayan CallingBtn.
 * Number visible only when `show_mobile` responsibility is present.
 */
export function CallingBtn({
  item,
  reasonList = 'User List',
  botId = '1',
  hideBotCall = false,
}: CallingBtnProps) {
  const admin = getStoredUser<CallingAdmin>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const { canShowC2c, startC2c, isCalling } = useGtelClickToCall();
  const [busy, setBusy] = useState(false);

  const mobile = String(item.mobile || item.userMobile || '');
  const userId = String(item._id || item.userId || '');
  const phone = sanitizeGtelPhone(mobile);
  const calling = isCalling(mobile);

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
    <Stack alignItems="stretch" spacing={0.5} sx={{ py: 0.25, width: '100%', maxWidth: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ width: '100%', minWidth: 0 }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'text.primary',
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            pr: 1,
          }}
        >
          {canShowMobile ? mobile || '—' : mobile ? '**********' : '—'}
        </Typography>
        {canShowC2c && phone ? (
          <Tooltip title="C2C Call">
            <span style={{ flexShrink: 0, marginLeft: 'auto' }}>
              <IconButton
                size="small"
                aria-label="C2C Call"
                disabled={calling}
                onClick={(e) => {
                  e.stopPropagation();
                  void startC2c(mobile, userId || undefined);
                }}
                sx={{ ...gtelIconBtnSx, width: 28, height: 28, p: 0.35 }}
              >
                {calling ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <PhoneInTalkOutlinedIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>
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
