import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { EMPTY_ASSIGN_FORM, type AssignFormState, type TabKey, type UpdatedBy } from './types';
import {
  allotMid,
  darApiErrorMessage,
  fetchActiveAllotments,
  fetchMids,
  loadSubAdminOptions,
  reassignMid,
  revokeMid,
  type MidAllotment,
  type MidRecord,
  type SubAdminOption,
} from './api';

type Args = {
  enabled: boolean;
  tab: TabKey;
  updatedBy: UpdatedBy;
  onCount: (n: number) => void;
  onAllotmentChanged: () => void;
};

export function useDarAllotments({
  enabled,
  tab,
  updatedBy,
  onCount,
  onAllotmentChanged,
}: Args) {
  const [roster, setRoster] = useState<MidAllotment[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [allotModal, setAllotModal] = useState(false);
  const [allotSaving, setAllotSaving] = useState(false);
  const [activeMids, setActiveMids] = useState<MidRecord[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdminOption[]>([]);
  const [pickMidOpen, setPickMidOpen] = useState(false);
  const [pickSubOpen, setPickSubOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'allot' | 'reassign'>('allot');
  const [assignForm, setAssignForm] = useState<AssignFormState>(EMPTY_ASSIGN_FORM);

  const loadRoster = useCallback(async () => {
    if (!enabled) return;
    setRosterLoading(true);
    try {
      const result = await fetchActiveAllotments({});
      setRoster(result.items);
      onCount(result.total || result.items.length);
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to load allotments'));
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }, [enabled, onCount]);

  useEffect(() => {
    if (tab === 'allot') void loadRoster();
  }, [tab, loadRoster]);

  const openAllotCreate = async () => {
    setAssignMode('allot');
    setAssignForm(EMPTY_ASSIGN_FORM);
    setAllotModal(true);
    try {
      const [midsResult, subs] = await Promise.all([
        fetchMids({ page: 1, limit: 500 }),
        loadSubAdminOptions(),
      ]);
      setActiveMids(midsResult.items.filter((m) => (m.status || 'active') === 'active'));
      setSubAdmins(subs);
    } catch {
      setActiveMids([]);
      setSubAdmins([]);
    }
  };

  const openReassign = async (row: MidAllotment) => {
    setAssignMode('reassign');
    setAssignForm({
      midId: row.midId,
      midLabel: row.mid || row.midId,
      subAdminId: '',
      subAdminLabel: '',
      remark: '',
    });
    setAllotModal(true);
    const subs = await loadSubAdminOptions().catch(() => [] as SubAdminOption[]);
    setSubAdmins(subs);
  };

  const submitAllot = async (forceReassign = false) => {
    if (!assignForm.midId) {
      Alert.alert('Select a MID');
      return;
    }
    if (!assignForm.subAdminId) {
      Alert.alert('Select a sub-admin');
      return;
    }
    const body = {
      midId: assignForm.midId,
      subAdminId: assignForm.subAdminId,
      remark: assignForm.remark.trim() || undefined,
      updatedBy,
    };
    setAllotSaving(true);
    try {
      const mode = forceReassign ? 'reassign' : assignMode;
      if (mode === 'reassign') await reassignMid(body);
      else await allotMid(body);
      setAllotModal(false);
      await loadRoster();
      onAllotmentChanged();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const message = darApiErrorMessage(error, 'Allotment failed');
      if (!forceReassign && assignMode === 'allot' && status === 409) {
        Alert.alert('Already allotted', message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reassign', onPress: () => void submitAllot(true) },
        ]);
        return;
      }
      Alert.alert('Error', message);
    } finally {
      setAllotSaving(false);
    }
  };

  const confirmRevoke = (row: MidAllotment) => {
    Alert.alert('Revoke MID', `Revoke ${row.mid || row.midId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await revokeMid({ midId: row.midId, updatedBy });
              await loadRoster();
              onAllotmentChanged();
            } catch (error) {
              Alert.alert('Error', darApiErrorMessage(error, 'Failed to revoke'));
            }
          })();
        },
      },
    ]);
  };

  return {
    roster,
    rosterLoading,
    allotModal,
    setAllotModal,
    allotSaving,
    activeMids,
    subAdmins,
    pickMidOpen,
    setPickMidOpen,
    pickSubOpen,
    setPickSubOpen,
    assignMode,
    assignForm,
    setAssignForm,
    loadRoster,
    openAllotCreate,
    openReassign,
    submitAllot,
    confirmRevoke,
  };
}
