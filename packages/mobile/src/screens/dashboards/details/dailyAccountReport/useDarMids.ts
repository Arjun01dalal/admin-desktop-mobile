import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { omitEmpty } from '@astro/shared/dailyAccountReport';

import { EMPTY_MID_FORM, type MidFormState, type TabKey, type UpdatedBy } from './types';
import {
  createMid,
  darApiErrorMessage,
  fetchBankAccounts,
  fetchMids,
  updateMid,
  type BankAccount,
  type MidRecord,
} from './api';

type Args = {
  enabled: boolean;
  tab: TabKey;
  updatedBy: UpdatedBy;
  onMidCount: (n: number) => void;
  onBankCount: (updater: (c: number) => number) => void;
};

export function useDarMids({ enabled, tab, updatedBy, onMidCount, onBankCount }: Args) {
  const [mids, setMids] = useState<MidRecord[]>([]);
  const [midsLoading, setMidsLoading] = useState(false);
  const [midModal, setMidModal] = useState(false);
  const [midSaving, setMidSaving] = useState(false);
  const [bankChoices, setBankChoices] = useState<BankAccount[]>([]);
  const [pickBankOpen, setPickBankOpen] = useState(false);
  const [midForm, setMidForm] = useState<MidFormState>(EMPTY_MID_FORM);

  const loadMids = useCallback(async () => {
    if (!enabled) return;
    setMidsLoading(true);
    try {
      const [midResult, bankResult] = await Promise.all([
        fetchMids({ page: 1, limit: 200 }),
        fetchBankAccounts({ page: 1, limit: 200, status: 'active' }).catch(() => ({
          items: [] as BankAccount[],
          total: 0,
          page: 1,
          limit: 200,
        })),
      ]);
      setMids(midResult.items);
      onMidCount(midResult.total);
      setBankChoices(bankResult.items);
      onBankCount((c) => c || bankResult.total);
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to load MIDs'));
      setMids([]);
    } finally {
      setMidsLoading(false);
    }
  }, [enabled, onBankCount, onMidCount]);

  useEffect(() => {
    if (tab === 'mids') void loadMids();
  }, [tab, loadMids]);

  const openMidCreate = () => {
    setMidForm(EMPTY_MID_FORM);
    setMidModal(true);
  };

  const openMidEdit = (row: MidRecord) => {
    setMidForm({
      _id: row._id,
      mid: row.mid,
      displayName: row.displayName,
      phoneNumber: row.phoneNumber,
      upiId: row.upiId,
      bankAccountId: row.bankAccountId,
      source: row.source || 'manual',
      status: row.status || 'active',
    });
    setMidModal(true);
  };

  const submitMid = async () => {
    if (!midForm._id && !midForm.mid.trim()) {
      Alert.alert('MID is required');
      return;
    }
    if (!midForm.bankAccountId) {
      Alert.alert('Select a bank account');
      return;
    }
    const body: Record<string, unknown> = {
      displayName: midForm.displayName.trim(),
      phoneNumber: midForm.phoneNumber.trim(),
      upiId: midForm.upiId.trim(),
      bankAccountId: midForm.bankAccountId,
      source: midForm.source || 'manual',
      updatedBy,
    };
    setMidSaving(true);
    try {
      if (midForm._id) {
        await updateMid({ ...body, _id: midForm._id, status: midForm.status || 'active' });
      } else {
        await createMid(
          omitEmpty({ ...body, mid: midForm.mid.trim(), status: midForm.status || 'active' }),
        );
      }
      setMidModal(false);
      await loadMids();
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to save MID'));
    } finally {
      setMidSaving(false);
    }
  };
  
  return {
    mids,
    midsLoading,
    midModal,
    setMidModal,
    midSaving,
    bankChoices,
    pickBankOpen,
    setPickBankOpen,
    midForm,
    setMidForm,
    loadMids,
    openMidCreate,
    openMidEdit,
    submitMid,
  };
}