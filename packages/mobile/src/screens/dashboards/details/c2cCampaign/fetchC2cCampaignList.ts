import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  type C2cCampaign,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';

export type C2cCampaignListParams = {
  page: number;
  search: string;
  isActive: '' | 'true' | 'false';
};

export type C2cCampaignListResult = {
  items: C2cCampaign[];
  total: number;
};

export async function fetchC2cCampaignList(
  params: C2cCampaignListParams,
): Promise<C2cCampaignListResult> {
  const res = await secureApi(
    'campaign.list',
    buildC2cCampaignListQuery({
      pageNo: params.page,
      itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
      search: params.search || undefined,
      isActive:
        params.isActive === 'true' ? true : params.isActive === 'false' ? false : '',
    }),
  );
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load campaigns');
  }
  return extractC2cCampaignList(res.data);
}
