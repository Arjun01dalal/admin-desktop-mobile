/**
 * C2C campaign select + push for list toolbars.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

import {
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  type C2cCampaign,
} from '@astro/shared';
import { canPushToC2cCampaign } from '@/auth/permissions';
import { pushUserIdsToC2cCampaign } from '@/utils/c2cCampaignPush';
import { secureApi } from '@/api/secureClient';

type Props = {
  userIds: string[];
  disabled?: boolean;
  /** Compact inline toolbar layout (default). */
  sx?: object;
  /** Primary push button label (admin: "Push to C2C"). */
  pushLabel?: string;
};

export function AddToC2cCampaignControls({
  userIds,
  disabled,
  sx,
  pushLabel = 'Add to C2C',
}: Props) {
  const allowed = canPushToC2cCampaign();
  const [campaigns, setCampaigns] = useState<C2cCampaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);

  const loadCampaigns = useCallback(async () => {
    if (!allowed) return;
    setLoadingList(true);
    try {
      const res = await secureApi(
        'campaign.list',
        buildC2cCampaignListQuery({
          pageNo: 1,
          itemsPerPage: 100,
          isActive: true,
        }),
      );
      if (!res.ok) {
        setCampaigns([]);
        return;
      }
      const { items } = extractC2cCampaignList(res.data);
      setCampaigns(items.filter((c) => c._id));
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingList(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    void loadCampaigns();
  }, [allowed, loadCampaigns]);

  const onPush = async () => {
    setMessage('');
    setMessageOk(false);
    setPushing(true);
    try {
      const res = await pushUserIdsToC2cCampaign(campaignId, userIds);
      const text = res.message || (res.ok ? 'Users added to C2C campaign' : 'Failed to add users');
      setMessage(text);
      setMessageOk(res.ok);
      if (res.ok) toast.success(text);
      else toast.error(text);
    } finally {
      setPushing(false);
    }
  };

  if (!allowed) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        flex: '0 0 auto',
        ...sx,
      }}
    >
      <TextField
        select
        label="C2C Campaign"
        size="small"
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        sx={{ width: 200, flexShrink: 0 }}
        disabled={loadingList || disabled}
      >
        <MenuItem value="">
          <em>{loadingList ? 'Loading…' : 'Select C2C campaign'}</em>
        </MenuItem>
        {campaigns.map((c) => (
          <MenuItem key={c._id} value={c._id}>
            {c.campaignName || c._id}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        color="secondary"
        size="small"
        disabled={disabled || pushing || !campaignId || !userIds.length}
        onClick={() => void onPush()}
        sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
      >
        {pushing ? 'Pushing…' : `${pushLabel}${userIds.length ? ` (${userIds.length})` : ''}`}
      </Button>
      {loadingList || pushing ? <CircularProgress size={18} /> : null}
      {message ? (
        <Typography
          variant="caption"
          sx={{ maxWidth: 320, fontWeight: 600, color: messageOk ? 'success.main' : 'error.main' }}
        >
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}
