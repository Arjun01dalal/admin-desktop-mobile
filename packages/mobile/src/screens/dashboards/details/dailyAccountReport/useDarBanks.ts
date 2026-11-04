import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { isValidAccountNumber, isValidIfsc, omitEmpty } from '@astro/shared/dailyAccountReport';

import { EMPTY_BANK_FORM, type BankFormState, type TabKey, type UpdatedBy } from './types';
import {
  createBankAccount,
  darApiErrorMessage,
  fetchBankAccounts,
  updateBankAccount,
  type BankAccount,
} from './api';

type Args = {
  enabled: boolean;
  tab: TabKey;
  updatedBy: UpdatedBy;
  onCount: (n: number) => void;
};

export function useDarBanks({ enabled, tab, updatedBy, onCount }: Args) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankModal, setBankModal] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankForm, setBankForm] = useState<BankFormState>(EMPTY_BANK_FORM);

  const loadBanks = useCallback(async () => {
    if (!enabled) return;
    setBanksLoading(true);
    try {
      const result = await fetchBankAccounts({ page: 1, limit: 100 });
      setBanks(result.items);
      onCount(result.total);
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to load banks'));
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  }, [enabled, onCount]);

  useEffect(() => {
    if (tab === 'banks') void loadBanks();
  }, [tab, loadBanks]);

  const openBankCreate = () => {
    setBankForm(EMPTY_BANK_FORM);
    setBankModal(true);
  };

  const openBankEdit = (row: BankAccount) => {
    setBankForm({
      _id: row._id,
      bankName: row.bankName,
      accountHolderName: row.accountHolderName,
      accountNumber: row.accountNumber,
      ifscCode: row.ifscCode,
      accountType: row.accountType || 'savings',
      displayName: row.displayName,
      status: row.status || 'active',
    });
    setBankModal(true);
  };

  const submitBank = async () => {
    const accountNumber = bankForm.accountNumber.replace(/\s/g, '');
    const ifscCode = bankForm.ifscCode.trim().toUpperCase();
    if (!bankForm.bankName.trim() || !bankForm.accountHolderName.trim()) {
      Alert.alert('Bank name and account holder are required');
      return;
    }
    if (!isValidAccountNumber(accountNumber)) {
      Alert.alert('Account number must be 9 to 18 digits');
      return;
    }
    if (!isValidIfsc(ifscCode)) {
      Alert.alert('Enter a valid IFSC code');
      return;
    }
    const base = {
      bankName: bankForm.bankName.trim(),
      accountHolderName: bankForm.accountHolderName.trim(),
      accountNumber,
      ifscCode,
      accountType: bankForm.accountType || 'savings',
      displayName: bankForm.displayName.trim(),
      updatedBy,
    };
    setBankSaving(true);
    try {
      if (bankForm._id) {
        await updateBankAccount({ ...base, _id: bankForm._id, status: bankForm.status || 'active' });
      } else {
        await createBankAccount(omitEmpty(base));
      }
      setBankModal(false);
      await loadBanks();
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to save bank'));
    } finally {
      setBankSaving(false);
    }
  };

  return {
    banks,
    banksLoading,
    bankModal,
    setBankModal,
    bankSaving,
    bankForm,
    setBankForm,
    loadBanks,
    openBankCreate,
    openBankEdit,
    submitBank,
  };
}
