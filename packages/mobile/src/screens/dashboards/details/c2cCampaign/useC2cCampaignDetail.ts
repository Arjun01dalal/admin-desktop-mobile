/** Detail + customers + edit state for a single C2C campaign. */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignDataQuery,
  extractC2cCampaign,
  extractC2cCampaignCustomers,
  type C2cCampaign,
  type C2cCampaignCustomer,
  type C2cCustomerStatus,
} from '@astro/shared';

import type { C2cCampaignFormValues } from './C2cCampaignFormModal';
import { secureApi } from '../../../../api/client';
import { useC2cCallers } from './useC2cCallers';


const EMPTY_FORM: C2cCampaignFormValues = {
  name: '',
  isActive: true,
  callerIds: [],
};

export function useC2cCampaignDetail(campaignId: string) {
  const { callers, loadCallers } = useC2cCallers(false);

  const [selected, setSelected] = useState<C2cCampaign | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customers, setCustomers] = useState<C2cCampaignCustomer[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatus, setCustomerStatus] = useState<C2cCustomerStatus>('');
  const [customerApplied, setCustomerApplied] = useState({
    search: '',
    status: '' as C2cCustomerStatus,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<C2cCampaignFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const customerTotalPages = Math.max(1, Math.ceil(customerTotal / C2C_CAMPAIGN_PAGE_SIZE));

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return;
    setDetailLoading(true);
    try {
      const res = await secureApi('campaign.get', { campaignId });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to open campaign');
        setSelected(null);
        return;
      }
      const parsed = extractC2cCampaign(res.data);
      setSelected(parsed);
      if (!parsed) Alert.alert('Error', 'Failed to open campaign');
    } finally {
      setDetailLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    setCustomerPage(1);
    setCustomerApplied({ search: '', status: '' });
    setCustomerSearch('');
    setCustomerStatus('');
    void loadCampaign();
  }, [loadCampaign]);

  const loadCustomers = useCallback(async () => {
    if (!campaignId) return;
    setCustomersLoading(true);
    try {
      const res = await secureApi('campaign.listData', {
        campaignId,
        ...buildC2cCampaignDataQuery({
          pageNo: customerPage,
          itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
          search: customerApplied.search || undefined,
          status: customerApplied.status || undefined,
        }),
      });
      if (!res.ok) {
        setCustomers([]);
        setCustomerTotal(0);
        return;
      }
      const { items, total: t } = extractC2cCampaignCustomers(res.data);
      setCustomers(items);
      setCustomerTotal(t);
    } finally {
      setCustomersLoading(false);
    }
  }, [campaignId, customerPage, customerApplied]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

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
    detailLoading,
    customers,
    customerTotal,
    customerPage,
    setCustomerPage,
    customerTotalPages,
    customersLoading,
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
