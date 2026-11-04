import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { BankAccount, DaySheetItem, MidAllotment, MidRecord } from './api';
import { ScreenFlatList } from '../../../../dashboards/ui/ScreenFlatList';
import { AllotRow, BankRow, DaySheetRow, MidRow } from './DarRows';
import { styles } from './DailyAccountReportScreen.styles';
import { useDarAllotments } from './useDarAllotments';
import { useDarDaySheet } from './useDarDaySheet';
import { useDarAccess } from './useDarAccess';
import { useDarBanks } from './useDarBanks';
import { colors } from '../../../../theme';
import type { DarListRow } from './types';
import { useDarMids } from './useDarMids';
import {
  AllotFormModal,
  BalanceEntryModal,
  BankFormModal,
  MidFormModal,
} from './DarModals';

export function DailyAccountReportScreen() {
  const access = useDarAccess();
  const [bankCount, setBankCount] = useState(0);
  const [midCount, setMidCount] = useState(0);
  const [allotmentVersion, setAllotmentVersion] = useState(0);

  const bumpAllotment = useCallback(() => setAllotmentVersion((v) => v + 1), []);
  const setBankCountCb = useCallback((n: number) => setBankCount(n), []);
  const setMidCountCb = useCallback((n: number) => setMidCount(n), []);
  const patchBankCount = useCallback(
    (updater: (c: number) => number) => setBankCount((c) => updater(c)),
    [],
  );

  const day = useDarDaySheet({
    enabled: access.canDailyBalance,
    viewAllAllotments: access.viewAllAllotments,
    updatedBy: access.updatedBy,
    allotmentVersion,
  });

  const banks = useDarBanks({
    enabled: access.canBank,
    tab: access.tab,
    updatedBy: access.updatedBy,
    onCount: setBankCountCb,
  });

  const mids = useDarMids({
    enabled: access.canMid,
    tab: access.tab,
    updatedBy: access.updatedBy,
    onMidCount: setMidCountCb,
    onBankCount: patchBankCount,
  });

  const allot = useDarAllotments({
    enabled: access.canAllot,
    tab: access.tab,
    updatedBy: access.updatedBy,
    onCount: day.setAllotCount,
    onAllotmentChanged: bumpAllotment,
  });

  if (!access.hasAccess) {
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Daily Account Report</Text>
        <Text style={styles.empty}>
          No section access. Ask admin for daily_account_report roles.
        </Text>
      </View>
    );
  }

  const { tab } = access;
  const listData = (
    tab === 'balance'
      ? day.filteredSheet
      : tab === 'banks'
        ? banks.banks
        : tab === 'mids'
          ? mids.mids
          : allot.roster
  ) as DarListRow[];

  const loading =
    (tab === 'balance' && day.sheetLoading) ||
    (tab === 'banks' && banks.banksLoading) ||
    (tab === 'mids' && mids.midsLoading) ||
    (tab === 'allot' && allot.rosterLoading);

  return (
    <>
      <ScreenFlatList
        contentContainerStyle={styles.content}
        listHeader={
          <View>
            <Text style={styles.title}>Daily Account Report</Text>
            <Text style={styles.subtitle}>Bank → MID → allotment → daily open/close</Text>
            <View style={styles.chips}>
              {access.canBank ? (
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>Banks</Text>
                  <Text style={styles.chipValue}>{bankCount}</Text>
                </View>
              ) : null}
              {access.canMid ? (
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>MIDs</Text>
                  <Text style={styles.chipValue}>{midCount}</Text>
                </View>
              ) : null}
              {access.canAllot || access.canDailyBalance ? (
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>Allotments</Text>
                  <Text style={styles.chipValue}>{day.allotCount}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.tabs}>
              {access.tabs.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, tab === t.key && styles.tabActive]}
                  onPress={() => access.setTab(t.key)}
                >
                  <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'balance' ? (
              <View style={styles.toolbar}>
                <TextInput
                  style={styles.search}
                  value={day.date}
                  onChangeText={day.setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.search}
                  value={day.midFilter}
                  onChangeText={day.setMidFilter}
                  placeholder="Filter MID / holder"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity style={styles.ghostBtn} onPress={() => void day.loadSheet()}>
                  <Text style={styles.ghostBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {tab === 'banks' ? (
              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex1]}
                  onPress={banks.openBankCreate}
                >
                  <Text style={styles.primaryBtnText}>Add bank</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => void banks.loadBanks()}>
                  <Text style={styles.ghostBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {tab === 'mids' ? (
              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex1]}
                  onPress={mids.openMidCreate}
                >
                  <Text style={styles.primaryBtnText}>Add MID</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => void mids.loadMids()}>
                  <Text style={styles.ghostBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {tab === 'allot' ? (
              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex1]}
                  onPress={() => void allot.openAllotCreate()}
                >
                  <Text style={styles.primaryBtnText}>Allot MID</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => void allot.loadRoster()}>
                  <Text style={styles.ghostBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : null}
            {tab === 'balance' && day.sheetError && day.filteredSheet.length > 0 ? (
              <Text style={styles.error}>{day.sheetError}</Text>
            ) : null}
          </View>
        }
        data={listData}
        keyExtractor={(item, index) => {
          if (tab === 'balance') return (item as DaySheetItem).midId || String(index);
          if (tab === 'banks') return (item as BankAccount)._id || String(index);
          if (tab === 'mids') return (item as MidRecord)._id || String(index);
          const row = item as MidAllotment;
          return row._id || row.midId || String(index);
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {tab === 'balance'
                ? day.sheetError || 'No allotted phones for this date'
                : tab === 'banks'
                  ? 'No bank accounts'
                  : tab === 'mids'
                    ? 'No MIDs mapped'
                    : 'No active allotments'}
            </Text>
          ) : null
        }
        renderItem={({ item }: { item: DarListRow }) => {
          if (tab === 'balance') {
            return <DaySheetRow row={item as DaySheetItem} onEntry={day.openEntry} />;
          }
          if (tab === 'banks') {
            const row = item as BankAccount;
            return <BankRow row={row} onPress={() => banks.openBankEdit(row)} />;
          }
          if (tab === 'mids') {
            const row = item as MidRecord;
            return <MidRow row={row} onPress={() => mids.openMidEdit(row)} />;
          }
          const row = item as MidAllotment;
          return (
            <AllotRow
              row={row}
              onReassign={() => void allot.openReassign(row)}
              onRevoke={() => allot.confirmRevoke(row)}
            />
          );
        }}
      />

      <BalanceEntryModal
        open={day.entryOpen}
        saving={day.entrySaving}
        mode={day.entryMode}
        midLabel={day.entryMidLabel}
        amount={day.entryAmount}
        remark={day.entryRemark}
        image={day.entryImage}
        onChangeAmount={day.setEntryAmount}
        onChangeRemark={day.setEntryRemark}
        onPickImage={() => void day.pickBalanceImage()}
        onClose={() => day.setEntryOpen(false)}
        onSave={() => void day.submitEntry()}
      />

      <BankFormModal
        open={banks.bankModal}
        saving={banks.bankSaving}
        form={banks.bankForm}
        setForm={banks.setBankForm}
        onClose={() => banks.setBankModal(false)}
        onSave={() => void banks.submitBank()}
      />

      <MidFormModal
        open={mids.midModal}
        saving={mids.midSaving}
        form={mids.midForm}
        setForm={mids.setMidForm}
        bankChoices={mids.bankChoices}
        pickBankOpen={mids.pickBankOpen}
        setPickBankOpen={mids.setPickBankOpen}
        onClose={() => mids.setMidModal(false)}
        onSave={() => void mids.submitMid()}
      />

      <AllotFormModal
        open={allot.allotModal}
        saving={allot.allotSaving}
        assignMode={allot.assignMode}
        form={allot.assignForm}
        setForm={allot.setAssignForm}
        activeMids={allot.activeMids}
        subAdmins={allot.subAdmins}
        pickMidOpen={allot.pickMidOpen}
        setPickMidOpen={allot.setPickMidOpen}
        pickSubOpen={allot.pickSubOpen}
        setPickSubOpen={allot.setPickSubOpen}
        onClose={() => allot.setAllotModal(false)}
        onSave={() => void allot.submitAllot()}
      />
    </>
  );
}

export default DailyAccountReportScreen;
