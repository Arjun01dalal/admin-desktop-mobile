/** Detail + customers + edit state for a single C2C campaign. */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { C2C_CAMPAIGN_PAGE_SIZE, type C2cCustomerStatus } from '@astro/shared';

import { queryKeys } from '../../../../api/queryKeys';
import { secureApi } from '../../../../api/client';
import { useScreenQuery } from '../../../../hooks/useScreenQuery';
import type { C2cCampaignFormValues } from './C2cCampaignFormModal';
import {
  fetchC2cCampaignCustomers,
  fetchC2cCampaignDetail,
} from './fetchC2cCampaignDetail';
import { useC2cCallers } from './useC2cCallers';

const EMPTY_FORM: C2cCampaignFormValues = {
  name: '',
  isActive: true,
  callerIds: [],
};

export function useC2cCampaignDetail(campaignId: string) {
  const { callers, loadCallers } = useC2cCallers(false);

  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatus, setCustomerStatus] = useState<C2cCustomerStatus>('');
  const [customerApplied, setCustomerApplied] = useState({
    search: '',
    status: '' as C2cCustomerStatus,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<C2cCampaignFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const detailQuery = useScreenQuery({
    queryKey: queryKeys.c2cCampaigns.detail(campaignId),
    queryFn: () => fetchC2cCampaignDetail(campaignId),
    enabled: Boolean(campaignId),
  });

  const customerParams = {
    campaignId,
    page: customerPage,
    search: customerApplied.search,
    status: customerApplied.status,
  };

  const customersQuery = useScreenQuery({
    queryKey: queryKeys.c2cCampaigns.customers(customerParams),
    queryFn: () => fetchC2cCampaignCustomers(customerParams),
    enabled: Boolean(campaignId),
  });

  const selected = detailQuery.data ?? null;
  const customers = customersQuery.data?.items ?? [];
  const customerTotal = customersQuery.data?.total ?? 0;
  const customerTotalPages = Math.max(1, Math.ceil(customerTotal / C2C_CAMPAIGN_PAGE_SIZE));
  const loadCampaign = detailQuery.refresh;
  const loadCustomers = customersQuery.refresh;

  useEffect(() => {
    setCustomerPage(1);
    setCustomerApplied({ search: '', status: '' });
    setCustomerSearch('');
    setCustomerStatus('');
  }, [campaignId]);

  useEffect(() => {
    if (!detailQuery.errorMessage) return;
    Alert.alert('Error', detailQuery.errorMessage);
  }, [detailQuery.errorMessage]);

  const openEdit = useCallback(() => {
    if (!selected) {
      Alert.alert('Error', 'Campaign details not loaded yet');
      return;
    }
    setFormValues({
      name: selected.campaignName,
      isActive: selected.isActive,
      callerIds: selected.callers.map((c) => c._id).filter(Boolean),
    });
    setFormOpen(true);
    void loadCallers();
  }, [loadCallers, selected]);

  const saveEdit = useCallback(async () => {
    const name = formValues.name.trim();
    if (!name) {
      Alert.alert('Validation', 'Campaign name is required');
      return;
    }
    if (!campaignId) return;
    setSaving(true);
    try {
      const res = await secureApi('campaign.update', {
        campaignId,
        campaignName: name,
        isActive: formValues.isActive,
        callerIds: formValues.callerIds,
      });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Update failed');
        return;
      }
      setFormOpen(false);
      void loadCampaign();
    } finally {
      setSaving(false);
    }
  }, [campaignId, formValues, loadCampaign]);

  const applyCustomerFilters = useCallback(() => {
    setCustomerApplied({ search: customerSearch.trim(), status: customerStatus });
    setCustomerPage(1);
  }, [customerSearch, customerStatus]);

  return {
    selected,
    detailLoading: detailQuery.loading || detailQuery.refreshing,
    customers,
    customerTotal,
    customerPage,
    setCustomerPage,
    customerTotalPages,
    customersLoading: customersQuery.loading || customersQuery.refreshing,
    customerSearch,
    setCustomerSearch,
    customerStatus,
    setCustomerStatus,
    applyCustomerFilters,
    loadCustomers,
    loadCampaign,
    callers,
    formOpen,
    setFormOpen,
    formValues,
    setFormValues,
    saving,
    openEdit,
    saveEdit,
  };
}
