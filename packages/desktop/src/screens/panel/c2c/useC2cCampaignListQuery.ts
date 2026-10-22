/**
 * C2C campaign list via useSecureQuery (normalize in hook).
 */
import { useMemo } from 'react';
import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  type C2cCampaign,
} from '@astro/shared';
import { useSecureQuery } from '@/screens/panel/dashboards/useSecureQuery';

export type C2cCampaignListQueryParams = {
  page: number;
  search: string;
  isActive: '' | 'true' | 'false';
  enabled?: boolean;
};

export type C2cCampaignListQueryResult = {
  campaigns: C2cCampaign[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useC2cCampaignListQuery(
  params: C2cCampaignListQueryParams,
): C2cCampaignListQueryResult {
  const payload = useMemo(
    () =>
      buildC2cCampaignListQuery({
        pageNo: params.page,
        itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
        search: params.search || undefined,
        isActive:
          params.isActive === 'true' ? true : params.isActive === 'false' ? false : '',
      }),
    [params.isActive, params.page, params.search],
  );

  const { data, loading, error, refetch } = useSecureQuery<unknown>('campaign.list', payload, {
    enabled: params.enabled ?? true,
    cacheTtlMs: 0,
  });

  const parsed = useMemo(() => {
    if (!data) return { items: [] as C2cCampaign[], total: 0 };
    return extractC2cCampaignList(data);
  }, [data]);

  return {
    campaigns: parsed.items,
    total: parsed.total,
    totalPages: Math.max(1, Math.ceil(parsed.total / C2C_CAMPAIGN_PAGE_SIZE)),
    loading,
    error,
    refetch,
  };
}
