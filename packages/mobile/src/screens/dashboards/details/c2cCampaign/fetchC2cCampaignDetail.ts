import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignDataQuery,
  extractC2cCampaign,
  extractC2cCampaignCustomers,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';

export async function fetchC2cCampaignDetail(campaignId: string): Promise<C2cCampaign> {
  const id = campaignId.trim();
  if (!id) throw new Error('Campaign id is required');
  const res = await secureApi('campaign.get', { campaignId: id });
  if (!res.ok) {
    throw new Error(res.message || 'Failed to open campaign');
  }
  const parsed = extractC2cCampaign(res.data);
  if (!parsed) throw new Error('Failed to open campaign');
  return parsed;
}

export type C2cCampaignCustomersParams = {
  campaignId: string;
  page: number;
  search: string;
  status: C2cCustomerStatus;
  assignedTo?: string;
};

export type C2cCampaignCustomersResult = {
  items: C2cCampaignCustomer[];
  total: number;
};

export async function fetchC2cCampaignCustomers(
  params: C2cCampaignCustomersParams,
): Promise<C2cCampaignCustomersResult> {
  const campaignId = params.campaignId.trim();
  if (!campaignId) throw new Error('Campaign id is required');
  const res = await secureApi('campaign.listData', {
    campaignId,
    ...buildC2cCampaignDataQuery({
      pageNo: params.page,
      itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
      search: params.search || undefined,
      status: params.status || undefined,
      assignedTo: params.assignedTo || undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load customers');
  }
  return extractC2cCampaignCustomers(res.data);
}
