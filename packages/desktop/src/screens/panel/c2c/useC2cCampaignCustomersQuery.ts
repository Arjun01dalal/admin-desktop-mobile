/**
 * C2C campaign customers (listData) via useSecureQuery.
 */
import { useMemo } from 'react';
import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignDataQuery,
  extractC2cCampaign,
  extractC2cCampaignCustomers,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';
import { useSecureQuery } from '@/screens/panel/dashboards/useSecureQuery';

export type C2cCampaignGetQueryResult = {
  campaign: C2cCampaign | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useC2cCampaignGetQuery(campaignId: string): C2cCampaignGetQueryResult {
  const payload = useMemo(() => ({ campaignId }), [campaignId]);
  const { data, loading, error, refetch } = useSecureQuery<unknown>('campaign.get', payload, {
    enabled: Boolean(campaignId),
    cacheTtlMs: 0,
  });

  const campaign = useMemo(() => (data ? extractC2cCampaign(data) : null), [data]);

  return {
    campaign,
    loading: Boolean(campaignId) && loading,
    error: campaignId && data && !campaign ? 'Failed to open campaign' : error,
    refetch,
  };
}

export type C2cCampaignCustomersQueryParams = {
  campaignId: string;
  page: number;
  search: string;
  status: C2cCustomerStatus;
  assignedTo?: string;
  enabled?: boolean;
};

export type C2cCampaignCustomersQueryResult = {
  customers: C2cCampaignCustomer[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useC2cCampaignCustomersQuery(
  params: C2cCampaignCustomersQueryParams,
): C2cCampaignCustomersQueryResult {
  const payload = useMemo(
    () => ({
      campaignId: params.campaignId,
      ...buildC2cCampaignDataQuery({
        pageNo: params.page,
        itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
        search: params.search || undefined,
        status: params.status || undefined,
        assignedTo: params.assignedTo || undefined,
      }),
    }),
    [params.assignedTo, params.campaignId, params.page, params.search, params.status],
  );

  const enabled = (params.enabled ?? true) && Boolean(params.campaignId);
  const { data, loading, error, refetch } = useSecureQuery<unknown>(
    'campaign.listData',
    payload,
    { enabled, cacheTtlMs: 0 },
  );

  const parsed = useMemo(() => {
    if (!data) return { items: [] as C2cCampaignCustomer[], total: 0 };
    return extractC2cCampaignCustomers(data);
  }, [data]);

  return {
    customers: parsed.items,
    total: parsed.total,
    totalPages: Math.max(1, Math.ceil(parsed.total / C2C_CAMPAIGN_PAGE_SIZE)),
    loading: enabled && loading,
    error,
    refetch,
  };
}
