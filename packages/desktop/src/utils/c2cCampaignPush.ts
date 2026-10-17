/**
 * Push userIds into a C2C campaign — POST /campaign/{campaignId}/data
 */
import {
  collectC2cUserIds,
  extractC2cAddCustomersResult,
  formatC2cAddCustomersMessage,
  type C2cAddCustomersResult,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';

export async function pushUserIdsToC2cCampaign(
  campaignId: string,
  userIds: unknown[],
): Promise<{ ok: boolean; message: string; result?: C2cAddCustomersResult }> {
  const id = String(campaignId || '').trim();
  const ids = collectC2cUserIds(userIds);
  if (!id) return { ok: false, message: 'Select a C2C campaign' };
  if (!ids.length) return { ok: false, message: 'No users to push' };

  const res = await secureApi('campaign.addData', {
    campaignId: id,
    userIds: ids,
  });
  if (!res.ok) {
    return { ok: false, message: res.message || 'Failed to add users to C2C campaign' };
  }
  const result = extractC2cAddCustomersResult(res.data);
  return {
    ok: true,
    message:
      formatC2cAddCustomersMessage(result) ||
      res.message ||
      `Added ${result.inserted ?? ids.length} users`,
    result,
  };
}
