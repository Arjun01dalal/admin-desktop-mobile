/** List + create + duplicate state for C2C Campaign Data. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  C2C_CAMPAIGN_PAGE_SIZE,
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  type C2cCampaign,
} from '@astro/shared';

import type { C2cCampaignFormValues } from './C2cCampaignFormModal';
import { secureApi } from '../../../../api/client';
import { useC2cCallers } from './useC2cCallers';

type ActiveFilter = '' | 'true' | 'false';

const EMPTY_FORM: C2cCampaignFormValues = {
  name: '',
  isActive: true,
  callerIds: [],
};

export function useC2cCampaignList() {
  const { callers, loadCallers } = useC2cCallers(true);

  const [campaigns, setCampaigns] = useState<C2cCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const listGen = useRef(0);
  const totalPages = Math.max(1, Math.ceil(total / C2C_CAMPAIGN_PAGE_SIZE));

  const loadCampaigns = useCallback(async () => {
    const gen = ++listGen.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi(
        'campaign.list',
        buildC2cCampaignListQuery({
          pageNo: page,
          itemsPerPage: C2C_CAMPAIGN_PAGE_SIZE,
          search: applied.search || undefined,
          isActive:
            applied.isActive === 'true' ? true : applied.isActive === 'false' ? false : '',
        }),
      );
      if (gen !== listGen.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load campaigns');
        setCampaigns([]);
        setTotal(0);
        return;
      }
      const { items, total: t } = extractC2cCampaignList(res.data);
      setCampaigns(items);
      setTotal(t);
    } catch (err) {
      if (gen !== listGen.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      if (gen === listGen.current) setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

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
    loading,
    error,
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
