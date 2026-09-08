/** Toolbar and bulk controls for the withdrawal list. */
import React from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme';
import { DetailFilterBar } from '../dashboards/details/DetailFilterBar';
import { SEARCH_FIELDS, STATUSES } from './constants';
import { display, type Rec } from './helpers';
import { styles } from '../WithdrawalScreen.styles';
import type { SheetDownloadFilter } from '../../utils/sheetDownloadAudit';

type WithdrawalToolbarProps = {
  toolsOpen: boolean;
  setToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sortChecked: boolean;
  setSortChecked: React.Dispatch<React.SetStateAction<boolean>>;
  bankAmtDraft: string;
  setBankAmtDraft: (value: string) => void;
  bankAmt: string;
  setBankAmt: (value: string) => void;
  midFilter: string;
  setMidFilter: (value: string) => void;
  midFilterOpen: boolean;
  setMidFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mids: Array<{ label: string; mid: string; gateway: string }>;
  canManageBeneficiaries: boolean;
  onOpenBeneList: () => void;
  canDownload: boolean;
  requestSheetDownload: (filter: SheetDownloadFilter, run: () => void | Promise<boolean>) => void;
  downloadData: () => void | Promise<boolean>;
  downloadPayok: () => void | Promise<boolean>;
  downloadYesBank: () => void | Promise<boolean>;
  draftStart: string;
  draftEnd: string;
  loading: boolean;
  setDraftStart: (value: string) => void;
  setDraftEnd: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (value: number) => void;
  searchField: string;
  setSearchField: (value: string) => void;
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  setApplied: (value: { field: string; text: string }) => void;
  status: string;
  setStatus: (value: string) => void;
  msg: string;
  canManageActions: boolean;
  bulkMode: boolean;
  bulkIds: string[];
  bulkSel: Record<string, Rec>;
  clearBulk: () => void;
  setBulkMode: (value: boolean) => void;
  confirmBulk: (kind: 'lock' | 'unlock' | 'approve') => void;
  setModalErr: (value: string) => void;
  setBulkManualOpen: (value: boolean) => void;
};

export function WithdrawalToolbar({
  toolsOpen,
  setToolsOpen,
  sortChecked,
  setSortChecked,
  bankAmtDraft,
  setBankAmtDraft,
  bankAmt,
  setBankAmt,
  midFilter,
  setMidFilter,
  midFilterOpen,
  setMidFilterOpen,
  mids,
  canManageBeneficiaries,
  onOpenBeneList,
  canDownload,
  requestSheetDownload,
  downloadData,
  downloadPayok,
  downloadYesBank,
  draftStart,
  draftEnd,
  loading,
  setDraftStart,
  setDraftEnd,
  setStartDate,
  setEndDate,
  setPage,
  pageSize,
  setPageSize,
  searchField,
  setSearchField,
  searchDraft,
  setSearchDraft,
  setApplied,
  status,
  setStatus,
  msg,
  canManageActions,
  bulkMode,
  bulkIds,
  bulkSel,
  clearBulk,
  setBulkMode,
  confirmBulk,
  setModalErr,
  setBulkManualOpen,
}: WithdrawalToolbarProps) {
  return (
    <>
      {/* Collapsible tools: Sort, Bank Amount, Mid Name, downloads, Add Bene List */}
      <View style={[styles.toolsRow, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity
          style={[styles.chip, toolsOpen && styles.chipActive]}
          onPress={() => setToolsOpen((v) => !v)}
        >
          <Text style={[styles.chipText, toolsOpen && styles.chipTextActive]}>
            Tools {toolsOpen ? '▲' : '▼'}
            {!toolsOpen && (sortChecked || bankAmt || midFilter) ? ' •' : ''}
          </Text>
        </TouchableOpacity>
      </View>
      {toolsOpen ? (
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.chip, sortChecked && styles.chipActive]}
            onPress={() => {
              setSortChecked((v) => !v);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, sortChecked && styles.chipTextActive]}>
              Sort {sortChecked ? '✓' : ''}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={styles.toolInput}
            value={bankAmtDraft}
            onChangeText={setBankAmtDraft}
            placeholder="Bank Amount"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            maxLength={6}
            returnKeyType="search"
            onSubmitEditing={() => {
              setBankAmt(bankAmtDraft);
              setPage(1);
            }}
            onBlur={() => {
              if (bankAmtDraft !== bankAmt) {
                setBankAmt(bankAmtDraft);
                setPage(1);
              }
            }}
          />
          <TouchableOpacity
            style={[styles.chip, midFilter !== '' && styles.chipActive]}
            onPress={() => setMidFilterOpen((v) => !v)}
          >
            <Text style={[styles.chipText, midFilter !== '' && styles.chipTextActive]}>
              {midFilter ? `Mid: ${midFilter}` : 'Mid Name'}
            </Text>
          </TouchableOpacity>
          {canManageBeneficiaries ? (
            <TouchableOpacity style={styles.chip} onPress={onOpenBeneList}>
              <Text style={styles.chipText}>Add Bene List</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {toolsOpen && midFilterOpen ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.chip, midFilter === '' && styles.chipActive]}
            onPress={() => {
              setMidFilter('');
              setMidFilterOpen(false);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, midFilter === '' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {mids.map((m) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.chip, midFilter === m.mid && styles.chipActive]}
              onPress={() => {
                setMidFilter(m.mid);
                setMidFilterOpen(false);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, midFilter === m.mid && styles.chipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {toolsOpen && canDownload ? (
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={() =>
              requestSheetDownload(
                { mid: midFilter || 'withdrawal', type: 'Withdrawal Sheet' },
                downloadData,
              )
            }
          >
            <Text style={styles.bulkBtnText}>Download Data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={() =>
              requestSheetDownload(
                { mid: midFilter || 'withdrawal', type: 'Pay OK Sheet' },
                downloadPayok,
              )
            }
          >
            <Text style={styles.bulkBtnText}>Pay OK Data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={() =>
              requestSheetDownload(
                { mid: midFilter || 'withdrawal', type: 'Yes Bank Sheet' },
                downloadYesBank,
              )
            }
          >
            <Text style={styles.bulkBtnText}>Yes Bank Data</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setApplied({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s || 'all'}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
              {s || 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {msg ? <Text style={styles.muted}>{msg}</Text> : null}

      {/* Bulk actions (desktop Bulk Lock/UnLock/Approve/Manual Approve) */}
      {canManageActions ? (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={[styles.chip, bulkMode && styles.chipActive]}
            onPress={() => (bulkMode ? clearBulk() : setBulkMode(true))}
          >
            <Text style={[styles.chipText, bulkMode && styles.chipTextActive]}>
              {bulkMode ? `Bulk: ${bulkIds.length} selected ✕` : 'Bulk Select'}
            </Text>
          </TouchableOpacity>
          {bulkMode ? (
            <>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('lock')}>
                <Text style={styles.bulkBtnText}>Bulk Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('unlock')}>
                <Text style={styles.bulkBtnText}>Bulk UnLock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('approve')}>
                <Text style={styles.bulkBtnText}>Bulk Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => {
                  if (bulkIds.length === 0) {
                    Alert.alert('No refunds selected', 'Cards pe tap karke select karo.');
                    return;
                  }
                  setModalErr('');
                  setBulkManualOpen(true);
                }}
              >
                <Text style={styles.bulkBtnText}>Bulk Manual Approve</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
      {bulkMode && bulkIds.length > 0 ? (
        <Text style={styles.muted}>
          Selected:{' '}
          {Object.values(bulkSel)
            .map((r) => display(r.accountHolderName ?? r.userName))
            .join(', ')}
        </Text>
      ) : null}
    </>
  );
}
