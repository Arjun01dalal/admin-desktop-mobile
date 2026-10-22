/** List + create + duplicate state for C2C Campaign Data. */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { C2C_CAMPAIGN_PAGE_SIZE, type C2cCampaign } from '@astro/shared';

import { queryKeys } from '../../../../api/queryKeys';
import { secureApi } from '../../../../api/client';
import { useScreenQuery } from '../../../../hooks/useScreenQuery';
import type { C2cCampaignFormValues } from './C2cCampaignFormModal';
import { fetchC2cCampaignList } from './fetchC2cCampaignList';
import { useC2cCallers } from './useC2cCallers';

type ActiveFilter = '' | 'true' | 'false';

const EMPTY_FORM: C2cCampaignFormValues = {
  name: '',
  isActive: true,
  callerIds: [],
};

export function useC2cCampaignList() {
  const { callers, loadCallers } = useC2cCallers(true);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');
  const [applied, setApplied] = useState({ search: '', isActive: '' as ActiveFilter });

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<C2cCampaignFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [duplicateChoiceOpen, setDuplicateChoiceOpen] = useState(false);
  const [duplicateFormOpen, setDuplicateFormOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<C2cCampaign | null>(null);
  const [dupFormValues, setDupFormValues] = useState<C2cCampaignFormValues>(EMPTY_FORM);
  const [duplicating, setDuplicating] = useState(false);

  const listParams = {
    page,
    search: applied.search,
    isActive: applied.isActive,
  };

  const listQuery = useScreenQuery({
    queryKey: queryKeys.c2cCampaigns.list(listParams),
    queryFn: () => fetchC2cCampaignList(listParams),
  });

  const campaigns = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / C2C_CAMPAIGN_PAGE_SIZE));
  const loadCampaigns = listQuery.refresh;

  const openCreate = useCallback(() => {
    setFormValues(EMPTY_FORM);
    setFormOpen(true);
    void loadCallers();
  }, [loadCallers]);

  const saveCreate = useCallback(async () => {
    const name = formValues.name.trim();
    if (!name) {
      Alert.alert('Validation', 'Campaign name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('campaign.create', {
        campaignName: name,
        isActive: formValues.isActive,
        callerIds: formValues.callerIds,
      });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Create failed');
        return;
      }
      setFormOpen(false);
      setPage(1);
      void loadCampaigns();
    } finally {
      setSaving(false);
    }
  }, [formValues, loadCampaigns]);

  const resetDuplicateState = useCallback(() => {
    setDuplicateChoiceOpen(false);
    setDuplicateFormOpen(false);
    setDuplicateSource(null);
    setDupFormValues(EMPTY_FORM);
  }, []);

  const closeDuplicateFlow = useCallback(() => {
    if (duplicating) return;
    resetDuplicateState();
  }, [duplicating, resetDuplicateState]);

  const openDuplicate = useCallback(
    (item: C2cCampaign) => {
      if (!item._id || duplicating) return;
      setDuplicateSource(item);
      setDuplicateChoiceOpen(true);
      setDuplicateFormOpen(false);
    },
    [duplicating],
  );

  const runDuplicate = useCallback(
    async (payload?: {
      campaignName?: string;
      callerIds?: string[];
      isActive?: boolean;
    }) => {
      const campaignId = String(duplicateSource?._id || '').trim();
      if (!campaignId || duplicating) return;
      setDuplicating(true);
      try {
        const res = await secureApi('campaign.duplicate', {
          campaignId,
          ...(payload || {}),
        });
        if (!res.ok) {
          Alert.alert('Error', res.message || 'Duplicate failed');
          return;
        }
        resetDuplicateState();
        setPage(1);
        void loadCampaigns();
      } finally {
        setDuplicating(false);
      }
    },
    [duplicateSource?._id, duplicating, loadCampaigns, resetDuplicateState],
  );

  const openDuplicateForm = useCallback(() => {
    if (!duplicateSource) return;
    const baseName = String(duplicateSource.campaignName || 'Campaign').trim();
    setDupFormValues({
      name: `${baseName} (copy)`,
      isActive: Boolean(duplicateSource.isActive),
      callerIds: (duplicateSource.callers || [])
        .map((c) => String(c?._id || '').trim())
        .filter(Boolean),
    });
    setDuplicateChoiceOpen(false);
    setDuplicateFormOpen(true);
    void loadCallers();
  }, [duplicateSource, loadCallers]);

  const submitDuplicateForm = useCallback(async () => {
    const name = dupFormValues.name.trim();
    if (!name) {
      Alert.alert('Validation', 'Campaign name is required');
      return;
    }
    if (!dupFormValues.callerIds.length) {
      Alert.alert('Validation', 'Select at least one caller');
      return;
    }
    await runDuplicate({
      campaignName: name,
      callerIds: dupFormValues.callerIds,
      isActive: dupFormValues.isActive,
    });
  }, [dupFormValues, runDuplicate]);

  const applyFilters = useCallback(() => {
    setApplied({ search: searchInput.trim(), isActive: activeFilter });
    setPage(1);
  }, [activeFilter, searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setActiveFilter('');
    setApplied({ search: '', isActive: '' });
    setPage(1);
  }, []);

  return {
    campaigns,
    total,
    page,
    setPage,
    totalPages,
    loading: listQuery.loading || listQuery.refreshing,
    error: listQuery.errorMessage,
    searchInput,
    setSearchInput,
    activeFilter,
    setActiveFilter,
    applyFilters,
    clearFilters,
    loadCampaigns,
    callers,
    formOpen,
    setFormOpen,
    formValues,
    setFormValues,
    saving,
    openCreate,
    saveCreate,
    duplicateChoiceOpen,
    duplicateFormOpen,
    duplicateSource,
    dupFormValues,
    setDupFormValues,
    duplicating,
    openDuplicate,
    closeDuplicateFlow,
    openDuplicateForm,
    runDuplicate,
    submitDuplicateForm,
  };
}
